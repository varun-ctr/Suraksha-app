export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Environment variable ${name} is required but was not provided.`);
  }
  return value;
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value?.trim() || undefined;
}

export function parsePort(rawPort: string | undefined): number {
  if (!rawPort) {
    throw new Error("PORT environment variable is required but was not provided.");
  }

  const port = Number(rawPort);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  return port;
}

export function getAllowedOrigins(): string[] {
  const raw = optionalEnv("CORS_ALLOWED_ORIGINS");
  if (!raw) return [];
  return raw.split(",").map((value) => value.trim()).filter(Boolean);
}
