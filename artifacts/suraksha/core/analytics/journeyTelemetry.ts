/**
 * Journey (timed check-in) lifecycle telemetry — recorded as Sentry
 * breadcrumbs, mirroring core/analytics/sosTelemetry.ts /
 * core/analytics/authTelemetry.ts. No PII, ever: no coordinates,
 * addresses, contact names/numbers, or user identifiers in `data` — only
 * closed-vocabulary event names and small numeric/enum fields. No-ops
 * without a Sentry DSN, wrapped in try/catch.
 *
 * Event set redesigned in the v2 hardening pass to map directly onto the
 * explicit JourneyOutcome states (domain/entities/JourneyOutcome.ts)
 * instead of the previous ad-hoc names — see
 * docs/journey-audit/hardening-v2-report.md for the mapping and rationale.
 * "Journey Duration" is intentionally a *field* on the terminal events
 * below (`durationSec`), not a separate event — there is no occurrence of
 * "a journey's duration" independent of it actually completing, being
 * cancelled, expiring, or being escalated.
 */
import * as Sentry from "@sentry/react-native";

export type JourneyEventName =
  | "journey_started"
  | "journey_completed"
  | "journey_cancelled"
  | "journey_expired"
  | "journey_escalated"
  | "journey_recovery"
  | "journey_retry_count"
  | "journey_db_write_failed";

export interface JourneyEventData {
  /** Elapsed seconds at the moment of a terminal event — "Journey Duration" telemetry. Never PII (just a count of seconds). */
  durationSec?: number;
  /** Only for "journey_recovery": which outcome the crash/background recovery effect produced. */
  recoveryOutcome?: "resumed" | "expired";
  /** Only for "journey_retry_count": how many attempts journeyRepository.startJourney's retry loop took (1 = succeeded on the first try; only tracked when a retry actually happened). */
  attempts?: number;
}

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function trackJourneyEvent(name: JourneyEventName, data?: JourneyEventData): void {
  if (!dsn) return;
  try {
    Sentry.addBreadcrumb({ category: "journey", message: name, level: "info", data });
  } catch {
    // ignore — see file header
  }
}
