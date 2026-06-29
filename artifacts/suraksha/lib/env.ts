export function requiredPublicEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Environment variable ${name} is required but was not provided.`);
  }
  return value;
}

export function optionalPublicEnv(name: string): string | undefined {
  const value = process.env[name];
  return value?.trim() || undefined;
}

export function getBackendUrl(): string {
  const backendUrl = requiredPublicEnv("EXPO_PUBLIC_BACKEND_URL");
  return backendUrl.replace(/\/+$/, "");
}
