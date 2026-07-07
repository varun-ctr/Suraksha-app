import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { optionalEnv } from "./env";
import { logger } from "./logger";

let client: SupabaseClient | null | undefined; // undefined = not yet attempted

/**
 * Lazily creates the service-role Supabase client (bypasses RLS — server-side
 * data cleanup/writes only, never expose to clients).
 *
 * Returns null if SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY aren't configured,
 * instead of throwing — a missing secret for this one integration should
 * degrade the specific routes that need it, not crash the whole process at
 * import time (previously each route called `requiredEnv()` for these two
 * vars independently, so a misconfigured/forgotten secret took down
 * unrelated routes, including SOS alerting, before the server ever started
 * listening).
 */
export function getServiceSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = optionalEnv("SUPABASE_URL");
  const key = optionalEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    logger.warn(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — routes that need " +
        "server-side Supabase access will report themselves as unconfigured " +
        "instead of using it.",
    );
    client = null;
    return null;
  }

  client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
