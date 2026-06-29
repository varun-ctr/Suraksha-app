export function requiredPublicEnv(name: string, fallback = ""): string {
  const value = process.env[name]?.trim();
  return value || fallback;
}

export function optionalPublicEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function getBackendUrl(): string {
  const backendUrl = optionalPublicEnv("EXPO_PUBLIC_BACKEND_URL") ?? "https://example.com";
  return backendUrl.replace(/\/+$/, "");
}
