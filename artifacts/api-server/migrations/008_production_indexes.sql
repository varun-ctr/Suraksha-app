-- 008_production_indexes.sql
--
-- P1 fix: no table in this schema has a single explicitly-created index
-- beyond what a PRIMARY KEY/UNIQUE constraint creates implicitly. Postgres
-- does not automatically index foreign-key or filter columns, so every
-- `WHERE user_id = ?` query — nearly every query this app makes — is doing a
-- full table scan today. Invisible at current ("thousands of users") scale;
-- the single largest performance risk at 100k-1M users. Every index below
-- traces to an actual query in repositories/supabase/supabaseClient.ts — see
-- docs/backend-audit/index-report.md for the full derivation and the
-- indexes deliberately NOT added (no query justifies them).
--
-- ── IMPORTANT: run this file WITHOUT wrapping it in a transaction ────────
-- Every statement below uses `CREATE INDEX CONCURRENTLY`, which builds the
-- index without holding a lock that blocks concurrent reads/writes on the
-- table — the correct way to add an index to a live, already-populated
-- production table. CONCURRENTLY cannot run inside a transaction block, so
-- (unlike every other migration in this directory) do NOT wrap this file in
-- BEGIN/COMMIT — run it as-is, one statement at a time if your SQL client
-- auto-wraps scripts in a transaction. Each statement is independently safe
-- to re-run (IF NOT EXISTS) and independently rollback-able.

-- ── sos_events ────────────────────────────────────────────────────────────
-- Serves listForUser's `WHERE user_id = ? ORDER BY triggered_at DESC` in one
-- structure (filter + sort, no separate sort step).
CREATE INDEX CONCURRENTLY IF NOT EXISTS sos_events_user_triggered_idx
  ON public.sos_events (user_id, triggered_at DESC);

-- Partial: serves findRecentUnresolved's idempotency-retry check
-- (`WHERE user_id = ? AND resolved_at IS NULL AND triggered_at >= ? ORDER BY
-- triggered_at DESC LIMIT 1`). Matches only currently-active emergencies — a
-- tiny, roughly-constant-size fraction of the table regardless of its total
-- historical size — so this stays fast exactly when it matters most: during
-- an active SOS's retry loop.
CREATE INDEX CONCURRENTLY IF NOT EXISTS sos_events_unresolved_idx
  ON public.sos_events (user_id, triggered_at DESC)
  WHERE resolved_at IS NULL;

-- ── journeys ──────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS journeys_user_started_idx
  ON public.journeys (user_id, started_at DESC);
-- getById (the idempotent-retry adopt-check by exact UUID) needs no new
-- index — already covered by the PRIMARY KEY (id).

-- ── emergency_contacts ────────────────────────────────────────────────────
-- The table's PK is (id, user_id) with `id` as the LEADING column, so a
-- `WHERE user_id = ?` query gets no benefit from the PK index at all
-- (composite index columns only help left-to-right).
CREATE INDEX CONCURRENTLY IF NOT EXISTS emergency_contacts_user_created_idx
  ON public.emergency_contacts (user_id, created_at ASC);

-- ── community_reports ─────────────────────────────────────────────────────
-- Partial: serves the moderation queue's `WHERE moderation_status = 'pending'
-- ORDER BY created_at DESC` — only ever cares about pending reports, a
-- shrinking-over-time subset as reports get reviewed.
CREATE INDEX CONCURRENTLY IF NOT EXISTS community_reports_pending_idx
  ON public.community_reports (created_at DESC)
  WHERE moderation_status = 'pending';

-- Serves listForUser / the backend's GET /community-reports/mine.
CREATE INDEX CONCURRENTLY IF NOT EXISTS community_reports_user_created_idx
  ON public.community_reports (user_id, created_at DESC);

-- ── subscriptions / notification_tokens ───────────────────────────────────
-- No new index needed: `UNIQUE (user_id)` and `UNIQUE (user_id, token)`
-- already create exactly the index these tables' only query patterns need
-- (user_id as the leading column in both cases).

-- ── live_sessions ─────────────────────────────────────────────────────────
-- No new index needed for getByShareId/get_live_session: `UNIQUE (share_id)`
-- already covers it.
--
-- Partial: serves endAllActiveForUser's `WHERE user_id = ? AND is_active =
-- true` (the zombie-session-cleanup-on-write path already in
-- liveSessionRepository.startLiveSession). Most sessions are inactive most
-- of the time — every session ends eventually — so indexing only the active
-- ones keeps this small regardless of total historical row count.
CREATE INDEX CONCURRENTLY IF NOT EXISTS live_sessions_active_user_idx
  ON public.live_sessions (user_id)
  WHERE is_active = true;

-- Partial: supports the zombie-session retention cleanup query added in
-- 009_retention_and_background_jobs.sql (`WHERE is_active = true AND
-- expires_at < NOW()`).
CREATE INDEX CONCURRENTLY IF NOT EXISTS live_sessions_expired_active_idx
  ON public.live_sessions (expires_at)
  WHERE is_active = true;

-- ── profiles ──────────────────────────────────────────────────────────────
-- No new index needed: getById's `WHERE id = ?` is already covered by the
-- PRIMARY KEY (id).

-- ── Indexes deliberately NOT added (avoiding unnecessary write overhead) ──
-- sos_events.address / community_reports.description — never filtered/sorted on.
-- journeys.route_json / sos_events.contacts_notified (JSONB) — never queried
--   into (no ->/@> usage anywhere in the codebase); a GIN index would be
--   pure overhead for zero query benefit.
-- live_sessions.is_active alone (non-partial) — the two partial indexes
--   above already cover every real query shape that filters on it.

-- ── Rollback ──────────────────────────────────────────────────────────────
-- Each DROP is independent and safe to run individually; DROP INDEX
-- CONCURRENTLY (like CREATE) cannot run inside a transaction block either.
-- DROP INDEX CONCURRENTLY IF EXISTS public.sos_events_user_triggered_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS public.sos_events_unresolved_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS public.journeys_user_started_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS public.emergency_contacts_user_created_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS public.community_reports_pending_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS public.community_reports_user_created_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS public.live_sessions_active_user_idx;
-- DROP INDEX CONCURRENTLY IF EXISTS public.live_sessions_expired_active_idx;
