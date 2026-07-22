/**
 * Pure, dependency-free builder for the emergency alert message.
 *
 * Kept free of React Native / Expo imports (only type-only imports) so it can
 * be unit-tested in plain Node and reused from both React and non-React code.
 * All user-facing strings are localized via the injected `t` translator.
 */
import type { Coords } from "@/domain/entities/Coords";
// Relative (not "@/…") import: this module is executed directly by plain
// Node (`node --test`) for unit tests, which has no path-alias resolution —
// see the file header. shared/utils/geo.ts has zero React Native/Expo
// dependencies, so it's safe to import at runtime here.
import { coordLink } from "../../../shared/utils/geo.ts";

// Re-exported for backward compatibility — coordLink's canonical home is now
// shared/utils/geo.ts (a shared, feature-agnostic, dependency-free utility).
export { coordLink };

/** Minimal shape of the i18n translator (context/LanguageContext `t`). */
export type Translate = (key: string) => string;

/** Replaces `{name}` style placeholders in a template. */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

/**
 * Builds the localized emergency message sent to trusted contacts.
 *
 * Prefers a live-tracking `shareUrl` when present; otherwise falls back to a
 * static maps link for the current coordinates.
 */
export function buildEmergencyMessage(
  t: Translate,
  userName: string,
  coords: Coords | null,
  shareUrl: string | null,
  address?: string | null,
): string {
  const link = shareUrl ?? (coords ? coordLink(coords.lat, coords.lng) : null);
  const now = new Date();
  const date = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const name = userName.trim() || t("sos.msg.someone");

  const lines = [
    t("sos.msg.title"),
    "",
    interpolate(t("sos.msg.danger"), { name }),
    interpolate(t("sos.msg.datetime"), { date, time }),
  ];

  if (address) {
    lines.push(interpolate(t("sos.msg.location"), { address }));
  } else if (coords) {
    lines.push(
      interpolate(t("sos.msg.coords"), {
        coords: `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
      }),
    );
  }

  if (link) {
    lines.push("", t("sos.msg.tracking"), link);
  }

  lines.push("", t("sos.msg.cta"), t("sos.msg.signature"));
  return lines.join("\n");
}
