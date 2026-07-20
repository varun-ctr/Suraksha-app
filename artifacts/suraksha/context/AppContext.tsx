import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { secureDelete, secureGet, secureSet } from "@/lib/secureStore";
import {
  deleteAllContactsFromDb,
  deleteContactFromDb,
  syncContactsOnLoad,
  upsertContactToDb,
} from "@/lib/contactsSync";
import { supabase } from "@/lib/supabaseClient";
import { firebaseAuth } from "@/lib/firebase";
import { onFirebaseAuthStateChanged } from "@/lib/firebaseAuth";
import { normalizePhone } from "@/lib/validate";
import { clearSakhiHistory } from "@/lib/sakhiHistory";

/** Sensitive data (PII) lives in the OS keystore; the rest in plain storage. */
const SECURE_KEY = "suraksha.secure.v1";
const PLAIN_KEY = "suraksha.app.v2";
/** Keys written by older builds; cleared on reset so "delete all" is truthful. */
const LEGACY_PLAIN_KEYS = ["suraksha.app.v1"];

// A safety app must let a user reach more than one person in an emergency.
// This is the same cap for everyone — trusted contacts are never paywalled.
const MAX_CONTACTS = 5;

export interface Contact {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string;
}

export interface Profile {
  name: string;
  phone: string;
  email: string;
  premium: boolean;
  avatarUrl?: string;
}

interface Settings {
  notifications: boolean;
  bgLocation: boolean;
  shakeToSos: boolean;
}

interface PersistShape {
  contacts: Contact[];
  profile: Profile;
  settings: Settings;
  onboarded: boolean;
}

const DEFAULTS: PersistShape = {
  contacts: [],
  profile: { name: "", phone: "", email: "", premium: false },
  settings: { notifications: true, bgLocation: false, shakeToSos: false },
  onboarded: false,
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type AddContactResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "duplicate" | "limit" };

