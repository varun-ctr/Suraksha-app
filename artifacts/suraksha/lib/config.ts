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

  return { ok: missing.length === 0, missing };
}
