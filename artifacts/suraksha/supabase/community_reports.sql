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

-- NOTE: the API server (api-server/src/routes/community-reports.ts) writes
-- and reads this table using SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS
-- entirely — it does NOT need, and must NEVER be granted, access via the
-- `anon` role. A previous version of this file granted `anon` unauthenticated
-- SELECT/INSERT (`USING (true)` / `WITH CHECK (true)`) to support that same
-- server-side path; since the anon/publishable key is bundled in the mobile
-- app and is not a secret, that grant let anyone extracting the key read
-- every user's safety-incident reports and insert forged ones. See
-- api-server/migrations/004_community_reports_rls_hardening.sql for the
-- migration that removes this from already-deployed databases.
--
-- The only policies this table needs are the owner-scoped `authenticated`
-- ones below, which mirror MIGRATE_FIREBASE_AUTH.sql exactly (defined here
-- too so a brand-new database ends up correct even if that file is run out
-- of order).
DROP POLICY IF EXISTS anon_server_insert ON community_reports;
DROP POLICY IF EXISTS anon_server_select ON community_reports;
REVOKE INSERT, SELECT ON community_reports FROM anon;

DROP POLICY IF EXISTS "community_reports: auth read" ON community_reports;
CREATE POLICY "community_reports: auth read"
  ON community_reports FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "community_reports: owner insert" ON community_reports;
CREATE POLICY "community_reports: owner insert"
  ON community_reports FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt() ->> 'sub') = user_id);

DROP POLICY IF EXISTS "community_reports: owner update" ON community_reports;
CREATE POLICY "community_reports: owner update"
  ON community_reports FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt() ->> 'sub') = user_id);

DROP POLICY IF EXISTS "community_reports: owner delete" ON community_reports;
CREATE POLICY "community_reports: owner delete"
  ON community_reports FOR DELETE TO authenticated
  USING ((SELECT auth.jwt() ->> 'sub') = user_id);

GRANT INSERT, SELECT, UPDATE, DELETE ON community_reports TO authenticated;

-- ============================================================
-- Supabase Storage bucket for report photos (run separately)
-- ============================================================
-- In Supabase Dashboard → Storage → New bucket → name: community-reports
-- Set to Public bucket (so photo URLs are publicly readable)
-- OR run:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('community-reports', 'community-reports', true)
-- ON CONFLICT (id) DO NOTHING;
