-- 007_check_constraints.sql
--
-- P0 fix (continued from 006): CHECK-constraint gaps found while reviewing
-- every table for referential/data integrity.
--
-- ── 1. community_reports.type — a real, currently-shippable bug ─────────
-- DATABASE_SETUP.sql's CREATE TABLE for community_reports declares:
--   type TEXT NOT NULL CHECK (type IN ('unsafe_area','harassment','stalking','suspicious_activity'))
-- but shared/types/database.ts's CommunityReportType (what the mobile app
-- actually sends) has SEVEN more values: 'accident', 'medical', 'road_block',
-- 'fire', 'flood', 'animal_attack', 'other'. If DATABASE_SETUP.sql's version
-- of this table is the one that physically exists in production (it runs
-- before supabase/community_reports.sql in the documented setup order, and
-- `CREATE TABLE IF NOT EXISTS` means whichever file ran first wins), every
-- report submitted with one of those seven types would be REJECTED by this
-- constraint today. This migration replaces it with a constraint matching
-- the app's actual full type union.
--
-- ── 2. Coordinate bounds on sos_events / live_sessions / community_reports ─
-- No table constrains lat/lng to valid ranges — a corrupted or malformed
-- client payload could otherwise silently write an impossible coordinate
-- (e.g. lat = 9000) straight into an emergency record. These are a
-- corruption safety net only, not a duplicate of any app-level validation.
--
-- ── 3. journeys.duration_minutes bounds ──────────────────────────────────
-- domain/policies/journeyValidation.ts already enforces a stricter 5–240
-- minute UI-facing bound client-side. This DB-level CHECK is deliberately
-- wider (1–1440, a generous 24-hour outer bound) — it exists to catch
-- corruption/bypass, not to duplicate product-level UX validation, so it
-- will never conflict with a legitimate value the app itself would ever
-- send.
--
-- All CHECK constraints below are added NOT VALID then validated separately
-- (safe on a live, already-populated table — see 006 for the same pattern
-- applied to foreign keys). Idempotent and safe to re-run. Reversible: see
-- rollback block at the end.

BEGIN;

-- ── 1. community_reports.type ────────────────────────────────────────────
-- Default constraint name for a column-level CHECK declared inline is
-- "<table>_<column>_check" — drop that (whichever file created it) before
-- adding our own explicitly-named replacement.
ALTER TABLE public.community_reports DROP CONSTRAINT IF EXISTS community_reports_type_check;
ALTER TABLE public.community_reports DROP CONSTRAINT IF EXISTS community_reports_type_valid;
ALTER TABLE public.community_reports
  ADD CONSTRAINT community_reports_type_valid CHECK (
    type IN (
      'unsafe_area', 'harassment', 'stalking', 'suspicious_activity',
      'accident', 'medical', 'road_block', 'fire', 'flood',
      'animal_attack', 'other'
    )
  ) NOT VALID;
ALTER TABLE public.community_reports VALIDATE CONSTRAINT community_reports_type_valid;

-- ── 2. Coordinate bounds ─────────────────────────────────────────────────
ALTER TABLE public.sos_events DROP CONSTRAINT IF EXISTS sos_events_coords_valid;
ALTER TABLE public.sos_events
  ADD CONSTRAINT sos_events_coords_valid CHECK (
    lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180
  ) NOT VALID;
ALTER TABLE public.sos_events VALIDATE CONSTRAINT sos_events_coords_valid;

ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_coords_valid;
ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_coords_valid CHECK (
    (lat IS NULL OR lat BETWEEN -90 AND 90) AND
    (lng IS NULL OR lng BETWEEN -180 AND 180)
  ) NOT VALID;
ALTER TABLE public.live_sessions VALIDATE CONSTRAINT live_sessions_coords_valid;

ALTER TABLE public.community_reports DROP CONSTRAINT IF EXISTS community_reports_coords_valid;
ALTER TABLE public.community_reports
  ADD CONSTRAINT community_reports_coords_valid CHECK (
    lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180
  ) NOT VALID;
ALTER TABLE public.community_reports VALIDATE CONSTRAINT community_reports_coords_valid;

-- ── 3. journeys.duration_minutes bounds ──────────────────────────────────
ALTER TABLE public.journeys DROP CONSTRAINT IF EXISTS journeys_duration_valid;
ALTER TABLE public.journeys
  ADD CONSTRAINT journeys_duration_valid CHECK (
    duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 1440
  ) NOT VALID;
ALTER TABLE public.journeys VALIDATE CONSTRAINT journeys_duration_valid;

COMMIT;

-- ── Rollback ──────────────────────────────────────────────────────────────
-- Restores the ORIGINAL (buggy, 4-value) community_reports type constraint
-- only if you specifically want DATABASE_SETUP.sql's original behavior back
-- — not recommended, since it actively rejects seven legitimate report
-- types the app sends today.
-- BEGIN;
--   ALTER TABLE public.journeys           DROP CONSTRAINT IF EXISTS journeys_duration_valid;
--   ALTER TABLE public.community_reports  DROP CONSTRAINT IF EXISTS community_reports_coords_valid;
--   ALTER TABLE public.live_sessions      DROP CONSTRAINT IF EXISTS live_sessions_coords_valid;
--   ALTER TABLE public.sos_events         DROP CONSTRAINT IF EXISTS sos_events_coords_valid;
--   ALTER TABLE public.community_reports  DROP CONSTRAINT IF EXISTS community_reports_type_valid;
-- COMMIT;
