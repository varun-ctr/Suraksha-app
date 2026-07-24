/**
 * Journey (timed check-in) lifecycle telemetry — recorded as Sentry
 * breadcrumbs, mirroring core/analytics/sosTelemetry.ts /
 * core/analytics/authTelemetry.ts. No PII, ever: no coordinates, addresses,
 * contact names/numbers, or user identifiers in `data`. No-ops without a
 * Sentry DSN, wrapped in try/catch — telemetry must never crash the
 * feature it's trying to observe.
 */
import * as Sentry from "@sentry/react-native";

export type JourneyEventName =
  | "journey_started"
  | "journey_checked_in"
  | "journey_ended_manually"
  | "journey_overdue"
  | "journey_auto_sos_triggered"
  | "journey_recovery_resumed"
  | "journey_recovery_expired_during_background"
  | "journey_db_write_failed";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function trackJourneyEvent(name: JourneyEventName): void {
  if (!dsn) return;
  try {
    Sentry.addBreadcrumb({ category: "journey", message: name, level: "info" });
  } catch {
    // ignore — see file header
  }
}
