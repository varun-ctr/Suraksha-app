import { useSafety } from "@/features/sos/context/SafetyContext";
import type { SafetyStatus } from "@/features/sos/context/SafetyContext";
import { useI18n } from "@/features/settings/context/LanguageContext";
import { useTheme } from "@/features/settings/context/ThemeContext";
import type { WeatherData } from "@/repositories/api/weatherRepository";

function computeSafetyScore(
  status: SafetyStatus,
  weather: WeatherData | null,
  hasContacts: boolean,
  locationReady: boolean,
): number {
  let s = 20;
  const h = new Date().getHours();
  if (h >= 6 && h < 21) s += 20;
  if (hasContacts) s += 20;
  if (locationReady) s += 15;
  if (weather) {
    s += weather.code < 50 ? 25 : weather.code < 80 ? 12 : 0;
  } else {
    // Weather not yet loaded — no bonus, no penalty
    s += 0;
  }
  if (status === "emergency") s = Math.min(s, 30);
  else if (status === "caution") s = Math.min(s, 65);
  return Math.min(100, Math.max(10, s));
}

function scoreColor(score: number, c: ReturnType<typeof useTheme>["c"]): string {
  return score >= 70 ? c.success : score >= 40 ? c.warning : c.danger;
}

function scoreLabelKey(score: number): string {
  return score >= 70 ? "home.statusProtected" : score >= 40 ? "home.statusModerateRisk" : "home.statusHighRisk";
}

function getSafetySuggestions(t: (key: string) => string, weather: WeatherData | null): string[] {
  const out: string[] = [];
  const h = new Date().getHours();
  if (weather?.code !== undefined) {
    if (weather.code >= 95) out.push(t("home.tipStorm"));
    else if (weather.code >= 61) out.push(t("home.tipUmbrella"));
    else if (weather.code >= 45) out.push(t("home.tipLowVisibility"));
    else if (weather.code < 3) out.push(t("home.tipClearSkies"));
  }
  if (h >= 21 || h < 5) out.push(t("home.tipNightStreets"));
  else if (h >= 6 && h < 10) out.push(t("home.tipMorningRush"));
  else if (h >= 17 && h < 20) out.push(t("home.tipEveningRush"));
  out.push(t("home.tipShareLocation"));
  return out.slice(0, 3);
}

export interface SafetyScoreResult {
  score: number;
  color: string;
  label: string;
  emoji: string;
  suggestions: string[];
}

/** Derives the home dashboard's "safety score" from SOS status, weather, contacts, and location readiness. */
export function useSafetyScore(
  weather: WeatherData | null,
  hasContacts: boolean,
  locationReady: boolean,
): SafetyScoreResult {
  const { safetyStatus } = useSafety();
  const { t } = useI18n();
  const { c } = useTheme();

  const score = computeSafetyScore(safetyStatus, weather, hasContacts, locationReady);
  const color = scoreColor(score, c);
  const label = t(scoreLabelKey(score));
  const emoji = score >= 70 ? "🛡️" : score >= 40 ? "⚠️" : "🆘";
  const suggestions = getSafetySuggestions(t, weather);

  return { score, color, label, emoji, suggestions };
}
