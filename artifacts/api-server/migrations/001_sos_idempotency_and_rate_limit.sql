-- ============================================================
-- SOS idempotency + rate-limit shared state
--
-- Both replace in-memory Maps that only worked correctly on a single
-- backend process. Under Replit's autoscale deployment (multiple
-- independent instances, no shared memory), an in-memory idempotency
-- cache lets a client retry land on a different instance than the
-- original request and re-send a duplicate emergency SMS via Twilio.
-- This migration moves both to Supabase so every instance shares the
-- same view of "has this already been processed" / "how many requests
-- has this user made this window."
--
-- Run this against your Supabase project (SQL Editor, or via the CLI)
-- before deploying the api-server code that depends on it.
-- ============================================================

-- ── SOS alert idempotency cache ──────────────────────────────────────────────
-- Keyed by the client-generated idempotency key sent with /sos/alert. A
-- retry carrying the same key returns the cached result instead of
-- re-sending SMS. Server-side only — RLS with no policies denies all
-- anon/authenticated access; only the service-role key (used exclusively
-- by the backend) can read or write this table.
CREATE TABLE IF NOT EXISTS public.sos_idempotency_cache (
  key         TEXT PRIMARY KEY,
  result      JSONB NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sos_idempotency_cache_expires_at_idx
  ON public.sos_idempotency_cache (expires_at);

ALTER TABLE public.sos_idempotency_cache ENABLE ROW LEVEL SECURITY;

-- ── Rate-limit counters ───────────────────────────────────────────────────────
-- Fixed-window counter shared across instances, incremented atomically via
-- the RPC function below. bucket_key is "<route>:<uid>:<window_start_epoch>".
-- Server-side only, same RLS posture as above.
CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  bucket_key  TEXT PRIMARY KEY,
  count       INT NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS rate_limit_counters_expires_at_idx
  ON public.rate_limit_counters (expires_at);

ALTER TABLE public.rate_limit_counters ENABLE ROW LEVEL SECURITY;

-- Atomic increment-and-return-count: a plain upsert can't both increment an
-- existing counter and read back the new value in one round trip without a
-- race between concurrent requests for the same user; INSERT ... ON
-- CONFLICT ... RETURNING is a single atomic statement in Postgres.
CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_bucket_key TEXT,
  p_expires_at TIMESTAMPTZ
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  INSERT INTO public.rate_limit_counters (bucket_key, count, expires_at)
  VALUES (p_bucket_key, 1, p_expires_at)
  ON CONFLICT (bucket_key)
  DO UPDATE SET count = public.rate_limit_counters.count + 1
  RETURNING count INTO v_count;
  RETURN v_count;
END;
$$;

-- Only the backend's service-role key calls this function.
REVOKE EXECUTE ON FUNCTION public.increment_rate_limit(TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_rate_limit(TEXT, TIMESTAMPTZ) TO service_role;

-- ── Housekeeping ──────────────────────────────────────────────────────────────
-- Both tables are read-filtered by expires_at at query time, so stale rows
-- are never served — but nothing deletes them yet. If row count becomes a
-- concern, schedule a periodic cleanup (e.g. Supabase's pg_cron extension):
--   DELETE FROM public.sos_idempotency_cache WHERE expires_at < NOW();
--   DELETE FROM public.rate_limit_counters WHERE expires_at < NOW();
