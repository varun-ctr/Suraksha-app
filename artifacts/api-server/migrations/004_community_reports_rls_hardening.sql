-- 004_community_reports_rls_hardening.sql
--
-- P0 fix: `supabase/community_reports.sql` (a separate, second SQL file from
-- DATABASE_SETUP.sql, both of which get run against the same table) grants
-- the `anon` Postgres role unauthenticated SELECT and INSERT on the entire
-- `community_reports` table:
--
--   CREATE POLICY anon_server_insert ON community_reports FOR INSERT TO anon WITH CHECK (true);
--   CREATE POLICY anon_server_select ON community_reports FOR SELECT TO anon USING (true);
--   GRANT INSERT, SELECT ON community_reports TO anon;
--
-- RLS policies are permissive by default (OR'd together per operation), so
-- these two anon policies stayed live and effective *alongside* the correct,
-- owner-scoped `authenticated`-role policies from MIGRATE_FIREBASE_AUTH.sql —
-- neither file ever dropped the other's policies. Since the Supabase
-- anon/publishable key is bundled inside the mobile app (by design — it is
-- not a secret, RLS is supposed to be the safety net), anyone extracting that
-- key could read every user's safety-incident reports (locations,
-- descriptions of harassment/stalking/unsafe areas) and insert forged ones,
-- entirely bypassing this app's own correct server-side Firebase-token
-- verification (api-server/src/routes/community-reports.ts) — that
-- verification is irrelevant to a caller willing to hit Supabase directly.
--
-- ── Before / after ───────────────────────────────────────────────────────
--
-- BEFORE (effective policy set on community_reports):
--   anon_server_insert              INSERT  TO anon           WITH CHECK (true)                          -- REMOVED by this migration
--   anon_server_select              SELECT  TO anon           USING (true)                                -- REMOVED by this migration
--   "community_reports: auth read"  SELECT  TO authenticated  USING (true)                                -- kept
--   "community_reports: owner insert" INSERT TO authenticated WITH CHECK (auth.jwt()->>'sub' = user_id)   -- kept
--   "community_reports: owner update" UPDATE TO authenticated USING (auth.jwt()->>'sub' = user_id)        -- kept
--   "community_reports: owner delete" DELETE TO authenticated USING (auth.jwt()->>'sub' = user_id)        -- kept
--   GRANT INSERT, SELECT ON community_reports TO anon;                                                    -- REVOKED by this migration
--
-- AFTER: only the four `authenticated`-role, ownership-scoped policies remain
-- in effect. No policy or grant targets `anon` on this table.
--
-- ── Why this is safe / zero functional impact ───────────────────────────
-- 1. The mobile app's own repository (repositories/supabase/supabaseClient.ts
--    `communityReports.*`) always calls Supabase with the currently
--    signed-in Firebase-authenticated session — every real client call
--    already goes through the `authenticated` role's policies, never `anon`.
-- 2. The backend's own route (api-server/src/routes/community-reports.ts)
--    prefers `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS entirely and
--    does not need — and never used — these anon grants.
-- 3. No moderator/admin role exists anywhere in this codebase today (no
--    separate RLS role, no client-side moderation UI calls
--    `communityReports.listAll()`) — the moderation queue in
--    supabaseClient.ts is unused dead code reachable only via a future
--    admin surface, which would run through the service-role key (as the
--    backend's other routes do) rather than needing its own anon/RLS grant.
--
-- Idempotent and safe to re-run (DROP POLICY/REVOKE IF EXISTS everywhere).
-- Reversible: see the rollback block at the end of this file.

BEGIN;

DROP POLICY IF EXISTS anon_server_insert ON public.community_reports;
DROP POLICY IF EXISTS anon_server_select ON public.community_reports;

REVOKE INSERT, SELECT ON public.community_reports FROM anon;

-- Re-assert the authoritative, owner-scoped policy set exactly as
-- MIGRATE_FIREBASE_AUTH.sql defined it, so this migration is a complete,
-- self-contained statement of the correct end state (safe to run against a
-- database that never ran that file too, or one where a policy was manually
-- edited since).
DROP POLICY IF EXISTS "community_reports: auth read" ON public.community_reports;
CREATE POLICY "community_reports: auth read" ON public.community_reports
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "community_reports: owner insert" ON public.community_reports;
CREATE POLICY "community_reports: owner insert" ON public.community_reports
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.jwt() ->> 'sub') = user_id);

DROP POLICY IF EXISTS "community_reports: owner update" ON public.community_reports;
CREATE POLICY "community_reports: owner update" ON public.community_reports
  FOR UPDATE TO authenticated USING ((SELECT auth.jwt() ->> 'sub') = user_id);

DROP POLICY IF EXISTS "community_reports: owner delete" ON public.community_reports;
CREATE POLICY "community_reports: owner delete" ON public.community_reports
  FOR DELETE TO authenticated USING ((SELECT auth.jwt() ->> 'sub') = user_id);

-- Confirm RLS itself is still enabled (defense against a future accidental
-- `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`, which would make every policy
-- above moot).
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ── Rollback ──────────────────────────────────────────────────────────────
-- Re-opens the anon hole this migration closes. Only run this if you are
-- deliberately reverting — there is no legitimate reason to in production.
--
-- BEGIN;
--   CREATE POLICY anon_server_insert ON public.community_reports FOR INSERT TO anon WITH CHECK (true);
--   CREATE POLICY anon_server_select ON public.community_reports FOR SELECT TO anon USING (true);
--   GRANT INSERT, SELECT ON public.community_reports TO anon;
-- COMMIT;
