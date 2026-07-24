/**
 * Community-report lifecycle telemetry — recorded as Sentry breadcrumbs,
 * mirroring core/analytics/sosTelemetry.ts. Exists so a spike in
 * `community_report_rate_limited` is visible in aggregate (abuse/spam
 * signal) without logging anything that identifies the reporter or the
 * report's content/location.
 *
 * No PII, ever: no coordinates, addresses, description text, or user
 * identifiers in `data`. No-ops without a Sentry DSN, wrapped in try/catch —
 * telemetry must never crash the feature it's observing.
 */
import * as Sentry from "@sentry/react-native";

export type CommunityReportEventName =
  | "community_report_submitted"
  | "community_report_duplicate_prevented"
  | "community_report_rate_limited"
  | "community_report_failed";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function trackCommunityReportEvent(name: CommunityReportEventName): void {
  if (!dsn) return;
  try {
    Sentry.addBreadcrumb({ category: "community_report", message: name, level: "info" });
  } catch {
    // ignore — see file header
  }
}
