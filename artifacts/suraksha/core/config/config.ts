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
  const missing = REQUIRED_VARS.filter(
    (key) => !process.env[key]?.trim(),
  ) as ConfigKey[];

  if (__DEV__ && missing.length > 0) {
    console.error(
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
      console.warn(
        "[Suraksha] Recommended config not set (feature will degrade, app still runs):\n" +
          warnings.map((k) => `  • ${k}`).join("\n"),
      );
    }
  }

  return { ok: missing.length === 0, missing };
}
