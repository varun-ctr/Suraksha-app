import { getServiceSupabase } from "./supabaseAdmin";
import { logger } from "./logger";

export interface RateLimitOptions {
  /** Fixed-window size in seconds. */
  windowSeconds: number;
  /** Max requests allowed per user within one window. */
  limit: number;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
}

/**
 * Fixed-window rate limit shared across autoscale instances via a Supabase
 * counter table (see migrations/001_sos_idempotency_and_rate_limit.sql) —
 * an in-memory counter would only limit requests landing on the same
 * process, undercounting real usage by however many instances are running.
 *
 * Fails OPEN (allows the request) if Supabase isn't configured or the RPC
 * call errors: a rate limiter that blocks legitimate traffic during an
 * outage is worse than one that temporarily stops limiting, especially for
 * `/sos/alert`.
 */
export async function checkRateLimit(
  route: string,
  uid: string,
  { windowSeconds, limit }: RateLimitOptions,
): Promise<RateLimitResult> {
  const supabase = getServiceSupabase();
  if (!supabase) return { allowed: true, count: 0 };

  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
  const bucketKey = `${route}:${uid}:${windowStart}`;
  // Keep the row around for one extra window past its own expiry so a
  // slightly-clock-skewed read never races a delete; cheap given cleanup is
  // just a WHERE filter, not a hot path.
  const expiresAt = new Date((windowStart + windowSeconds * 2) * 1000).toISOString();

  try {
    const { data, error } = await supabase.rpc("increment_rate_limit", {
      p_bucket_key: bucketKey,
      p_expires_at: expiresAt,
    });
    if (error) throw error;
    const count = data as number;
    return { allowed: count <= limit, count };
  } catch (err) {
    logger.warn({ err, route, uid }, "Rate limit check failed — failing open");
    return { allowed: true, count: 0 };
  }
}
