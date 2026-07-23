/**
 * Authentication lifecycle telemetry — recorded as Sentry breadcrumbs, not
 * a separate analytics/BI pipeline (this app has none, and building one is
 * out of scope for a hardening pass). Breadcrumbs show up in the timeline
 * leading up to a crash report, which is exactly what's useful for
 * diagnosing auth-related issues in production ("user attempted Google
 * sign-in, got auth/network-request-failed, then the app crashed").
 *
 * No-ops without a Sentry DSN, same as core/analytics/crashReporting.ts,
 * and wrapped in try/catch throughout for the same reason: telemetry must
 * never crash the app it's trying to observe.
 */
import * as Sentry from "@sentry/react-native";

export type AuthEventName =
  | "sign_in_attempt"
  | "sign_in_success"
  | "sign_in_failure"
  | "sign_up_attempt"
  | "sign_up_success"
  | "sign_up_failure"
  | "otp_requested"
  | "otp_request_failed"
  | "otp_verified"
  | "otp_verify_failed"
  | "social_sign_in_attempt"
  | "social_sign_in_success"
  | "social_sign_in_cancelled"
  | "social_sign_in_needs_link"
  | "social_sign_in_failure"
  | "sign_out"
  | "account_delete_attempt"
  | "account_delete_success"
  | "account_delete_failure";

export interface AuthEventData {
  /** e.g. "google" | "apple" | "email" | "otp" | "custom_token" — never an email address, uid, or token. */
  method?: string;
  /**
   * A stable AppError `code` (e.g. "AUTH", "OTP_EXPIRED", "NETWORK") — never
   * the raw user-facing message, which can echo back user input (an email,
   * an entered code) in some Firebase error shapes.
   */
  errorCode?: string;
}

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function trackAuthEvent(name: AuthEventName, data?: AuthEventData): void {
  if (!dsn) return;
  try {
    Sentry.addBreadcrumb({ category: "auth", message: name, level: "info", data });
  } catch {
    // ignore — see file header
  }
}
