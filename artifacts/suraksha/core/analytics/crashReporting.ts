/**
 * Crash/error reporting, wired to `components/ErrorBoundary.tsx`'s `onError`
 * prop (previously never passed, so caught render errors showed the user a
 * fallback screen and were otherwise invisible in production).
 *
 * No-ops entirely — including skipping `Sentry.init` — when
 * `EXPO_PUBLIC_SENTRY_DSN` isn't set, so this has zero effect until a real
 * DSN is added via Replit Secrets. Wrapped in try/catch throughout: a
 * problem reporting a crash must never itself crash the app.
 *
 * `beforeSend` runs every outgoing event through scrubSentryEvent() (see
 * sentryScrubber.ts) before it leaves the device — defense-in-depth on top
 * of this app's telemetry payloads already being PII-free by construction.
 */
import * as Sentry from "@sentry/react-native";

import { scrubSentryEvent } from "@/core/analytics/sentryScrubber";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initCrashReporting(): void {
  if (!dsn) return;
  try {
    Sentry.init({
      dsn,
      tracesSampleRate: 0,
      sendDefaultPii: false,
      beforeSend: (event) => scrubSentryEvent(event as unknown as Record<string, unknown>) as never,
      beforeBreadcrumb: (breadcrumb) => scrubSentryEvent(breadcrumb as unknown as Record<string, unknown>) as never,
    });
  } catch {
    // Reporting is best-effort — never let a bad DSN/init failure crash startup.
  }
}

/** Reports a caught error (e.g. from ErrorBoundary.componentDidCatch). */
export function reportError(error: Error, componentStack?: string): void {
  if (!dsn) return;
  try {
    Sentry.captureException(error, componentStack ? { extra: { componentStack } } : undefined);
  } catch {
    // ignore — see file header
  }
}
