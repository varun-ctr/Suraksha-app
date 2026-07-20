-- Run this once in your Supabase SQL Editor:
-- Dashboard → SQL Editor → New query → paste → Run
--
-- NOTE: creates the original Supabase-Auth schema. The app uses Firebase Auth,
-- so afterwards run MIGRATE_FIREBASE_AUTH.sql to convert user_id to the Firebase
-- uid (TEXT) and switch RLS to the Firebase `sub` claim.

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id         TEXT        NOT NULL,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  phone      TEXT        NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;

-- PostgreSQL does not support `CREATE POLICY IF NOT EXISTS`; drop-then-create
-- makes this idempotent and safe to re-run (consistent with community_reports.sql).
DROP POLICY IF EXISTS users_manage_own_contacts ON emergency_contacts;
CREATE POLICY users_manage_own_contacts
  ON emergency_contacts
  FOR ALL
  TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
