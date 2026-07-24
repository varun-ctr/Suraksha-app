/**
 * Notification-delivery telemetry — recorded as Sentry breadcrumbs, mirroring
 * core/analytics/sosTelemetry.ts.
 *
 * Why this file exists: every failure path in `core/permissions/notifications.ts`
 * is deliberately non-fatal — a missing push token or a failed token sync must
 * never break the app, and `scheduleLocalNotification` returns `null` rather
 * than throwing. That is correct behavior, but it meant production had no
 * signal for any notification failure whatsoever, identified as a confirmed gap
 * in docs/qa-certification/11-Production-Monitoring.md.
 *
 * The highest-value event here is `notification_schedule_failed`: the
 * journey-overdue local notification is the durability backstop that fires even
 * when the OS never wakes the JS engine (see SafetyContext's overdue effect and
 * docs/qa-certification/06-Background-Testing.md). If scheduling it silently
 * fails, that backstop is gone and nothing anywhere would have said so.
 *
 * No PII, ever: event name only — never push tokens, user ids, or notification
 * content. No-ops without a Sentry DSN, wrapped in try/catch.
 */
import * as Sentry from "@sentry/react-native";

export type NotificationEventName =
  /** The OS permission prompt completed and the user did not grant it. */
  | "notification_permission_denied"
  /** The permission request itself threw before returning a decision. */
  | "notification_permission_request_failed"
  /** Permission granted, but no Expo push token could be obtained. */
  | "notification_token_unavailable"
  /** A token was obtained but persisting it for this user failed. */
  | "notification_token_sync_failed"
  /** Clearing this device's token on sign-out/toggle-off failed. */
  | "notification_deregister_failed"
  /** A local notification could not be scheduled (journey-overdue backstop). */
  | "notification_schedule_failed";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function trackNotificationEvent(name: NotificationEventName): void {
  if (!dsn) return;
  try {
    Sentry.addBreadcrumb({ category: "notification", message: name, level: "warning" });
  } catch {
    // ignore — see file header
  }
}
