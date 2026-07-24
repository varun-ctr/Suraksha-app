-- 006_referential_integrity.sql
--
-- P0 fix: every foreign key to `auth.users` was dropped during
-- MIGRATE_FIREBASE_AUTH.sql (Firebase uids can't satisfy a UUID FK to
-- Supabase's own auth.users table) and never replaced — since then there has
-- been ZERO database-level referential integrity for any user-scoped table.
-- Nothing stops an orphaned sos_events/journeys/live_sessions/
-- notification_tokens/community_reports/emergency_contacts/subscriptions row
-- from existing, and nothing cascades a delete.
--
-- ── Design: a self-healing `app_users` bridge table ─────────────────────
-- There is no Firebase-backed users table in Postgres to reference (Firebase
-- Auth is a separate system from Supabase — see
-- docs/backend-audit/disaster-recovery-plan.md). Reusing `profiles` directly
-- as the FK target was considered and rejected: `profiles` rows are created
-- by app code (features/profile/hooks/useWalkthroughScreen.ts calling
-- db.profiles.upsert), not guaranteed to exist before a user's first
-- sos_events/journeys/etc. row — an FK straight to profiles could then reject
-- a perfectly legitimate first-write.
--
-- Instead: a minimal `public.app_users (id TEXT PRIMARY KEY)` table, kept in
-- sync automatically by a BEFORE INSERT trigger on every user-scoped table
-- that does `INSERT ... ON CONFLICT (id) DO NOTHING` for that row's owning
-- Firebase uid before the row itself is inserted. This guarantees the FK
-- target always exists at the moment it's needed, for ANY table, in
-- whatever order the app happens to write them — zero mobile-code changes
-- required.
--
-- Every user-scoped table then gets `user_id (or id) REFERENCES
-- app_users(id) ON DELETE CASCADE`. Documented relationship list:
--
--   app_users(id)  <── profiles.id                  ON DELETE CASCADE
--   app_users(id)  <── sos_events.user_id            ON DELETE CASCADE
--   app_users(id)  <── journeys.user_id              ON DELETE CASCADE
--   app_users(id)  <── community_reports.user_id     ON DELETE CASCADE
--   app_users(id)  <── subscriptions.user_id         ON DELETE CASCADE
--   app_users(id)  <── notification_tokens.user_id   ON DELETE CASCADE
--   app_users(id)  <── live_sessions.user_id         ON DELETE CASCADE
--   app_users(id)  <── emergency_contacts.user_id    ON DELETE CASCADE
--
-- This does not change today's multi-step, client-driven account-deletion
-- flow (out of this migration's scope — see BE-P0-3 in
-- docs/backend-audit/technical-debt-report.md) but makes it strictly safer:
-- a future single `DELETE FROM app_users WHERE id = ?` would now cascade
-- every one of these tables atomically in one statement, which was
-- previously structurally impossible (there was nothing to cascade from).
--
-- ── Migration safety on an existing production table ────────────────────
-- 1. Backfill `app_users` from every distinct id/user_id already present
--    across all eight tables, BEFORE adding any FK — otherwise the FK
--    validation step would fail on any pre-existing row.
-- 2. Add each FK as `NOT VALID` first (an ADD CONSTRAINT ... NOT VALID takes
--    only a brief metadata lock and does not scan/lock the table), then
--    VALIDATE CONSTRAINT separately (scans without blocking concurrent
--    writes) — the standard safe pattern for adding a FK to a live,
--    already-populated table.
--
-- Idempotent and safe to re-run. Reversible: see rollback block at the end.

BEGIN;

-- ── 1. Bridge table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_users (
  id         TEXT        PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.app_users IS
  'Self-healing bridge table standing in for a Firebase-backed auth.users equivalent. Populated automatically by ensure_app_user_from_user_id()/ensure_app_user_from_id() BEFORE INSERT triggers on every user-scoped table — never written to directly by application code. Exists solely so every other table can carry a real FK + ON DELETE CASCADE against something, since Firebase Auth (a separate system from Supabase) has no representation in this database.';

-- ── 2. Backfill from every existing table BEFORE adding FKs ─────────────
INSERT INTO public.app_users (id)
SELECT id FROM public.profiles
UNION
SELECT user_id FROM public.sos_events
UNION
SELECT user_id FROM public.journeys
UNION
SELECT user_id FROM public.community_reports
UNION
SELECT user_id FROM public.subscriptions
UNION
SELECT user_id FROM public.notification_tokens
UNION
SELECT user_id FROM public.live_sessions
UNION
SELECT user_id FROM public.emergency_contacts
ON CONFLICT (id) DO NOTHING;

-- ── 3. Self-healing triggers ──────────────────────────────────────────
-- SECURITY DEFINER + pinned search_path (mirrors the existing convention in
-- api-server/migrations/001 and 003) so these run with predictable
-- privileges regardless of the calling role's own grants on app_users.
CREATE OR REPLACE FUNCTION public.ensure_app_user_from_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.app_users (id) VALUES (NEW.user_id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_app_user_from_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.app_users (id) VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_app_user_from_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_app_user_from_id() FROM PUBLIC;

DROP TRIGGER IF EXISTS ensure_app_user ON public.profiles;
CREATE TRIGGER ensure_app_user BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_app_user_from_id();

DROP TRIGGER IF EXISTS ensure_app_user ON public.sos_events;
CREATE TRIGGER ensure_app_user BEFORE INSERT ON public.sos_events
  FOR EACH ROW EXECUTE FUNCTION public.ensure_app_user_from_user_id();

DROP TRIGGER IF EXISTS ensure_app_user ON public.journeys;
CREATE TRIGGER ensure_app_user BEFORE INSERT ON public.journeys
  FOR EACH ROW EXECUTE FUNCTION public.ensure_app_user_from_user_id();

DROP TRIGGER IF EXISTS ensure_app_user ON public.community_reports;
CREATE TRIGGER ensure_app_user BEFORE INSERT ON public.community_reports
  FOR EACH ROW EXECUTE FUNCTION public.ensure_app_user_from_user_id();

DROP TRIGGER IF EXISTS ensure_app_user ON public.subscriptions;
CREATE TRIGGER ensure_app_user BEFORE INSERT ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.ensure_app_user_from_user_id();

DROP TRIGGER IF EXISTS ensure_app_user ON public.notification_tokens;
CREATE TRIGGER ensure_app_user BEFORE INSERT ON public.notification_tokens
  FOR EACH ROW EXECUTE FUNCTION public.ensure_app_user_from_user_id();

DROP TRIGGER IF EXISTS ensure_app_user ON public.live_sessions;
CREATE TRIGGER ensure_app_user BEFORE INSERT ON public.live_sessions
  FOR EACH ROW EXECUTE FUNCTION public.ensure_app_user_from_user_id();

DROP TRIGGER IF EXISTS ensure_app_user ON public.emergency_contacts;
CREATE TRIGGER ensure_app_user BEFORE INSERT ON public.emergency_contacts
  FOR EACH ROW EXECUTE FUNCTION public.ensure_app_user_from_user_id();

-- ── 4. Foreign keys, added NOT VALID then validated separately (safe on a
--       live, already-populated table — no long-held table lock) ────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_app_user_fkey') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_app_user_fkey FOREIGN KEY (id)
      REFERENCES public.app_users(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sos_events_app_user_fkey') THEN
    ALTER TABLE public.sos_events
      ADD CONSTRAINT sos_events_app_user_fkey FOREIGN KEY (user_id)
      REFERENCES public.app_users(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'journeys_app_user_fkey') THEN
    ALTER TABLE public.journeys
      ADD CONSTRAINT journeys_app_user_fkey FOREIGN KEY (user_id)
      REFERENCES public.app_users(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_reports_app_user_fkey') THEN
    ALTER TABLE public.community_reports
      ADD CONSTRAINT community_reports_app_user_fkey FOREIGN KEY (user_id)
      REFERENCES public.app_users(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_app_user_fkey') THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_app_user_fkey FOREIGN KEY (user_id)
      REFERENCES public.app_users(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_tokens_app_user_fkey') THEN
    ALTER TABLE public.notification_tokens
      ADD CONSTRAINT notification_tokens_app_user_fkey FOREIGN KEY (user_id)
      REFERENCES public.app_users(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'live_sessions_app_user_fkey') THEN
    ALTER TABLE public.live_sessions
      ADD CONSTRAINT live_sessions_app_user_fkey FOREIGN KEY (user_id)
      REFERENCES public.app_users(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'emergency_contacts_app_user_fkey') THEN
    ALTER TABLE public.emergency_contacts
      ADD CONSTRAINT emergency_contacts_app_user_fkey FOREIGN KEY (user_id)
      REFERENCES public.app_users(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

ALTER TABLE public.profiles             VALIDATE CONSTRAINT profiles_app_user_fkey;
ALTER TABLE public.sos_events           VALIDATE CONSTRAINT sos_events_app_user_fkey;
ALTER TABLE public.journeys             VALIDATE CONSTRAINT journeys_app_user_fkey;
ALTER TABLE public.community_reports    VALIDATE CONSTRAINT community_reports_app_user_fkey;
ALTER TABLE public.subscriptions        VALIDATE CONSTRAINT subscriptions_app_user_fkey;
ALTER TABLE public.notification_tokens  VALIDATE CONSTRAINT notification_tokens_app_user_fkey;
ALTER TABLE public.live_sessions        VALIDATE CONSTRAINT live_sessions_app_user_fkey;
ALTER TABLE public.emergency_contacts   VALIDATE CONSTRAINT emergency_contacts_app_user_fkey;

COMMIT;

-- ── Rollback ──────────────────────────────────────────────────────────────
-- BEGIN;
--   ALTER TABLE public.profiles            DROP CONSTRAINT IF EXISTS profiles_app_user_fkey;
--   ALTER TABLE public.sos_events           DROP CONSTRAINT IF EXISTS sos_events_app_user_fkey;
--   ALTER TABLE public.journeys             DROP CONSTRAINT IF EXISTS journeys_app_user_fkey;
--   ALTER TABLE public.community_reports    DROP CONSTRAINT IF EXISTS community_reports_app_user_fkey;
--   ALTER TABLE public.subscriptions        DROP CONSTRAINT IF EXISTS subscriptions_app_user_fkey;
--   ALTER TABLE public.notification_tokens  DROP CONSTRAINT IF EXISTS notification_tokens_app_user_fkey;
--   ALTER TABLE public.live_sessions        DROP CONSTRAINT IF EXISTS live_sessions_app_user_fkey;
--   ALTER TABLE public.emergency_contacts   DROP CONSTRAINT IF EXISTS emergency_contacts_app_user_fkey;
--   DROP TRIGGER IF EXISTS ensure_app_user ON public.profiles;
--   DROP TRIGGER IF EXISTS ensure_app_user ON public.sos_events;
--   DROP TRIGGER IF EXISTS ensure_app_user ON public.journeys;
--   DROP TRIGGER IF EXISTS ensure_app_user ON public.community_reports;
--   DROP TRIGGER IF EXISTS ensure_app_user ON public.subscriptions;
--   DROP TRIGGER IF EXISTS ensure_app_user ON public.notification_tokens;
--   DROP TRIGGER IF EXISTS ensure_app_user ON public.live_sessions;
--   DROP TRIGGER IF EXISTS ensure_app_user ON public.emergency_contacts;
--   DROP FUNCTION IF EXISTS public.ensure_app_user_from_user_id();
--   DROP FUNCTION IF EXISTS public.ensure_app_user_from_id();
--   DROP TABLE IF EXISTS public.app_users;
-- COMMIT;
