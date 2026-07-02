-- =============================================================================
-- Suraksha — Migrate the Supabase data layer from Supabase Auth to Firebase Auth
-- =============================================================================
--
-- WHY: The app now authenticates with Firebase. Firebase user ids are strings
-- (not UUIDs), and the client talks to Supabase with the anon key while passing
-- the Firebase ID token. The old schema modelled `user_id` as
-- `UUID REFERENCES auth.users(id)` with RLS keyed on `auth.uid()`, which can
-- never match a Firebase user — so every client read/write was denied.
--
-- This migration:
--   1. Drops the foreign keys to `auth.users`.
--   2. Converts the id / user_id columns from UUID to TEXT (Firebase uid).
--   3. Rewrites every RLS policy to authorize on the Firebase uid, read from
--      the verified JWT as `auth.jwt() ->> 'sub'` (NOT `auth.uid()`, which
--      casts `sub` to uuid and would error on a Firebase uid).
--   4. Removes the dead `auth.users` signup trigger.
--
-- ⚠️ PREREQUISITE (one-time, in the Supabase Dashboard — cannot be done in SQL):
--   Authentication → Sign In / Providers → Third-Party Auth → add **Firebase**
--   and enter your Firebase project id. This makes Supabase trust the Firebase
--   ID token the app sends and assign it the `authenticated` role. Until this is
--   configured, the token is rejected and RLS denies everything.
--
-- HOW TO RUN (Supabase Dashboard → SQL Editor):
--   • Existing database: run this file once.
--   • Brand-new database: run DATABASE_SETUP.sql and supabase/emergency_contacts.sql
--     first (to create the tables), then run this file.
--   Safe to re-run (idempotent: IF EXISTS / USING casts / DROP-then-CREATE).
-- =============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. Remove the Supabase-Auth signup trigger (Firebase users never touch
--    auth.users, so it can never fire). Profiles are created by the app.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 1. PROFILES  (owner id = Firebase uid)
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ALTER COLUMN id TYPE TEXT USING id::text;

DROP POLICY IF EXISTS "profiles: owner read"  ON public.profiles;
DROP POLICY IF EXISTS "profiles: owner write" ON public.profiles;
DROP POLICY IF EXISTS "profiles: owner all"   ON public.profiles;
CREATE POLICY "profiles: owner all" ON public.profiles
  FOR ALL TO authenticated
  USING      ((SELECT auth.jwt() ->> 'sub') = id)
  WITH CHECK ((SELECT auth.jwt() ->> 'sub') = id);

-- ----------------------------------------------------------------------------
-- 2. EMERGENCY CONTACTS
-- ----------------------------------------------------------------------------
ALTER TABLE public.emergency_contacts DROP CONSTRAINT IF EXISTS emergency_contacts_user_id_fkey;
ALTER TABLE public.emergency_contacts ALTER COLUMN user_id TYPE TEXT USING user_id::text;

DROP POLICY IF EXISTS users_manage_own_contacts       ON public.emergency_contacts;
DROP POLICY IF EXISTS "emergency_contacts: owner all" ON public.emergency_contacts;
CREATE POLICY "emergency_contacts: owner all" ON public.emergency_contacts
  FOR ALL TO authenticated
  USING      ((SELECT auth.jwt() ->> 'sub') = user_id)
  WITH CHECK ((SELECT auth.jwt() ->> 'sub') = user_id);

-- ----------------------------------------------------------------------------
-- 3. SOS EVENTS
-- ----------------------------------------------------------------------------
ALTER TABLE public.sos_events DROP CONSTRAINT IF EXISTS sos_events_user_id_fkey;
ALTER TABLE public.sos_events ALTER COLUMN user_id TYPE TEXT USING user_id::text;

DROP POLICY IF EXISTS "sos_events: owner only" ON public.sos_events;
CREATE POLICY "sos_events: owner only" ON public.sos_events
  FOR ALL TO authenticated
  USING      ((SELECT auth.jwt() ->> 'sub') = user_id)
  WITH CHECK ((SELECT auth.jwt() ->> 'sub') = user_id);

