export function requiredPublicEnv(name: string, fallback = ""): string {
  const value = process.env[name]?.trim();
  return value || fallback;
}

export function optionalPublicEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

/**
 * The configured backend base URL, or "" when unset. Callers must treat an
 * empty string as "no backend" and skip the request — returning a placeholder
 * like "https://example.com" would fire real requests at a bogus host.
 */
export function getBackendUrl(): string {
  const backendUrl = optionalPublicEnv("EXPO_PUBLIC_BACKEND_URL");
  return backendUrl ? backendUrl.replace(/\/+$/, "") : "";
}
