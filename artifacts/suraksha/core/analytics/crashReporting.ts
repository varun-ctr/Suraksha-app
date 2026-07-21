/**
 * Crash/error reporting, wired to `components/ErrorBoundary.tsx`'s `onError`
 * prop (previously never passed, so caught render errors showed the user a
 * fallback screen and were otherwise invisible in production).
 *
 * No-ops entirely — including skipping `Sentry.init` — when
 * `EXPO_PUBLIC_SENTRY_DSN` isn't set, so this has zero effect until a real
 * DSN is added via Replit Secrets. Wrapped in try/catch throughout: a
 * problem reporting a crash must never itself crash the app.
 */
import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initCrashReporting(): void {
  if (!dsn) return;
  try {
    Sentry.init({ dsn, tracesSampleRate: 0 });
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
