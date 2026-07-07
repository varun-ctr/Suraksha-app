-- ============================================================
-- community_reports table — Suraksha safety app
-- Run once in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

CREATE TABLE IF NOT EXISTS community_reports (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT         NOT NULL,          -- Firebase UID (text, not auth.users UUID)
  type              TEXT         NOT NULL,
  lat               DOUBLE PRECISION NOT NULL,
  lng               DOUBLE PRECISION NOT NULL,
  address           TEXT,
  description       TEXT,
  photo_url         TEXT,
  moderation_status TEXT         NOT NULL DEFAULT 'pending',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE community_reports ENABLE ROW LEVEL SECURITY;

-- The API server uses the anon key to insert (no Firebase JWT needed on server side).
-- This policy allows server-side inserts via the anon role.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'community_reports' AND policyname = 'anon_server_insert'
  ) THEN
    CREATE POLICY anon_server_insert
      ON community_reports FOR INSERT TO anon
      WITH CHECK (true);
  END IF;
END $$;

-- Allow the anon role to SELECT (for the /mine list endpoint)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'community_reports' AND policyname = 'anon_server_select'
  ) THEN
    CREATE POLICY anon_server_select
      ON community_reports FOR SELECT TO anon
      USING (true);
  END IF;
END $$;

-- Grant table permissions to the anon role
GRANT INSERT, SELECT ON community_reports TO anon;
GRANT INSERT, SELECT ON community_reports TO authenticated;

-- ============================================================
-- Supabase Storage bucket for report photos (run separately)
-- ============================================================
-- In Supabase Dashboard → Storage → New bucket → name: community-reports
-- Set to Public bucket (so photo URLs are publicly readable)
-- OR run:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('community-reports', 'community-reports', true)
-- ON CONFLICT (id) DO NOTHING;
