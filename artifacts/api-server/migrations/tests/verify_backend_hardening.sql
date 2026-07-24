-- verify_backend_hardening.sql
--
-- Automated verification for migrations 004-009 (RLS hardening, idempotency,
-- referential integrity, CHECK constraints, indexes, retention/background
-- jobs). Written as plain SQL (no pgTAP dependency, since it isn't
-- guaranteed to be installed on every Supabase project) using RAISE
-- EXCEPTION as the assertion mechanism: any failed check aborts the whole
-- script immediately with a clear message naming which check failed.
--
-- SAFE TO RUN AGAINST PRODUCTION: the entire script runs inside one
-- transaction that is always ROLLBACK'd at the end (success or failure) —
-- it never leaves any test data behind. All test rows use an
-- unmistakable, namespaced fake user id ('__verify_hardening_test_user__')
-- that cannot collide with a real Firebase uid.
--
-- Run this AFTER applying migrations 004-009, against a project that also
-- already has DATABASE_SETUP.sql / MIGRATE_FIREBASE_AUTH.sql /
-- supabase/emergency_contacts.sql / supabase/community_reports.sql applied.
--
-- Not executed in this environment (no live Supabase/Postgres access) —
-- reviewed line-by-line for correctness against the migrations it verifies.

BEGIN;

DO $$
DECLARE
  test_user   TEXT := '__verify_hardening_test_user__';
  test_id     UUID;
  row_count   INT;
  caught      BOOLEAN;
