-- 009_retention_and_background_jobs.sql
--
-- P1 fix: two operational gaps identified in the backend audit
-- (docs/backend-audit/technical-debt-report.md BE-P1-3, and
-- docs/backend-audit/production-readiness-report.md's Background Processing
-- section):
--
--   1. No cleanup/retention job exists for `live_sessions` — unlike
--      sos_idempotency_cache/rate_limit_counters/email_otp_codes (already
--      cleaned up every 15 min by 003_cleanup_jobs.sql), live_sessions rows
--      accumulate forever. `expires_at` (the heartbeat field) only controls
--      whether a session is currently *shareable* — it is never itself a
--      deletion trigger, so an old, long-expired session's row just sits
--      there permanently.
--   2. No journey-deadline monitor exists — if the app is never reopened
--      after a journey's deadline+grace period passes, nothing server-side
--      ever notices or escalates (the client-side tick in
--      SafetyContext.tsx is the *only* thing that detects "overdue" today,
--      and it only runs while the JS engine is alive).
--
-- ── 1. live_sessions retention ───────────────────────────────────────────
-- Extends the existing cleanup_expired_operational_rows() function (rather
-- than adding a second job) to also purge live_sessions rows older than a
-- 30-day retention window. 30 days is deliberately generous and independent
-- of `expires_at`'s much shorter (heartbeat-scale) semantics — this is a
-- storage-growth control, not a correctness mechanism (correctness for
-- "is this session still live" is already fully handled by
-- get_live_session()'s own expires_at/is_active check).
--
-- ── 2. Journey deadline detection (SQL) + escalation (Edge Function) ────
-- Splits responsibility, since SQL alone cannot send an SMS:
--   - `journey_escalations` — a small, purely-additive table (mirrors the
--     existing operational-table pattern from 001/002) recording which
--     overdue journeys the SERVER has already escalated, so a re-run of the
--     detection query never double-alerts the same journey twice.
--   - `get_overdue_journeys()` — a SECURITY DEFINER function a companion
--     Edge Function calls (see supabase/functions/journey-deadline-check/
--     index.ts, a new deliverable file alongside this migration) to find
--     journeys whose deadline + grace period has passed with no check-in
--     and no prior server escalation.
--
-- Deliberately does NOT add deadline_at/outcome/escalation_reason columns to
-- `journeys` itself, unlike the fuller schema
-- docs/journey-audit/backend-contract.md originally sketched — the deadline
-- is fully computable from already-existing columns
-- (`started_at + duration_minutes`), and "already escalated" is tracked in
-- the new sibling table instead. This keeps the safety-critical `journeys`
-- table itself untouched and requires ZERO mobile-app code changes, at the
-- cost of not (yet) letting the server distinguish *why* a journey ended —
-- an acceptable trade-off since the mobile client already tracks that
-- locally (domain/entities/JourneyOutcome.ts) and this monitor exists purely
-- as a backstop for the case where the client-side mechanism never got to
-- run at all.
--
-- The grace period (60 seconds) is hardcoded below to match
-- OVERDUE_GRACE_SEC in features/sos/context/SafetyContext.tsx — if that
-- constant ever changes, update it here too (documented in
-- docs/backend-hardening/06-Background-Jobs.md).
--
-- Idempotent and safe to re-run. Reversible: see rollback block at the end.

BEGIN;

-- ── 1. Extend the existing cleanup function ─────────────────────────────
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
  DELETE FROM public.live_sessions         WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- ── 2. Journey deadline monitor: detection table + function ────────────
CREATE TABLE IF NOT EXISTS public.journey_escalations (
  journey_id    UUID        PRIMARY KEY REFERENCES public.journeys(id) ON DELETE CASCADE,
  escalated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.journey_escalations IS
  'One row per journey the server-side deadline monitor (supabase/functions/journey-deadline-check) has already escalated. Existence of a row is the sole idempotency guard against re-alerting the same overdue journey on a later cron run.';

CREATE OR REPLACE FUNCTION public.get_overdue_journeys()
RETURNS TABLE (
  journey_id   UUID,
  user_id      TEXT,
  started_at   TIMESTAMPTZ,
  deadline_at  TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    j.id,
    j.user_id,
    j.started_at,
    j.started_at + (j.duration_minutes * INTERVAL '1 minute') AS deadline_at
  FROM public.journeys j
  LEFT JOIN public.journey_escalations je ON je.journey_id = j.id
  WHERE j.ended_at IS NULL
    AND j.duration_minutes IS NOT NULL
    AND je.journey_id IS NULL
    -- 60s grace period matches OVERDUE_GRACE_SEC in SafetyContext.tsx.
    AND j.started_at + (j.duration_minutes * INTERVAL '1 minute') + INTERVAL '60 seconds' < NOW();
$$;

REVOKE ALL ON FUNCTION public.get_overdue_journeys() FROM PUBLIC;
-- Only the service role (used by the Edge Function) may call this — it
-- returns other users' user_id values, which must never be exposed to a
-- regular authenticated client.

COMMIT;

-- ── Scheduling ────────────────────────────────────────────────────────────
-- cleanup_expired_operational_rows() is already scheduled every 15 minutes
-- by 003_cleanup_jobs.sql — no new cron entry needed for the live_sessions
-- retention addition.
--
-- get_overdue_journeys() is NOT scheduled by this file. Journey grace
-- periods are measured in tens of seconds (OVERDUE_GRACE_SEC = 60), so this
-- monitor needs to run on a much shorter interval (recommended: every
-- 1 minute) than pg_cron's own coarser scheduling is typically used for.
-- Rather than wiring pg_cron + the pg_net extension to make an HTTP call
-- out to an Edge Function from inside Postgres (which would require
-- hardcoding a project-specific Edge Function URL and a shared secret into
-- a checked-in SQL file — not appropriate for a migration), schedule
-- supabase/functions/journey-deadline-check directly as a Supabase
-- Scheduled Edge Function (Dashboard → Edge Functions → your function →
-- Cron, or `schedule` in supabase/config.toml) at "* * * * *" (every
-- minute). See docs/backend-hardening/06-Background-Jobs.md and
-- 08-Migration-Guide.md for the exact deployment steps.

-- ── Rollback ──────────────────────────────────────────────────────────────
-- BEGIN;
--   DROP FUNCTION IF EXISTS public.get_overdue_journeys();
--   DROP TABLE IF EXISTS public.journey_escalations;
--   -- Reverts cleanup_expired_operational_rows() to its pre-009 definition
--   -- (from 003_cleanup_jobs.sql), i.e. without the live_sessions DELETE:
--   CREATE OR REPLACE FUNCTION public.cleanup_expired_operational_rows()
--   RETURNS void
--   LANGUAGE plpgsql
--   SECURITY DEFINER
--   SET search_path = public
--   AS $$
--   BEGIN
--     DELETE FROM public.sos_idempotency_cache WHERE expires_at < NOW();
--     DELETE FROM public.rate_limit_counters   WHERE expires_at < NOW();
--     DELETE FROM public.email_otp_codes       WHERE expires_at < NOW();
--   END;
--   $$;
-- COMMIT;