-- ----------------------------------------------------------------------------
-- 4. JOURNEYS
-- ----------------------------------------------------------------------------
ALTER TABLE public.journeys DROP CONSTRAINT IF EXISTS journeys_user_id_fkey;
ALTER TABLE public.journeys ALTER COLUMN user_id TYPE TEXT USING user_id::text;

DROP POLICY IF EXISTS "journeys: owner only" ON public.journeys;
CREATE POLICY "journeys: owner only" ON public.journeys
  FOR ALL TO authenticated
  USING      ((SELECT auth.jwt() ->> 'sub') = user_id)
  WITH CHECK ((SELECT auth.jwt() ->> 'sub') = user_id);

-- ----------------------------------------------------------------------------
-- 5. COMMUNITY REPORTS  (any signed-in user reads; only the owner writes)
-- ----------------------------------------------------------------------------
ALTER TABLE public.community_reports DROP CONSTRAINT IF EXISTS community_reports_user_id_fkey;
ALTER TABLE public.community_reports ALTER COLUMN user_id TYPE TEXT USING user_id::text;

DROP POLICY IF EXISTS "community_reports: auth read"     ON public.community_reports;
CREATE POLICY "community_reports: auth read" ON public.community_reports
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "community_reports: owner insert"  ON public.community_reports;
CREATE POLICY "community_reports: owner insert" ON public.community_reports
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.jwt() ->> 'sub') = user_id);

DROP POLICY IF EXISTS "community_reports: owner update"  ON public.community_reports;
CREATE POLICY "community_reports: owner update" ON public.community_reports
  FOR UPDATE TO authenticated USING ((SELECT auth.jwt() ->> 'sub') = user_id);

DROP POLICY IF EXISTS "community_reports: owner delete"  ON public.community_reports;
CREATE POLICY "community_reports: owner delete" ON public.community_reports
  FOR DELETE TO authenticated USING ((SELECT auth.jwt() ->> 'sub') = user_id);

-- ----------------------------------------------------------------------------
-- 6. SUBSCRIPTIONS
-- ----------------------------------------------------------------------------
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;
ALTER TABLE public.subscriptions ALTER COLUMN user_id TYPE TEXT USING user_id::text;

DROP POLICY IF EXISTS "subscriptions: owner only" ON public.subscriptions;
CREATE POLICY "subscriptions: owner only" ON public.subscriptions
  FOR ALL TO authenticated
  USING      ((SELECT auth.jwt() ->> 'sub') = user_id)
  WITH CHECK ((SELECT auth.jwt() ->> 'sub') = user_id);

-- ----------------------------------------------------------------------------
-- 7. NOTIFICATION TOKENS
-- ----------------------------------------------------------------------------
ALTER TABLE public.notification_tokens DROP CONSTRAINT IF EXISTS notification_tokens_user_id_fkey;
ALTER TABLE public.notification_tokens ALTER COLUMN user_id TYPE TEXT USING user_id::text;

DROP POLICY IF EXISTS "notification_tokens: owner only" ON public.notification_tokens;
CREATE POLICY "notification_tokens: owner only" ON public.notification_tokens
  FOR ALL TO authenticated
  USING      ((SELECT auth.jwt() ->> 'sub') = user_id)
  WITH CHECK ((SELECT auth.jwt() ->> 'sub') = user_id);

-- ----------------------------------------------------------------------------
-- 8. LIVE SESSIONS  (owner reads/writes; public share lookups still go through
--    the SECURITY DEFINER get_live_session() function — unchanged.)
-- ----------------------------------------------------------------------------
ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_user_id_fkey;
ALTER TABLE public.live_sessions ALTER COLUMN user_id TYPE TEXT USING user_id::text;

DROP POLICY IF EXISTS "live_sessions: owner all" ON public.live_sessions;
CREATE POLICY "live_sessions: owner all" ON public.live_sessions
  FOR ALL TO authenticated
  USING      ((SELECT auth.jwt() ->> 'sub') = user_id)
  WITH CHECK ((SELECT auth.jwt() ->> 'sub') = user_id);

COMMIT;