interface AppContextValue extends PersistShape {
  ready: boolean;
  maxContacts: number;
  addContact: (name: string, phone: string) => AddContactResult;
  addContacts: (items: { name: string; phone: string }[]) => number;
  editContact: (id: string, patch: Partial<Pick<Contact, "name" | "phone" | "avatarUrl">>) => AddContactResult;
  deleteContact: (id: string) => void;
  setProfile: (p: Partial<Profile>) => void;
  setSettings: (s: Partial<Settings>) => void;
  completeOnboarding: () => void;
  resetAllData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function persist(next: PersistShape) {
  secureSet(
    SECURE_KEY,
    JSON.stringify({ contacts: next.contacts, profile: next.profile }),
  );
  AsyncStorage.setItem(
    PLAIN_KEY,
    JSON.stringify({
      settings: next.settings,
      onboarded: next.onboarded,
    }),
  ).catch(() => {});
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistShape>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const prevUidRef = useRef<string | null>(firebaseAuth.currentUser?.uid ?? null);

  /**
   * Clears this device's local copy of contacts/profile/settings/Sakhi chat —
   * but NOT the signed-out user's own Supabase data, which stays intact for
   * them to sync back down next time they sign in. Used both when a session
   * ends (so the next signed-in user on this device can't inherit or
   * overwrite the previous user's contacts) and as the local half of full
   * account deletion below.
   */
  const clearLocalStorageOnly = useCallback(async () => {
    await Promise.all([
      secureDelete(SECURE_KEY),
      AsyncStorage.removeItem(PLAIN_KEY).catch(() => {}),
      ...LEGACY_PLAIN_KEYS.map((k) => AsyncStorage.removeItem(k).catch(() => {})),
      clearSakhiHistory(),
    ]);
    stateRef.current = DEFAULTS;
    setState(DEFAULTS);
  }, []);

  // ── Load from local storage ───────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const [secureRaw, plainRaw] = await Promise.all([
          secureGet(SECURE_KEY),
          AsyncStorage.getItem(PLAIN_KEY),
        ]);
        const secure = secureRaw
          ? (JSON.parse(secureRaw) as Partial<Pick<PersistShape, "contacts" | "profile">>)
          : {};
        const plain = plainRaw
          ? (JSON.parse(plainRaw) as Partial<Pick<PersistShape, "settings" | "onboarded">>)
          : {};
        setState((prev) => ({
          ...prev,
          contacts: secure.contacts ?? prev.contacts,
          profile: { ...prev.profile, ...secure.profile },
          settings: { ...prev.settings, ...plain.settings },
          onboarded: plain.onboarded ?? prev.onboarded,
        }));
      } catch {
        // ignore — use defaults
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // ── Supabase sync — runs once local data is ready ─────────────────

  useEffect(() => {
    if (!ready) return;

    const doSync = async (userId: string) => {
      try {
        const merged = await syncContactsOnLoad(userId, stateRef.current.contacts);
        const current = stateRef.current.contacts;
        // Only update if the list actually changed
        const changed =
          merged.length !== current.length ||
          merged.some((m, i) => m.id !== current[i]?.id || m.name !== current[i]?.name);
        if (changed) {
          setState((prev) => {
            const next = { ...prev, contacts: merged };
            persist(next);
            return next;
          });
        }
      } catch {
        // Table may not exist yet — silently continue with local data
      }
    };

    // Sync immediately if already signed in
    if (firebaseAuth.currentUser) {
      void doSync(firebaseAuth.currentUser.uid);
    }

    // Re-sync on Firebase auth state changes
    const unsub = onFirebaseAuthStateChanged((user) => {
      if (user) {
        void doSync(user.uid);
      } else if (prevUidRef.current !== null) {
        // A real sign-out transition (had a user, now don't) — clear this
        // device's local copy so a different user signing in next can't
        // inherit or overwrite it. Not fired on first load with no prior
        // session (prevUidRef starts null in that case).
        void clearLocalStorageOnly();
      }
      prevUidRef.current = user?.uid ?? null;
    });

    return unsub;
  }, [ready, clearLocalStorageOnly]);

  // ── Helpers ───────────────────────────────────────────────────────

  const getUserId = useCallback(async (): Promise<string | null> => {
    return firebaseAuth.currentUser?.uid ?? null;
  }, []);

  // ── Mutations ─────────────────────────────────────────────────────

  const addContact = useCallback(
    (name: string, phone: string): AddContactResult => {
      const trimmedName = name.trim();
      const normalized = normalizePhone(phone);
      if (!trimmedName || !normalized) return { ok: false, error: "invalid" };
      const prev = stateRef.current;
      if (prev.contacts.length >= MAX_CONTACTS) return { ok: false, error: "limit" };
      const exists = prev.contacts.some(
        (c) => normalizePhone(c.phone) === normalized,
      );
      if (exists) return { ok: false, error: "duplicate" };
      const newContact: Contact = { id: uid(), name: trimmedName, phone: normalized };
      const next = {
        ...prev,
        contacts: [...prev.contacts, newContact],
      };
      stateRef.current = next;
      setState(next);
      persist(next);
      // Sync to Supabase in background
      getUserId().then((uid) => {
        if (uid) upsertContactToDb(uid, newContact).catch(() => {});
      }).catch(() => {});
      return { ok: true };
    },
    [getUserId],
  );

  const addContacts = useCallback((items: { name: string; phone: string }[]) => {
    let added = 0;
    let freshContacts: Contact[] = [];
    setState((prev) => {
      const existing = new Set(
        prev.contacts
          .map((c) => normalizePhone(c.phone))
          .filter((v): v is string => Boolean(v)),
      );
      const slots = MAX_CONTACTS - prev.contacts.length;
      freshContacts = items
        .map((i) => ({ name: i.name.trim(), normalized: normalizePhone(i.phone) }))
        .filter((i): i is { name: string; normalized: string } => Boolean(i.name) && Boolean(i.normalized))
        .filter((i) => {
          if (existing.has(i.normalized)) return false;
          existing.add(i.normalized);
          return true;
        })
        .slice(0, slots)
        .map((i) => ({ id: uid(), name: i.name, phone: i.normalized }));
      added = freshContacts.length;
      if (added === 0) return prev;
      const next = { ...prev, contacts: [...prev.contacts, ...freshContacts] };
      persist(next);
      return next;
    });
    // Sync batch to Supabase
    if (freshContacts.length > 0) {
      getUserId().then((uid) => {
        if (!uid) return;
        freshContacts.forEach((c) => upsertContactToDb(uid, c).catch(() => {}));
      }).catch(() => {});
    }
    return added;
  }, [getUserId]);

  const editContact = useCallback(
    (id: string, patch: Partial<Pick<Contact, "name" | "phone" | "avatarUrl">>): AddContactResult => {
      const prev = stateRef.current;
      const target = prev.contacts.find((c) => c.id === id);
      if (!target) return { ok: false, error: "invalid" };

      let normalized = target.phone;
      if (patch.phone !== undefined) {
        const n = normalizePhone(patch.phone);
        if (!n) return { ok: false, error: "invalid" };
        const dupe = prev.contacts.some((c) => c.id !== id && normalizePhone(c.phone) === n);
        if (dupe) return { ok: false, error: "duplicate" };
        normalized = n;
      }

      const trimmedName = patch.name !== undefined ? patch.name.trim() : target.name;
      if (!trimmedName) return { ok: false, error: "invalid" };

      const updated: Contact = {
        ...target,
        name: trimmedName,
        phone: normalized,
        avatarUrl: patch.avatarUrl ?? target.avatarUrl,
      };
      const next = {
        ...prev,
        contacts: prev.contacts.map((c) => (c.id === id ? updated : c)),
      };
      stateRef.current = next;
      setState(next);
      persist(next);
      // Sync to Supabase
      getUserId().then((userId) => {
        if (userId) upsertContactToDb(userId, updated).catch(() => {});
      }).catch(() => {});
      return { ok: true };
    },
    [getUserId],
  );

  const deleteContact = useCallback((id: string) => {
    setState((prev) => {
      const next = { ...prev, contacts: prev.contacts.filter((c) => c.id !== id) };
      persist(next);
      return next;
    });
    // Delete from Supabase
    getUserId().then((userId) => {
      if (userId) deleteContactFromDb(userId, id).catch(() => {});
    }).catch(() => {});
  }, [getUserId]);

  const setProfile = useCallback((p: Partial<Profile>) => {
    setState((prev) => {
      const next = { ...prev, profile: { ...prev.profile, ...p } };
      persist(next);
      return next;
    });
  }, []);

  const setSettings = useCallback((s: Partial<Settings>) => {
    setState((prev) => {
      const next = { ...prev, settings: { ...prev.settings, ...s } };
      persist(next);
      return next;
    });
  }, []);

  const completeOnboarding = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, onboarded: true };
      persist(next);
      return next;
    });
  }, []);

  const resetAllData = useCallback(async () => {
    // Account deletion — also wipe the user's own Supabase rows.
    const userId = await getUserId();
    if (userId) {
      await deleteAllContactsFromDb(userId).catch(() => {});
    }
    await clearLocalStorageOnly();
  }, [getUserId, clearLocalStorageOnly]);

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      ready,
      maxContacts: MAX_CONTACTS,
      addContact,
      addContacts,
      editContact,
      deleteContact,
      setProfile,
      setSettings,
      completeOnboarding,
      resetAllData,
    }),
    [
      state,
      ready,
      addContact,
      addContacts,
      editContact,
      deleteContact,
      setProfile,
      setSettings,
      completeOnboarding,
      resetAllData,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
