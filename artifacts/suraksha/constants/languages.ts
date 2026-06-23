export interface LangMeta {
  code: string;
  nativeName: string;
  englishName: string;
  flag: string;
  rtl: boolean;
  region: "indian" | "international";
}

export const LANGUAGES: LangMeta[] = [
  // --- Indian languages (English first as the default) ---
  { code: "en", nativeName: "English",         englishName: "English",    flag: "🇬🇧", rtl: false, region: "international" },
  { code: "hi", nativeName: "हिंदी",            englishName: "Hindi",      flag: "🇮🇳", rtl: false, region: "indian" },
  { code: "bn", nativeName: "বাংলা",            englishName: "Bengali",    flag: "🇮🇳", rtl: false, region: "indian" },
  { code: "te", nativeName: "తెలుగు",           englishName: "Telugu",     flag: "🇮🇳", rtl: false, region: "indian" },
  { code: "mr", nativeName: "मराठी",            englishName: "Marathi",    flag: "🇮🇳", rtl: false, region: "indian" },
  { code: "ta", nativeName: "தமிழ்",            englishName: "Tamil",      flag: "🇮🇳", rtl: false, region: "indian" },
  { code: "gu", nativeName: "ગુજરાતી",          englishName: "Gujarati",   flag: "🇮🇳", rtl: false, region: "indian" },
  { code: "kn", nativeName: "ಕನ್ನಡ",            englishName: "Kannada",    flag: "🇮🇳", rtl: false, region: "indian" },
  { code: "or", nativeName: "ଓଡ଼ିଆ",            englishName: "Odia",       flag: "🇮🇳", rtl: false, region: "indian" },
  { code: "ml", nativeName: "മലയാളം",           englishName: "Malayalam",  flag: "🇮🇳", rtl: false, region: "indian" },
  { code: "pa", nativeName: "ਪੰਜਾਬੀ",           englishName: "Punjabi",    flag: "🇮🇳", rtl: false, region: "indian" },
  { code: "ur", nativeName: "اردو",             englishName: "Urdu",       flag: "🇵🇰", rtl: true,  region: "indian" },
  // --- International languages ---
  { code: "ar", nativeName: "العربية",          englishName: "Arabic",     flag: "🇸🇦", rtl: true,  region: "international" },
  { code: "es", nativeName: "Español",          englishName: "Spanish",    flag: "🇪🇸", rtl: false, region: "international" },
  { code: "fr", nativeName: "Français",         englishName: "French",     flag: "🇫🇷", rtl: false, region: "international" },
  { code: "de", nativeName: "Deutsch",          englishName: "German",     flag: "🇩🇪", rtl: false, region: "international" },
  { code: "pt", nativeName: "Português",        englishName: "Portuguese", flag: "🇧🇷", rtl: false, region: "international" },
  { code: "ru", nativeName: "Русский",          englishName: "Russian",    flag: "🇷🇺", rtl: false, region: "international" },
  { code: "zh", nativeName: "中文",             englishName: "Chinese",    flag: "🇨🇳", rtl: false, region: "international" },
  { code: "ja", nativeName: "日本語",            englishName: "Japanese",   flag: "🇯🇵", rtl: false, region: "international" },
  { code: "ko", nativeName: "한국어",            englishName: "Korean",     flag: "🇰🇷", rtl: false, region: "international" },
  { code: "sw", nativeName: "Kiswahili",        englishName: "Swahili",    flag: "🇰🇪", rtl: false, region: "international" },
  { code: "tr", nativeName: "Türkçe",           englishName: "Turkish",    flag: "🇹🇷", rtl: false, region: "international" },
  { code: "id", nativeName: "Bahasa Indonesia", englishName: "Indonesian", flag: "🇮🇩", rtl: false, region: "international" },
  { code: "ms", nativeName: "Bahasa Melayu",    englishName: "Malay",      flag: "🇲🇾", rtl: false, region: "international" },
  { code: "th", nativeName: "ภาษาไทย",          englishName: "Thai",       flag: "🇹🇭", rtl: false, region: "international" },
  { code: "vi", nativeName: "Tiếng Việt",       englishName: "Vietnamese", flag: "🇻🇳", rtl: false, region: "international" },
  { code: "fa", nativeName: "فارسی",            englishName: "Persian",    flag: "🇮🇷", rtl: true,  region: "international" },
];

export type LangCode = "en"|"hi"|"bn"|"te"|"mr"|"ta"|"gu"|"kn"|"or"|"ml"|"pa"|"ur"
                     | "ar"|"es"|"fr"|"de"|"pt"|"ru"|"zh"|"ja"|"ko"|"sw"|"tr"
                     | "id"|"ms"|"th"|"vi"|"fa";

export const LANG_BY_CODE: Record<string, LangMeta> = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, l]),
);

export const LANGUAGE_LABELS: Record<string, string> = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, l.nativeName]),
);
