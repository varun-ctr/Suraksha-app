/**
 * SOS lifecycle telemetry — recorded as Sentry breadcrumbs, mirroring
 * core/analytics/authTelemetry.ts. For a life-critical feature these
 * breadcrumbs are what let us reconstruct "did the alert actually go out,
 * and if not, where did it stop" after the fact, without logging anything
 * that identifies the user or their location.
 *
 * No PII, ever: no coordinates, addresses, contact names/numbers, or user
 * identifiers in `data`. No-ops without a Sentry DSN, wrapped in try/catch —
 * telemetry must never crash the app it's trying to observe, especially not
 * this one.
 */
import * as Sentry from "@sentry/react-native";

export type SosEventName =
  | "sos_triggered"
  | "sos_cancelled_countdown"
  | "sos_cancelled_active"
  | "sos_db_write_failed"
  | "sos_db_write_success"
  | "sos_db_retry"
  | "sos_alert_dispatch_start"
  | "sos_alert_dispatch_success"
  | "sos_alert_dispatch_failed"
  | "sos_recovery_stale"
  | "sos_recovery_resumed";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function trackSosEvent(name: SosEventName): void {
  if (!dsn) return;
  try {
    Sentry.addBreadcrumb({ category: "sos", message: name, level: "info" });
  } catch {
    // ignore — see file header
  }
}
