import { logger } from "@/core/logger/logger";
import { ValidationError } from "@/domain/errors";

const REQUIRED_VARS = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
] as const;

// Not required to boot, but a production/store build should have them. Missing
// ones degrade a specific feature (no crash reporting, blank native map, no
// purchases) rather than breaking the app — so these WARN, never block, so an
// in-emergency user is never locked out over a misconfigured release.
const RECOMMENDED_VARS = [
  "EXPO_PUBLIC_SENTRY_DSN",
  "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY",
  "EXPO_PUBLIC_REVENUECAT_IOS_KEY",
  "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY",
] as const;

const MAPS_PLACEHOLDER = "YOUR_GOOGLE_MAPS_API_KEY";

export type ConfigKey = (typeof REQUIRED_VARS)[number];

export interface ConfigValidation {
  ok: boolean;
  missing: ConfigKey[];
}

export function validateConfig(): ConfigValidation {
  // IMPORTANT: Each var must be accessed as a STATIC string literal
  // (process.env.FOO, not process.env[key]) so Metro's Babel plugin can
  // inline the value at bundle time. Dynamic computed access process.env[key]
  // is NOT inlined and returns undefined in the bundled app.
  const snapshot: Record<ConfigKey, string | undefined> = {
    EXPO_PUBLIC_SUPABASE_URL:                process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    EXPO_PUBLIC_FIREBASE_API_KEY:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    EXPO_PUBLIC_FIREBASE_PROJECT_ID:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    EXPO_PUBLIC_FIREBASE_APP_ID:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };

  const missing = (Object.keys(snapshot) as ConfigKey[]).filter(
    (key) => !snapshot[key]?.trim(),
  );

  if (__DEV__ && missing.length > 0) {
    logger.error(
      "[Suraksha] Missing required environment variables:\n" +
        missing.map((k) => `  • ${k}`).join("\n"),
    );
  }

  if (__DEV__) {
    const warnings = RECOMMENDED_VARS.filter((key) => !process.env[key]?.trim()) as string[];
    if (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() === MAPS_PLACEHOLDER) {
      warnings.push("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (still the placeholder value)");
    }
    if (warnings.length > 0) {
      logger.warn(
        "[Suraksha] Recommended config not set (feature will degrade, app still runs):\n" +
          warnings.map((k) => `  • ${k}`).join("\n"),
      );
    }
  }

  return { ok: missing.length === 0, missing };
}

/**
 * Fail-fast variant of validateConfig() for contexts that should hard-stop
 * rather than degrade gracefully — build/CI scripts, server-side tooling,
 * or tests. Throws a ValidationError synchronously when required env vars
 * are missing.
 *
 * The Expo Router app entry (app/_layout.tsx) deliberately does NOT use
 * this: it calls validateConfig() and renders ConfigErrorScreen instead of
 * crashing, since a hard native crash is worse UX than a clear in-app
 * message for a safety app. See docs/adr/0004-error-handling-strategy.md.
 */
export function assertConfig(): void {
  const result = validateConfig();
  if (!result.ok) {
    throw new ValidationError(
      `Missing required environment variables: ${result.missing.join(", ")}`,
      { field: result.missing[0] },
    );
  }
}
