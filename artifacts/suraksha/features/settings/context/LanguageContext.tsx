import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Alert, I18nManager } from "react-native";

import type { LangCode } from "@/features/settings/constants/languages";
import { LANG_BY_CODE } from "@/features/settings/constants/languages";
import { useAuth } from "@/features/authentication/context/AuthContext";
import { db } from "@/repositories/supabase/supabaseClient";

const LANG_KEY = "suraksha.lang.v1";
const DEFAULT_LANG: LangCode = "en";

// ---------------------------------------------------------------------------
// Static locale loader map — Metro requires static import() strings
// ---------------------------------------------------------------------------
const LOCALE_LOADERS: Record<LangCode, () => Promise<{ default: Record<string, string> }>> = {
  en: () => import("@/features/settings/locales/strings/en"),
  hi: () => import("@/features/settings/locales/strings/hi"),
  bn: () => import("@/features/settings/locales/strings/bn"),
  te: () => import("@/features/settings/locales/strings/te"),
  mr: () => import("@/features/settings/locales/strings/mr"),
  ta: () => import("@/features/settings/locales/strings/ta"),
  gu: () => import("@/features/settings/locales/strings/gu"),
  kn: () => import("@/features/settings/locales/strings/kn"),
  or: () => import("@/features/settings/locales/strings/or"),
  ml: () => import("@/features/settings/locales/strings/ml"),
  pa: () => import("@/features/settings/locales/strings/pa"),
  ur: () => import("@/features/settings/locales/strings/ur"),
  ar: () => import("@/features/settings/locales/strings/ar"),
  es: () => import("@/features/settings/locales/strings/es"),
  fr: () => import("@/features/settings/locales/strings/fr"),
  de: () => import("@/features/settings/locales/strings/de"),
  pt: () => import("@/features/settings/locales/strings/pt"),
  ru: () => import("@/features/settings/locales/strings/ru"),
  zh: () => import("@/features/settings/locales/strings/zh"),
  ja: () => import("@/features/settings/locales/strings/ja"),
  ko: () => import("@/features/settings/locales/strings/ko"),
  sw: () => import("@/features/settings/locales/strings/sw"),
  tr: () => import("@/features/settings/locales/strings/tr"),
  id: () => import("@/features/settings/locales/strings/id"),
  ms: () => import("@/features/settings/locales/strings/ms"),
  th: () => import("@/features/settings/locales/strings/th"),
  vi: () => import("@/features/settings/locales/strings/vi"),
  fa: () => import("@/features/settings/locales/strings/fa"),
};

const RTL_LANGS = new Set<LangCode>(["ar", "ur", "fa"]);

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------
export interface LanguageContextValue {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  toggleLang: () => void;
  t: (key: string) => string;
  /**
   * Picks the value for the current language from a bilingual (or partial)
   * object. Falls back to `obj.en` for language codes that aren't present.
   * Typed as `{ en: T; hi: T }` for backward compatibility with existing
   * callers; internally casts to try any lang key first.
   */
  pick: <T>(obj: { en: T; hi: T }) => T;
  ready: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Derived from AuthContext's single canonical auth-state subscription
  // rather than a second, independent onFirebaseAuthStateChanged listener
  // — see docs/adr/0001-feature-first-architecture.md's performance notes.
  const { user } = useAuth();
  const [lang, setLangState] = useState<LangCode>(DEFAULT_LANG);
  const [locale, setLocale] = useState<Record<string, string>>({});
  const [enLocale, setEnLocale] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  // Load EN locale once as the permanent fallback
  useEffect(() => {
    void LOCALE_LOADERS.en().then((m) => setEnLocale(m.default));
  }, []);

  // On mount: read saved language and apply it
  useEffect(() => {
    const init = async () => {
      try {
        const saved = await AsyncStorage.getItem(LANG_KEY);
        const code: LangCode =
          saved && saved in LOCALE_LOADERS ? (saved as LangCode) : DEFAULT_LANG;
        await loadLocale(code);
      } catch {
        await loadLocale(DEFAULT_LANG);
      } finally {
        setReady(true);
      }
    };
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconcile language for the signed-in user — runs immediately if already
  // signed in when this mounts, and again on every later sign-in transition,
  // since `user` is a dependency.
  useEffect(() => {
    if (user?.uid) void syncWithProfile(user.uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadLocale = async (code: LangCode) => {
    const loader = LOCALE_LOADERS[code] ?? LOCALE_LOADERS.en;
    const m = await loader();
    setLocale(m.default);
    setLangState(code);
    await AsyncStorage.setItem(LANG_KEY, code).catch(() => {});
  };

  const syncWithProfile = async (userId: string) => {
    try {
      const { data: profile } = await db.profiles.getById(userId);
      if (profile?.language && profile.language in LOCALE_LOADERS) {
        const profileCode = profile.language as LangCode;
        const saved = await AsyncStorage.getItem(LANG_KEY);
        if (saved !== profileCode) await loadLocale(profileCode);
      } else {
        const saved = ((await AsyncStorage.getItem(LANG_KEY)) ?? DEFAULT_LANG) as LangCode;
        await db.profiles.update(userId, { language: saved });
      }
    } catch {
      // profiles table may not be ready — silently skip
    }
  };

  const t = useCallback(
    (key: string): string => locale[key] ?? enLocale[key] ?? key,
    [locale, enLocale],
  );

  const setLang = useCallback((code: LangCode) => {
    const meta = LANG_BY_CODE[code];
    const needsRtl = RTL_LANGS.has(code);
    const currentlyRtl = I18nManager.isRTL;
    void loadLocale(code);
    if (needsRtl !== currentlyRtl) {
      I18nManager.forceRTL(needsRtl);
      const dir = t(needsRtl ? "common.rtl" : "common.ltr");
      Alert.alert(
        t("common.restartRequired"),
        t("common.restartRtlBody")
          .replace("{lang}", meta?.englishName ?? code)
          .replace("{dir}", dir),
        [
          { text: t("common.restartLater"), style: "cancel" },
          {
            text: t("common.restartNow"),
            onPress: () => {
              Updates.reloadAsync().catch(() => {
                // reloadAsync is unavailable in Expo Go / dev client — silently skip
              });
            },
          },
        ],
      );
    }
  }, [t]);

  const toggleLang = useCallback(() => {
    setLang(lang === "hi" ? "en" : "hi");
  }, [lang, setLang]);

  const pick = useCallback(
    <T,>(obj: { en: T; hi: T }): T =>
      ((obj as Record<string, T | undefined>)[lang] ?? obj.en) as T,
    [lang],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ lang, setLang, toggleLang, t, pick, ready }),
    [lang, setLang, toggleLang, t, pick, ready],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useI18n(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useI18n must be used within LanguageProvider");
  return ctx;
}
