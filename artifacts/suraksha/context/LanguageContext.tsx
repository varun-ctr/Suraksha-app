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

import type { LangCode } from "@/constants/languages";
import { LANG_BY_CODE } from "@/constants/languages";
import { firebaseAuth } from "@/lib/firebase";
import { onFirebaseAuthStateChanged } from "@/lib/firebaseAuth";
import { db } from "@/lib/supabaseClient";

const LANG_KEY = "suraksha.lang.v1";
const DEFAULT_LANG: LangCode = "en";

// ---------------------------------------------------------------------------
// Static locale loader map — Metro requires static import() strings
// ---------------------------------------------------------------------------
const LOCALE_LOADERS: Record<LangCode, () => Promise<{ default: Record<string, string> }>> = {
  en: () => import("@/constants/locales/en"),
  hi: () => import("@/constants/locales/hi"),
  bn: () => import("@/constants/locales/bn"),
  te: () => import("@/constants/locales/te"),
  mr: () => import("@/constants/locales/mr"),
  ta: () => import("@/constants/locales/ta"),
  gu: () => import("@/constants/locales/gu"),
  kn: () => import("@/constants/locales/kn"),
  or: () => import("@/constants/locales/or"),
  ml: () => import("@/constants/locales/ml"),
  pa: () => import("@/constants/locales/pa"),
  ur: () => import("@/constants/locales/ur"),
  ar: () => import("@/constants/locales/ar"),
  es: () => import("@/constants/locales/es"),
  fr: () => import("@/constants/locales/fr"),
  de: () => import("@/constants/locales/de"),
  pt: () => import("@/constants/locales/pt"),
  ru: () => import("@/constants/locales/ru"),
  zh: () => import("@/constants/locales/zh"),
  ja: () => import("@/constants/locales/ja"),
  ko: () => import("@/constants/locales/ko"),
  sw: () => import("@/constants/locales/sw"),
  tr: () => import("@/constants/locales/tr"),
  id: () => import("@/constants/locales/id"),
  ms: () => import("@/constants/locales/ms"),
  th: () => import("@/constants/locales/th"),
  vi: () => import("@/constants/locales/vi"),
  fa: () => import("@/constants/locales/fa"),
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
  const [lang, setLangState] = useState<LangCode>(DEFAULT_LANG);
  const [locale, setLocale] = useState<Record<string, string>>({});
  const [enLocale, setEnLocale] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  // Load EN locale once as the permanent fallback
  useEffect(() => {
    void LOCALE_LOADERS.en().then((m) => setEnLocale(m.default));
  }, []);

  // On mount: read saved language, apply it, then listen for auth changes
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

    // Reconcile language for users who are already signed in on first mount
    const currentUser = firebaseAuth.currentUser;
    if (currentUser?.uid) void syncWithProfile(currentUser.uid);

    const unsub = onFirebaseAuthStateChanged((user) => {
      if (user?.uid) void syncWithProfile(user.uid);
    });

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const setLang = useCallback((code: LangCode) => {
    const meta = LANG_BY_CODE[code];
    const needsRtl = RTL_LANGS.has(code);
    const currentlyRtl = I18nManager.isRTL;
    void loadLocale(code);
    if (needsRtl !== currentlyRtl) {
      I18nManager.forceRTL(needsRtl);
      const dir = needsRtl ? "right-to-left" : "left-to-right";
      Alert.alert(
        "Restart required",
        `${meta?.englishName ?? code} uses a ${dir} layout. Restart now to apply the change.`,
        [
          { text: "Later", style: "cancel" },
          {
            text: "Restart now",
            onPress: () => {
              Updates.reloadAsync().catch(() => {
                // reloadAsync is unavailable in Expo Go / dev client — silently skip
              });
            },
          },
        ],
      );
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === "hi" ? "en" : "hi");
  }, [lang, setLang]);

  const t = useCallback(
    (key: string): string => locale[key] ?? enLocale[key] ?? key,
    [locale, enLocale],
  );

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
