-- 003_cleanup_jobs.sql
--
-- Scheduled cleanup of expired rows in the ephemeral operational tables from
-- 001 (sos_idempotency_cache, rate_limit_counters) and 002 (email_otp_codes).
-- All three are already read-filtered by expires_at, so stale rows are inert —
-- this just stops them accumulating forever (the TODOs left in 001/002).
--
-- Idempotent and safe to re-run: the function is CREATE OR REPLACE, and each
-- job is unscheduled (if present) before being re-created.
--
-- Requires the pg_cron extension. On Supabase, enable it once under
-- Dashboard -> Database -> Extensions (or the CREATE EXTENSION below, which
-- needs sufficient privileges). If pg_cron is unavailable, the cleanup
-- FUNCTION is still created and can be invoked manually or from an external
-- scheduler:  SELECT public.cleanup_expired_operational_rows();

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- One function that purges all three tables; SECURITY DEFINER + pinned
-- search_path so the scheduled job runs with predictable privileges.
CREATE OR REPLACE FUNCTION public.cleanup_expired_operational_rows()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.sos_idempotency_cache WHERE expires_at < NOW();
  DELETE FROM public.rate_limit_counters   WHERE expires_at < NOW();
  DELETE FROM public.email_otp_codes       WHERE expires_at < NOW();
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_expired_operational_rows() FROM PUBLIC;

-- Schedule it every 15 minutes. Unschedule first so re-running this file
-- doesn't create duplicate jobs (cron.unschedule errors if the job is absent,
-- so guard it).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup_expired_operational_rows') THEN
    PERFORM cron.unschedule('cleanup_expired_operational_rows');
  END IF;
  PERFORM cron.schedule(
    'cleanup_expired_operational_rows',
    '*/15 * * * *',
    $cron$ SELECT public.cleanup_expired_operational_rows(); $cron$
  );
EXCEPTION WHEN undefined_table OR undefined_function OR insufficient_privilege THEN
  -- pg_cron not available/enabled in this environment — the cleanup function
  -- still exists and can be driven by an external scheduler instead.
  RAISE NOTICE 'pg_cron not available; skipped scheduling. Call public.cleanup_expired_operational_rows() from an external scheduler.';
END;
$$;
