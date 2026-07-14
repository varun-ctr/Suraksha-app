-- ============================================================
-- profiles.walkthrough_seen — Suraksha safety app
-- Run once in: Supabase Dashboard → SQL Editor → New query
--
-- Tracks whether an account has completed (or skipped) the post-login
-- feature walkthrough, so it shows exactly once per account — not once
-- per device, and not on every login. Idempotent: safe to re-run.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='profiles' AND column_name='walkthrough_seen') THEN
    ALTER TABLE public.profiles ADD COLUMN walkthrough_seen BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;
