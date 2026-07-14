-- ============================================================
-- Email OTP codes
--
-- Backs the "sign in with a one-time code" flow (POST /auth/email-otp/request
-- and /auth/email-otp/verify). Only the code's hash is stored, never the
-- plaintext code. One pending code per email at a time — a new request
-- overwrites any previous one. Server-side only, same RLS posture as the
-- other tables in migration 001: RLS enabled, no policies, so only the
-- service-role key (used exclusively by the backend) can read or write.
--
-- Run this against your Supabase project (SQL Editor, or via the CLI)
-- before deploying the api-server code that depends on it.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_otp_codes (
  email       TEXT PRIMARY KEY,
  code_hash   TEXT NOT NULL,
  attempts    INT NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_otp_codes_expires_at_idx
  ON public.email_otp_codes (expires_at);

ALTER TABLE public.email_otp_codes ENABLE ROW LEVEL SECURITY;

-- ── Housekeeping ──────────────────────────────────────────────────────────────
-- Expired/used rows aren't deleted automatically — verify already checks
-- expires_at at read time, so a stale row is just inert. If row count
-- becomes a concern, schedule a periodic cleanup (e.g. Supabase's pg_cron
-- extension):
--   DELETE FROM public.email_otp_codes WHERE expires_at < NOW();
