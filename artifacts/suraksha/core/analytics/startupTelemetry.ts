/**
 * App-startup telemetry — recorded as Sentry breadcrumbs/messages, mirroring
 * core/analytics/authTelemetry.ts and core/analytics/sosTelemetry.ts. This
 * replaces the ad-hoc `[TEMP-DEBUG][STARTUP]` console logging added during
 * the startup-crash investigation (see docs/startup-audit/).
 *
 * No PII, ever: only closed-vocabulary event names, integer durations, and a
 * closed-vocabulary `reason` string — never a raw error message, stack
 * trace, env var name/value, or user data. No-ops without a Sentry DSN, and
 * every call is wrapped in try/catch — telemetry must never itself crash
 * the startup path it's trying to observe.
 */
import * as Sentry from "@sentry/react-native";

import { logger } from "@/core/logger/logger";

export type StartupEventName =
  | "app_launch"
  | "startup_complete"
  | "auth_restore_complete"
  | "navigation_ready"
  | "startup_failure"
  | "crash_before_render";

/**
 * Closed vocabulary of startup-failure reasons — deliberately coarse (never
 * the underlying error's own message/stack, which can vary and isn't
 * guaranteed PII-free) so this is safe to send to Sentry unconditionally.
 */
export type StartupFailureReason =
  | "missing_config"
  | "fonts_timed_out"
  | "js_exception"
  | "fatal_js_exception";

export interface StartupEventData {
  /** Milliseconds since STARTUP_START_MS (see getElapsedSinceStart below). */
  durationMs?: number;
  reason?: StartupFailureReason;
}

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** Module-evaluation time — as close to "process start" as JS code can observe. */
const STARTUP_START_MS = Date.now();

/** Milliseconds elapsed since this module was first evaluated (effectively app launch). */
export function getElapsedSinceStart(): number {
  return Date.now() - STARTUP_START_MS;
}

export function trackStartupEvent(name: StartupEventName, data?: StartupEventData): void {
  if (!dsn) return;
  try {
    Sentry.addBreadcrumb({ category: "startup", message: name, level: "info", data });
  } catch {
    // ignore — see file header
  }
}

let hasRenderedOnce = false;
/** Called once real UI has mounted (see app/_layout.tsx's Gate) — after this, a crash is ErrorBoundary's concern, not the pre-render safety net below. */
export function markRenderConfirmed(): void {
  hasRenderedOnce = true;
}

let handlerInstalled = false;
/**
 * Installs a global JS error handler to catch exceptions that occur before
 * any component has rendered — the exact window an ErrorBoundary cannot
 * cover, since React error boundaries only catch errors thrown during
 * render/lifecycle, not top-level synchronous throws during module
 * evaluation or early startup code. This is what would have reported the
 * expo-task-manager Expo Go crash (see docs/startup-audit/) had it existed
 * at the time; it's a safety net for a *future* mistake of the same shape,
 * not a fix for a currently-known bug. Idempotent — safe to call more than
 * once (e.g. Fast Refresh). Call as early as possible in app/_layout.tsx.
 */
export function installCrashBeforeRenderHandler(): void {
  if (handlerInstalled) return;
  const globalWithErrorUtils = globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler?: () => ((error: unknown, isFatal?: boolean) => void) | undefined;
      setGlobalHandler?: (cb: (error: unknown, isFatal?: boolean) => void) => void;
    };
  };
  const errorUtils = globalWithErrorUtils.ErrorUtils;
  if (!errorUtils?.setGlobalHandler) return;

  try {
    const previousHandler = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error, isFatal) => {
      if (!hasRenderedOnce) {
        trackStartupEvent("crash_before_render", {
          reason: isFatal ? "fatal_js_exception" : "js_exception",
          durationMs: getElapsedSinceStart(),
        });
      }
      previousHandler?.(error, isFatal);
    });
    handlerInstalled = true;
  } catch (e) {
    logger.warn("[startupTelemetry] failed to install crash-before-render handler", e);
  }
}