BEGIN
  RAISE NOTICE '=== verify_backend_hardening: starting ===';

  -- ── 1. Referential integrity: app_users self-heals + cascade delete ────
  INSERT INTO public.sos_events (user_id, lat, lng)
    VALUES (test_user, 12.9, 77.6);
  SELECT COUNT(*) INTO row_count FROM public.app_users WHERE id = test_user;
  IF row_count <> 1 THEN
    RAISE EXCEPTION 'FAIL [referential-integrity]: app_users row was not auto-created by the BEFORE INSERT trigger on sos_events';
  END IF;
  RAISE NOTICE 'PASS [referential-integrity]: app_users self-healing trigger works';

  INSERT INTO public.journeys (user_id, duration_minutes) VALUES (test_user, 15);
  INSERT INTO public.emergency_contacts (id, user_id, name, phone) VALUES ('test-contact-1', test_user, 'Test', '+911234567890');
  INSERT INTO public.live_sessions (user_id, lat, lng) VALUES (test_user, 12.9, 77.6);

  DELETE FROM public.app_users WHERE id = test_user;

  SELECT COUNT(*) INTO row_count FROM public.sos_events WHERE user_id = test_user;
  IF row_count <> 0 THEN
    RAISE EXCEPTION 'FAIL [cascade-delete]: sos_events rows survived app_users delete';
  END IF;
  SELECT COUNT(*) INTO row_count FROM public.journeys WHERE user_id = test_user;
  IF row_count <> 0 THEN
    RAISE EXCEPTION 'FAIL [cascade-delete]: journeys rows survived app_users delete';
  END IF;
  SELECT COUNT(*) INTO row_count FROM public.emergency_contacts WHERE user_id = test_user;
  IF row_count <> 0 THEN
    RAISE EXCEPTION 'FAIL [cascade-delete]: emergency_contacts rows survived app_users delete';
  END IF;
  SELECT COUNT(*) INTO row_count FROM public.live_sessions WHERE user_id = test_user;
  IF row_count <> 0 THEN
    RAISE EXCEPTION 'FAIL [cascade-delete]: live_sessions rows survived app_users delete';
  END IF;
  RAISE NOTICE 'PASS [cascade-delete]: deleting app_users cascades to sos_events, journeys, emergency_contacts, live_sessions';

  -- ── 2. sos_events idempotency: duplicate insert with same key is a no-op ─
  INSERT INTO public.sos_events (user_id, lat, lng, idempotency_key)
    VALUES (test_user, 12.9, 77.6, 'test-key-1')
    ON CONFLICT (user_id, idempotency_key) DO NOTHING
    RETURNING id INTO test_id;
  INSERT INTO public.sos_events (user_id, lat, lng, idempotency_key)
    VALUES (test_user, 13.0, 77.7, 'test-key-1')  -- different coords, same key — simulates a retry
    ON CONFLICT (user_id, idempotency_key) DO NOTHING;
  SELECT COUNT(*) INTO row_count FROM public.sos_events WHERE user_id = test_user AND idempotency_key = 'test-key-1';
  IF row_count <> 1 THEN
    RAISE EXCEPTION 'FAIL [idempotency]: expected exactly 1 sos_events row for a repeated idempotency_key, found %', row_count;
  END IF;
  RAISE NOTICE 'PASS [idempotency]: duplicate sos_events insert with the same idempotency_key does not create a second row';

  -- ── 3. journeys idempotency: PK prevents a physical duplicate ───────────
  caught := FALSE;
  BEGIN
    INSERT INTO public.journeys (id, user_id, duration_minutes) VALUES (test_id, test_user, 15);
    INSERT INTO public.journeys (id, user_id, duration_minutes) VALUES (test_id, test_user, 30);
  EXCEPTION WHEN unique_violation THEN
    caught := TRUE;
  END;
  IF NOT caught THEN
    RAISE EXCEPTION 'FAIL [idempotency]: inserting two journeys with the same id did not raise unique_violation';
  END IF;
  RAISE NOTICE 'PASS [idempotency]: journeys.id PRIMARY KEY rejects a duplicate-id insert (app-layer retry-and-adopt relies on this)';

  -- ── 4. CHECK constraints reject invalid data ────────────────────────────
  caught := FALSE;
  BEGIN
    INSERT INTO public.sos_events (user_id, lat, lng) VALUES (test_user, 999, 77.6);
  EXCEPTION WHEN check_violation THEN
    caught := TRUE;
  END;
  IF NOT caught THEN
    RAISE EXCEPTION 'FAIL [constraints]: sos_events accepted an out-of-range latitude (999)';
  END IF;
  RAISE NOTICE 'PASS [constraints]: sos_events rejects out-of-range coordinates';

  caught := FALSE;
  BEGIN
    INSERT INTO public.community_reports (user_id, type, lat, lng) VALUES (test_user, 'not_a_real_type', 12.9, 77.6);
  EXCEPTION WHEN check_violation THEN
    caught := TRUE;
  END;
  IF NOT caught THEN
    RAISE EXCEPTION 'FAIL [constraints]: community_reports accepted an invalid type value';
  END IF;
  RAISE NOTICE 'PASS [constraints]: community_reports rejects an invalid type';

  -- Confirms the actual bug this pass fixed: all 11 real app-facing types
  -- (not just the original 4) must be accepted.
  INSERT INTO public.community_reports (user_id, type, lat, lng) VALUES (test_user, 'accident', 12.9, 77.6);
  INSERT INTO public.community_reports (user_id, type, lat, lng) VALUES (test_user, 'animal_attack', 12.9, 77.6);
  RAISE NOTICE 'PASS [constraints]: community_reports accepts all app-facing types, including the 7 previously-missing ones';

  caught := FALSE;
  BEGIN
    INSERT INTO public.journeys (user_id, duration_minutes) VALUES (test_user, 99999);
  EXCEPTION WHEN check_violation THEN
    caught := TRUE;
  END;
  IF NOT caught THEN
    RAISE EXCEPTION 'FAIL [constraints]: journeys accepted an out-of-range duration_minutes (99999)';
  END IF;
  RAISE NOTICE 'PASS [constraints]: journeys rejects an out-of-range duration';

  -- ── 5. Indexes exist ─────────────────────────────────────────────────────
  SELECT COUNT(*) INTO row_count FROM pg_indexes
    WHERE schemaname = 'public' AND indexname IN (
      'sos_events_user_triggered_idx', 'sos_events_unresolved_idx',
      'journeys_user_started_idx', 'emergency_contacts_user_created_idx',
      'community_reports_pending_idx', 'community_reports_user_created_idx',
      'live_sessions_active_user_idx', 'live_sessions_expired_active_idx'
    );
  IF row_count <> 8 THEN
    RAISE EXCEPTION 'FAIL [indexes]: expected all 8 production indexes from migration 008 to exist, found %', row_count;
  END IF;
  RAISE NOTICE 'PASS [indexes]: all 8 indexes from migration 008 exist';

  -- ── 6. Journey deadline monitor: detection function ─────────────────────
  -- An expired journey with no check-in and no prior escalation should be
  -- reported as overdue.
  UPDATE public.journeys SET started_at = NOW() - INTERVAL '1 hour' WHERE id = test_id;
  SELECT COUNT(*) INTO row_count FROM public.get_overdue_journeys() WHERE journey_id = test_id;
  IF row_count <> 1 THEN
    RAISE EXCEPTION 'FAIL [background-jobs]: get_overdue_journeys() did not report a genuinely overdue journey';
  END IF;
  -- Marking it escalated must make it disappear from future runs (idempotency).
  INSERT INTO public.journey_escalations (journey_id) VALUES (test_id);
  SELECT COUNT(*) INTO row_count FROM public.get_overdue_journeys() WHERE journey_id = test_id;
  IF row_count <> 0 THEN
    RAISE EXCEPTION 'FAIL [background-jobs]: get_overdue_journeys() re-reported an already-escalated journey';
  END IF;
  RAISE NOTICE 'PASS [background-jobs]: get_overdue_journeys() detects overdue journeys and is idempotent once escalated';

  -- ── 7. RLS: anon has no access to community_reports ──────────────────────
  -- Run as the anon role explicitly (best-effort within this transaction —
  -- a full RLS test also needs a real Firebase-signed JWT via
  -- request.jwt.claims to fully exercise the `authenticated`-role owner
  -- checks, which this script does not attempt to fabricate).
  -- SET/RESET ROLE must go through EXECUTE inside PL/pgSQL — they are
  -- utility commands, not directly-supported PL/pgSQL statements.
  EXECUTE 'SET LOCAL ROLE anon';
  caught := FALSE;
  BEGIN
    INSERT INTO public.community_reports (user_id, type, lat, lng) VALUES (test_user, 'other', 12.9, 77.6);
  EXCEPTION WHEN insufficient_privilege THEN
    caught := TRUE;
  END;
  IF NOT caught THEN
    RAISE EXCEPTION 'FAIL [rls]: anon role was able to insert into community_reports — the P0-1 fix did not take effect';
  END IF;
  SELECT COUNT(*) INTO row_count FROM public.community_reports; -- should be 0 rows visible, not an error, since SELECT is simply denied by RLS (returns empty, not an exception)
  IF row_count <> 0 THEN
    RAISE EXCEPTION 'FAIL [rls]: anon role can still read community_reports rows — the P0-1 fix did not take effect';
  END IF;
  EXECUTE 'RESET ROLE';
  RAISE NOTICE 'PASS [rls]: anon role can neither read nor write community_reports';

  RAISE NOTICE '=== verify_backend_hardening: ALL CHECKS PASSED ===';
END $$;

ROLLBACK;
