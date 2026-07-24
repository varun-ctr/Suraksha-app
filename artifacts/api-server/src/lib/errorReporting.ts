import * as Sentry from "@sentry/node";
import { logger } from "./logger";
import { scrubSentryEvent } from "./sentryScrubber";

/**
 * Backend error tracking + operational alerting.
 *
 * Two layers, so this works with OR without an external service:
 *  1. Always emits a structured, greppable log line (`alert: true`, plus a
 *     stable `kind`) — an operator can wire a log-based alert to it even with
 *     no Sentry account.
 *  2. If `SENTRY_DSN` is set, also forwards to Sentry.
 *
 * Everything is wrapped so a reporting failure can never crash a request or the
 * process (mirrors the mobile `lib/crashReporting.ts` contract).
 */
const dsn = process.env.SENTRY_DSN;
let sentryOn = false;

export function initErrorReporting(): void {
  if (!dsn) return;
  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? "development",
      tracesSampleRate: 0,
      sendDefaultPii: false,
      // Defense-in-depth on top of pino's own header redaction and the
      // email-masking already applied at log call sites — see
      // lib/sentryScrubber.ts's header doc for what this does and doesn't
      // reliably catch.
      beforeSend: (event) => scrubSentryEvent(event as unknown as Record<string, unknown>) as never,
      beforeBreadcrumb: (breadcrumb) => scrubSentryEvent(breadcrumb as unknown as Record<string, unknown>) as never,
    });
    sentryOn = true;
    logger.info("Sentry error reporting enabled");
  } catch (err) {
    // A bad DSN must never take down startup — we simply run log-only.
    logger.warn({ err }, "Sentry init failed — continuing with log-only alerting");
  }
}

/** Report an unexpected error (crash, 5xx). */
export function captureError(err: unknown, context?: Record<string, unknown>): void {
  logger.error({ err, alert: true, ...context }, "Captured error");
  if (!sentryOn) return;
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    // ignore — see file header
  }
}

/**
 * Report an operational alert: an expected-but-serious condition an operator
 * should see (e.g. SOS SMS delivery failing, or rate-limit/idempotency running
 * in degraded fail-open mode during a Supabase outage).
 */
export function captureAlert(kind: string, context?: Record<string, unknown>): void {
  logger.error({ alert: true, kind, ...context }, `ALERT: ${kind}`);
  if (!sentryOn) return;
  try {
    Sentry.captureMessage(`ALERT: ${kind}`, {
      level: "warning",
      extra: context,
    });
  } catch {
    // ignore
  }
}

/** Flush buffered events before the process exits (best-effort, bounded). */
export async function flushErrorReporting(timeoutMs = 2000): Promise<void> {
  if (!sentryOn) return;
  try {
    await Sentry.close(timeoutMs);
  } catch {
    // ignore
  }
}
