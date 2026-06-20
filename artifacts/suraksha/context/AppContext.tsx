import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const KEY = "suraksha.app.v1";

export interface Contact {
  id: string;
  name: string;
  phone: string;
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
  contacts: [
    { id: "seed-1", name: "Priya Sharma", phone: "+91 98765 43210" },
    { id: "seed-2", name: "Anita Reddy", phone: "+91 91234 56789" },
    { id: "seed-3", name: "Mom (Lakshmi)", phone: "+91 99887 76655" },
  ],
  reports: [],
  profile: { name: "Ananya Rao", phone: "+91 98765 12345", premium: true },
  settings: { notifications: true, bgLocation: true },
  onboarded: false,
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface AppContextValue extends PersistShape {
  ready: boolean;
  addContact: (name: string, phone: string) => void;
  addContacts: (items: { name: string; phone: string }[]) => number;
  deleteContact: (id: string) => void;
  addReport: (r: Omit<ReportItem, "id" | "createdAt">) => void;
  deleteReport: (id: string) => void;
  setProfile: (p: Partial<Profile>) => void;
  setSettings: (s: Partial<Settings>) => void;
  completeOnboarding: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistShape>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<PersistShape>;
          setState((prev) => ({
            ...prev,
            ...parsed,
            profile: { ...prev.profile, ...parsed.profile },
            settings: { ...prev.settings, ...parsed.settings },
            contacts: parsed.contacts ?? prev.contacts,
            reports: parsed.reports ?? prev.reports,
          }));
        }
      } catch {
        // ignore — use defaults
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persist = useCallback((next: PersistShape) => {
    setState(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const addContact = useCallback(
    (name: string, phone: string) => {
      if (!name.trim() || !phone.trim()) return;
      setState((prev) => {
        const next = {
          ...prev,
          contacts: [...prev.contacts, { id: uid(), name: name.trim(), phone: phone.trim() }],
        };
        AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [],
  );

  const addContacts = useCallback((items: { name: string; phone: string }[]) => {
    let added = 0;
    setState((prev) => {
      const existing = new Set(prev.contacts.map((c) => c.phone.replace(/\s+/g, "")));
      const fresh = items
        .filter((i) => i.name.trim() && i.phone.trim())
        .filter((i) => {
          const norm = i.phone.replace(/\s+/g, "");
          if (existing.has(norm)) return false;
          existing.add(norm);
          return true;
        })
        .map((i) => ({ id: uid(), name: i.name.trim(), phone: i.phone.trim() }));
      added = fresh.length;
      const next = { ...prev, contacts: [...prev.contacts, ...fresh] };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    return added;
  }, []);

  const deleteContact = useCallback((id: string) => {
    setState((prev) => {
      const next = { ...prev, contacts: prev.contacts.filter((c) => c.id !== id) };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const addReport = useCallback((r: Omit<ReportItem, "id" | "createdAt">) => {
    setState((prev) => {
      const next = {
        ...prev,
        reports: [{ ...r, id: uid(), createdAt: Date.now() }, ...prev.reports],
      };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const deleteReport = useCallback((id: string) => {
    setState((prev) => {
      const next = { ...prev, reports: prev.reports.filter((r) => r.id !== id) };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setProfile = useCallback((p: Partial<Profile>) => {
    setState((prev) => {
      const next = { ...prev, profile: { ...prev.profile, ...p } };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setSettings = useCallback((s: Partial<Settings>) => {
    setState((prev) => {
      const next = { ...prev, settings: { ...prev.settings, ...s } };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const completeOnboarding = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, onboarded: true };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      ready,
      addContact,
      addContacts,
      deleteContact,
      addReport,
      deleteReport,
      setProfile,
      setSettings,
      completeOnboarding,
    }),
    [
      state,
      ready,
      addContact,
      addContacts,
      deleteContact,
      addReport,
      deleteReport,
      setProfile,
      setSettings,
      completeOnboarding,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
