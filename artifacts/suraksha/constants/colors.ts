/**
 * Suraksha theme system.
 *
 * The app ships a small "theme engine": the user can pick an accent theme
 * (purple / rose / ocean / sunset) and a colour mode (light / dark / system).
 * `buildPalette(themeKey, isDark)` composes a full palette from a neutral set
 * (driven by the mode) plus an accent set (driven by the theme).
 *
 * The default export keeps the scaffold `useColors()` hook working by exposing
 * a light/dark palette plus `radius`.
 */

export type ThemeKey = "purple" | "rose" | "ocean" | "sunset";
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
  successSoft: string;
  warning: string;
  danger: string;
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

export const THEME_ORDER: ThemeKey[] = ["purple", "rose", "ocean", "sunset"];

export const ACCENTS: Record<ThemeKey, AccentSet> = {
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
  purple: { en: "Purple", hi: "बैंगनी" },
  rose: { en: "Rose", hi: "गुलाबी" },
  ocean: { en: "Ocean", hi: "नीला" },
  sunset: { en: "Sunset", hi: "नारंगी" },
};

const LIGHT_NEUTRALS = {
  success: "#0E9B6B",
  successSoft: "#E9F9F2",
  warning: "#C47D0E",
  danger: "#D92D20",
  dangerSoft: "#FBEAF1",
  police: "#2454C7",
  hospital: "#D91A7A",
  shelter: "#0E9B6B",
  shops: "#C47D0E",
  bg: "#F6F3FB",
  card: "#FFFFFF",
  cardAlt: "#F1ECFA",
  text: "#1A1035",
  textMuted: "#6E6485",
  textFaint: "#A099B4",
  border: "#E9E3F4",
  inputBg: "#FFFFFF",
  onColor: "#FFFFFF",
  overlay: "rgba(20,10,40,0.45)",
};

const DARK_NEUTRALS = {
  success: "#1FB985",
  successSoft: "#13352A",
  warning: "#E0A130",
  danger: "#F0635A",
  dangerSoft: "#3A1622",
  police: "#5B83E8",
  hospital: "#EC5FA0",
  shelter: "#1FB985",
  shops: "#E0A130",
  bg: "#100A1E",
  card: "#1B1430",
  cardAlt: "#271C40",
  text: "#F4F1FA",
  textMuted: "#B5ABCC",
  textFaint: "#7C7196",
  border: "#2E2348",
  inputBg: "#241A3C",
  onColor: "#FFFFFF",
  overlay: "rgba(0,0,0,0.6)",
};

export function buildPalette(themeKey: ThemeKey, isDark: boolean): Palette {
  const accent = ACCENTS[themeKey] ?? ACCENTS.purple;
  const neutrals = isDark ? DARK_NEUTRALS : LIGHT_NEUTRALS;
  return { isDark, ...accent, ...neutrals };
}

export const RADIUS = 16;

/** Adds an alpha channel to a 6-digit hex colour. */
export function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

// --- Scaffold compatibility (useColors hook) -------------------------------
function toScaffold(p: Palette) {
  return {
    text: p.text,
    tint: p.primary,
    background: p.bg,
    foreground: p.text,
    card: p.card,
    cardForeground: p.text,
    primary: p.primary,
    primaryForeground: p.onColor,
    secondary: p.cardAlt,
    secondaryForeground: p.primary,
    muted: p.cardAlt,
    mutedForeground: p.textMuted,
    accent: p.accent,
    accentForeground: p.onColor,
    destructive: p.danger,
    destructiveForeground: p.onColor,
    border: p.border,
    input: p.border,
  };
}

const colors = {
  light: toScaffold(buildPalette("purple", false)),
  dark: toScaffold(buildPalette("purple", true)),
  radius: RADIUS,
};

export default colors;
