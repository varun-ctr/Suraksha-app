/**
 * i18n re-exports — source of truth has moved to:
 *   constants/languages.ts  (language metadata, LangCode union type)
 *   constants/locales/{lang}.ts  (per-language string tables, lazy-loaded)
 *
 * This file is kept for backward-compatible imports. All string lookups go
 * through `useI18n()` in context/LanguageContext.
 */

export type { LangCode as Language } from "@/constants/languages";
export { LANGUAGE_LABELS, LANGUAGES, LANG_BY_CODE } from "@/constants/languages";
