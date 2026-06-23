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
import { normalizeIndianMobile } from "@/lib/validate";

/** Sensitive data (PII) lives in the OS keystore; the rest in plain storage. */
const SECURE_KEY = "suraksha.secure.v1";
const PLAIN_KEY = "suraksha.app.v2";
/** Keys written by older builds; cleared on reset so "delete all" is truthful. */
const LEGACY_PLAIN_KEYS = ["suraksha.app.v1"];

const MAX_CONTACTS = 10;

export interface Contact {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string;
}

export interface ReportItem {
  id: string;
  category: string;
  description: string;
  photoUri?: string;
  location?: string;
  createdAt: number;
}

export interface Profile {
  name: string;
  phone: string;
  premium: boolean;
  avatarUrl?: string;
}

interface Settings {
  notifications: boolean;
  bgLocation: boolean;
}

interface PersistShape {
  contacts: Contact[];
  reports: ReportItem[];
  profile: Profile;
  settings: Settings;
  onboarded: boolean;
}

const DEFAULTS: PersistShape = {
  contacts: [],
  reports: [],
  profile: { name: "", phone: "", premium: false },
  settings: { notifications: true, bgLocation: false },
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
  addReport: (r: Omit<ReportItem, "id" | "createdAt">) => void;
  deleteReport: (id: string) => void;
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
      reports: next.reports,
      settings: next.settings,
      onboarded: next.onboarded,
    }),
  ).catch(() => {});
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistShape>(DEFAULTS);
  const [ready, setReady] = useState(false);
  /** Mirrors the latest committed state so handlers can read it synchronously. */
  const stateRef = useRef(state);
  stateRef.current = state;

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
          ? (JSON.parse(plainRaw) as Partial<Pick<PersistShape, "reports" | "settings" | "onboarded">>)
          : {};
        setState((prev) => ({
          ...prev,
          contacts: secure.contacts ?? prev.contacts,
          profile: { ...prev.profile, ...secure.profile },
          reports: plain.reports ?? prev.reports,
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

  const addContact = useCallback(
    (name: string, phone: string): AddContactResult => {
      const trimmedName = name.trim();
      const normalized = normalizeIndianMobile(phone);
      if (!trimmedName || !normalized) return { ok: false, error: "invalid" };
      const prev = stateRef.current;
      if (prev.contacts.length >= MAX_CONTACTS) return { ok: false, error: "limit" };
      const exists = prev.contacts.some(
        (c) => normalizeIndianMobile(c.phone) === normalized,
      );
      if (exists) return { ok: false, error: "duplicate" };
      const next = {
        ...prev,
        contacts: [...prev.contacts, { id: uid(), name: trimmedName, phone: normalized }],
      };
      stateRef.current = next;
      setState(next);
      persist(next);
      return { ok: true };
    },
    [],
  );

  const addContacts = useCallback((items: { name: string; phone: string }[]) => {
    let added = 0;
    setState((prev) => {
      const existing = new Set(
        prev.contacts
          .map((c) => normalizeIndianMobile(c.phone))
          .filter((v): v is string => Boolean(v)),
      );
      const slots = MAX_CONTACTS - prev.contacts.length;
      const fresh = items
        .map((i) => ({ name: i.name.trim(), normalized: normalizeIndianMobile(i.phone) }))
        .filter((i): i is { name: string; normalized: string } => Boolean(i.name) && Boolean(i.normalized))
        .filter((i) => {
          if (existing.has(i.normalized)) return false;
          existing.add(i.normalized);
          return true;
        })
        .slice(0, slots)
        .map((i) => ({ id: uid(), name: i.name, phone: i.normalized }));
      added = fresh.length;
      if (added === 0) return prev;
      const next = { ...prev, contacts: [...prev.contacts, ...fresh] };
      persist(next);
      return next;
    });
    return added;
  }, []);

  const editContact = useCallback(
    (id: string, patch: Partial<Pick<Contact, "name" | "phone" | "avatarUrl">>): AddContactResult => {
      const prev = stateRef.current;
      const target = prev.contacts.find((c) => c.id === id);
      if (!target) return { ok: false, error: "invalid" };

      let normalized = target.phone;
      if (patch.phone !== undefined) {
        const n = normalizeIndianMobile(patch.phone);
        if (!n) return { ok: false, error: "invalid" };
        const dupe = prev.contacts.some((c) => c.id !== id && normalizeIndianMobile(c.phone) === n);
        if (dupe) return { ok: false, error: "duplicate" };
        normalized = n;
      }

      const trimmedName = patch.name !== undefined ? patch.name.trim() : target.name;
      if (!trimmedName) return { ok: false, error: "invalid" };

      const next = {
        ...prev,
        contacts: prev.contacts.map((c) =>
          c.id === id
            ? { ...c, name: trimmedName, phone: normalized, avatarUrl: patch.avatarUrl ?? c.avatarUrl }
            : c,
        ),
      };
      stateRef.current = next;
      setState(next);
      persist(next);
      return { ok: true };
    },
    [],
  );

  const deleteContact = useCallback((id: string) => {
    setState((prev) => {
      const next = { ...prev, contacts: prev.contacts.filter((c) => c.id !== id) };
      persist(next);
      return next;
    });
  }, []);

  const addReport = useCallback((r: Omit<ReportItem, "id" | "createdAt">) => {
    setState((prev) => {
      const next = {
        ...prev,
        reports: [{ ...r, id: uid(), createdAt: Date.now() }, ...prev.reports],
      };
      persist(next);
      return next;
    });
  }, []);

  const deleteReport = useCallback((id: string) => {
    setState((prev) => {
      const next = { ...prev, reports: prev.reports.filter((r) => r.id !== id) };
      persist(next);
      return next;
    });
  }, []);

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
    await Promise.all([
      secureDelete(SECURE_KEY),
      AsyncStorage.removeItem(PLAIN_KEY).catch(() => {}),
      ...LEGACY_PLAIN_KEYS.map((k) => AsyncStorage.removeItem(k).catch(() => {})),
    ]);
    stateRef.current = DEFAULTS;
    setState(DEFAULTS);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      ready,
      maxContacts: MAX_CONTACTS,
      addContact,
      addContacts,
      editContact,
      deleteContact,
      addReport,
      deleteReport,
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
      addReport,
      deleteReport,
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
