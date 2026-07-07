/**
 * Suraksha theme system — Material 3 edition.
 *
 * The app ships a small "theme engine": the user can pick an accent theme
 * (blue / purple / rose / ocean / sunset) and a colour mode (light / dark / system).
 * `buildPalette(themeKey, isDark)` composes a full palette from a neutral set
 * (driven by the mode) plus an accent set (driven by the theme).
 *
 * Default theme: "blue" (Material 3 Deep Blue, #2563EB primary).
 */

export type ThemeKey = "blue" | "purple" | "rose" | "ocean" | "sunset";
export type ColorMode = "light" | "dark" | "system";

export interface AccentSet {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  accentDark: string;
}

export interface Palette extends AccentSet {
  isDark: boolean;
  success: string;
  successDark: string;
  successSoft: string;
  warning: string;
  danger: string;
  dangerDark: string;
  dangerSoft: string;
  // Map categories (kept constant across themes for legibility)
  police: string;
  hospital: string;
  shelter: string;
  shops: string;
  // Neutrals
  bg: string;
  card: string;
  cardAlt: string;
  text: string;
  textMuted: string;
  textFaint: string;
  border: string;
  inputBg: string;
  onColor: string;
  overlay: string;
}

export const THEME_ORDER: ThemeKey[] = ["blue", "purple", "rose", "ocean", "sunset"];

export const ACCENTS: Record<ThemeKey, AccentSet> = {
  blue: {
    primary: "#2563EB",
    primaryDark: "#1D4ED8",
    primaryLight: "#93C5FD",
    accent: "#EF4444",
    accentDark: "#DC2626",
  },
  purple: {
    primary: "#5B2FBF",
    primaryDark: "#3F1F8C",
    primaryLight: "#8B68DC",
    accent: "#D91A7A",
    accentDark: "#A8125C",
  },
  rose: {
    primary: "#C2185B",
    primaryDark: "#8E0E42",
    primaryLight: "#E1659A",
    accent: "#7B1FA2",
    accentDark: "#591680",
  },
  ocean: {
    primary: "#0E7490",
    primaryDark: "#0B5366",
    primaryLight: "#2FA6C2",
    accent: "#DB2777",
    accentDark: "#9D174D",
  },
  sunset: {
    primary: "#EA580C",
    primaryDark: "#C2410C",
    primaryLight: "#FB923C",
    accent: "#DB2777",
    accentDark: "#9D174D",
  },
};

export const THEME_LABELS: Record<ThemeKey, { en: string; hi: string }> = {
  blue:   { en: "Blue",   hi: "गहरा नीला" },
  purple: { en: "Purple", hi: "बैंगनी" },
  rose:   { en: "Rose",   hi: "गुलाबी" },
  ocean:  { en: "Ocean",  hi: "समुद्री" },
  sunset: { en: "Sunset", hi: "नारंगी" },
};

const LIGHT_NEUTRALS = {
  success: "#22C55E",
  successDark: "#16A34A",
  successSoft: "#DCFCE7",
  warning: "#F59E0B",
  danger: "#EF4444",
  dangerDark: "#B91C1C",
  dangerSoft: "#FEE2E2",
  police: "#2563EB",
  hospital: "#EC4899",
  shelter: "#22C55E",
  shops: "#F59E0B",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  cardAlt: "#F1F5F9",
  text: "#111827",
  textMuted: "#6B7280",
  textFaint: "#9CA3AF",
  border: "#E5E7EB",
  inputBg: "#FFFFFF",
  onColor: "#FFFFFF",
  overlay: "rgba(17,24,39,0.5)",
};

const DARK_NEUTRALS = {
  success: "#4ADE80",
  successDark: "#22C55E",
  successSoft: "#14532D",
  warning: "#FCD34D",
  danger: "#F87171",
  dangerDark: "#DC2626",
  dangerSoft: "#7F1D1D",
  police: "#60A5FA",
  hospital: "#F9A8D4",
  shelter: "#4ADE80",
  shops: "#FCD34D",
  bg: "#0F172A",
  card: "#1E293B",
  cardAlt: "#334155",
  text: "#F1F5F9",
  textMuted: "#94A3B8",
  textFaint: "#64748B",
  border: "#334155",
  inputBg: "#1E293B",
  onColor: "#FFFFFF",
  overlay: "rgba(0,0,0,0.65)",
};

export function buildPalette(themeKey: ThemeKey, isDark: boolean): Palette {
  const accent = ACCENTS[themeKey] ?? ACCENTS.blue;
  const neutrals = isDark ? DARK_NEUTRALS : LIGHT_NEUTRALS;
  return { isDark, ...accent, ...neutrals };
}

/** Card radius per Material 3 spec. */
export const RADIUS = 18;

/** Adds an alpha channel to a 6-digit hex colour. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}
