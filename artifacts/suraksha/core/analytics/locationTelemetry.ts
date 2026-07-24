/**
 * Location-acquisition telemetry — recorded as Sentry breadcrumbs, mirroring
 * core/analytics/sosTelemetry.ts.
 *
 * Why this file exists: `core/permissions/location.ts` returns `null` on both
 * permission denial and fetch failure, and `reverseGeocode` returns `null` on
 * any error. Those silent nulls are correct app behavior (a location failure
 * must never block an SOS — see docs/qa-certification/02-Emergency-Testing.md)
 * but they left production with no signal at all distinguishing "the user has
 * location off" from "the OS geocoder is failing" during a real emergency.
 * That gap was identified in docs/qa-certification/11-Production-Monitoring.md
 * and this file closes it.
 *
 * No PII, ever: event name only — never coordinates, accuracy values,
 * addresses, or geocoder response text. This is deliberate and matches the
 * closed-enum payload guarantee the privacy audit relies on
 * (docs/security-audit/03-Privacy-Audit.md); a location-failure event that
 * carried a location would defeat the point of the feature it observes.
 * No-ops without a Sentry DSN, wrapped in try/catch — telemetry must never
 * crash the app it's trying to observe.
 */
import * as Sentry from "@sentry/react-native";

export type LocationEventName =
  /** Foreground permission was requested and not granted. */
  | "location_permission_denied"
  /** Permission was granted but the position fix itself threw/failed. */
  | "location_fetch_failed"
  /** A position was obtained but reverse geocoding to an address failed. */
  | "location_reverse_geocode_failed";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function trackLocationEvent(name: LocationEventName): void {
  if (!dsn) return;
  try {
    Sentry.addBreadcrumb({ category: "location", message: name, level: "warning" });
  } catch {
    // ignore — see file header
  }
}
