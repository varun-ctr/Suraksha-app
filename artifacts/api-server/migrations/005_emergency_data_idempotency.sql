-- 005_emergency_data_idempotency.sql
--
-- P0 fix: server-enforced idempotency for emergency-critical writes so a
-- retried request after a lost response can never create a duplicate
-- emergency record.
--
-- ── sos_events ───────────────────────────────────────────────────────────
-- Adds a nullable `idempotency_key` column plus a PARTIAL unique index on
-- (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL. The mobile
-- client (features/sos/context/SafetyContext.tsx's idempotencyKeyRef)
-- generates one key per SOS activation and reuses it across every retry of
-- that same activation (the countdown-timer write, the 15s db-retry timer,
-- and the crash-recovery resume path all pass the same key). The repository
-- layer (repositories/supabase/supabaseClient.ts's db.sosEvents.insert) now
-- UPSERTs on (user_id, idempotency_key) instead of plain-inserting, so a
-- retried write with the same key is a true, atomic, DB-enforced no-op
-- rather than racing the client-side `findRecentUnresolvedEvent` best-effort
-- check (which remains in place as a harmless secondary layer).
--
-- The column is nullable — and the index PARTIAL — specifically so this is
-- safe to run against a production table with existing historical rows: a
-- NULL idempotency_key (every row written before this migration, or any
-- future caller that doesn't yet supply one) is simply excluded from the
-- uniqueness check, matching Postgres's own default "NULL is never equal to
-- NULL" semantics for a *full* unique index — the partial index just makes
-- that exclusion explicit and indexed rather than incidental.
--
-- ── journeys / live_sessions ─────────────────────────────────────────────
-- Both already achieve idempotency at the application layer via a
-- client-generated UUID used directly as the row's own primary key
-- (journeys.id — see repositories/supabase/journeyRepository.ts, built in a
-- prior pass) or unique share_id (live_sessions.share_id — see
-- repositories/supabase/liveSessionRepository.ts, extended in this pass to
-- the same retry-with-adopt pattern). A retry with the same id/share_id
-- either succeeds once or, on a later attempt, finds the row already exists
-- (an exact-id lookup, not a time-window heuristic) and adopts it instead of
-- inserting again — no new schema is needed for these two tables; this
-- migration only documents that this is the case and does not touch them.
--
-- Idempotent and safe to re-run. Reversible: see rollback block at the end.

BEGIN;

ALTER TABLE public.sos_events
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Partial unique index: only rows with a non-null key participate in the
-- uniqueness check, so this is safe to add against existing data with no
-- backfill required.
CREATE UNIQUE INDEX IF NOT EXISTS sos_events_user_idempotency_key_idx
  ON public.sos_events (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.sos_events.idempotency_key IS
  'Client-generated key, stable for one SOS activation across retries. Nullable for rows written before this column existed. Enforced unique per user via a partial unique index (sos_events_user_idempotency_key_idx) so a retried insert with the same key is an idempotent UPSERT no-op rather than a duplicate emergency record.';

COMMIT;

-- ── Rollback ──────────────────────────────────────────────────────────────
-- BEGIN;
--   DROP INDEX IF EXISTS public.sos_events_user_idempotency_key_idx;
--   ALTER TABLE public.sos_events DROP COLUMN IF EXISTS idempotency_key;
-- COMMIT;
-- Safe to roll back at any time: the mobile client falls back to a plain
-- insert whenever it isn't given an idempotency_key value to write (see
-- db.sosEvents.insert's row.idempotency_key ? upsert : insert branch), so
-- removing the column does not break the app — it only removes the
-- DB-level idempotency guarantee, reverting to the pre-existing
-- client-side-only `findRecentUnresolvedEvent` best-effort dedup.
