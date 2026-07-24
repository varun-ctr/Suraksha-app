# 8. Migration Guide

## Migrations added in this pass, in run order

| # | File | What it does | Transaction-safe? |
|---|---|---|---|
| 004 | `004_community_reports_rls_hardening.sql` | Drops the `anon` RLS policies + grant on `community_reports`; re-asserts the correct `authenticated`-only policy set | Yes — wrapped in `BEGIN`/`COMMIT` |
| 005 | `005_emergency_data_idempotency.sql` | Adds `sos_events.idempotency_key` + partial unique index | Yes |
| 006 | `006_referential_integrity.sql` | Creates `app_users`, backfills it, adds `BEFORE INSERT` triggers, adds FKs (`NOT VALID` + `VALIDATE`) on 8 tables | Yes — the `NOT VALID`/`VALIDATE` steps are still inside the same transaction; this is safe because `VALIDATE CONSTRAINT` itself doesn't block concurrent writes even though it runs inside the transaction here (only `ADD CONSTRAINT` without `NOT VALID` would) |
| 007 | `007_check_constraints.sql` | Fixes `community_reports.type`'s CHECK (was missing 7 valid values), adds lat/lng bounds, adds journey duration bounds | Yes |
| 008 | `008_production_indexes.sql` | Adds 8 indexes across `sos_events`/`journeys`/`emergency_contacts`/`community_reports`/`live_sessions` | **No — must NOT be run inside a transaction.** Uses `CREATE INDEX CONCURRENTLY`, which Postgres forbids inside a transaction block. |
| 009 | `009_retention_and_background_jobs.sql` | Extends the existing cleanup cron to purge old `live_sessions`; adds `journey_escalations` + `get_overdue_journeys()` for the new journey-deadline monitor | Yes |

## How to run

Same convention as `001`–`003`: paste each file into the Supabase Dashboard's SQL Editor and run, in numeric order, on top of an already-`DATABASE_SETUP.sql` + `MIGRATE_FIREBASE_AUTH.sql` + `001`–`003`-migrated database.

**Migration 008 is the one exception** — because it uses `CREATE INDEX CONCURRENTLY`, do not let your SQL client auto-wrap it in a transaction (the Supabase SQL Editor does not auto-wrap by default, so pasting-and-running it directly is fine; a `psql -f 008...sql` run is also fine, since `psql` does not implicitly wrap a script in a transaction unless `\set AUTOCOMMIT off` or `-1` is passed).

All six migrations are safe to re-run (every `CREATE`/`ALTER`/`DROP` is guarded with `IF EXISTS`/`IF NOT EXISTS`, or checks `pg_constraint` first) — re-running the whole set after a partial failure is safe.

## Deploying the journey-deadline-check Edge Function (not done in this pass)

1. `supabase functions deploy journey-deadline-check` (from `artifacts/suraksha/supabase/functions/journey-deadline-check/index.ts`).
2. Set secrets: `supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_PHONE_NUMBER=...` (the Twilio values can be the same ones `api-server` already uses).
3. Schedule it: Dashboard → Edge Functions → `journey-deadline-check` → Cron → `* * * * *` (every minute), or add a `schedule` entry to `supabase/config.toml` if managing schedules as code.
4. Confirm `009_retention_and_background_jobs.sql` has already been run (the function depends on `get_overdue_journeys()` and `journey_escalations` existing).

## Order dependency

`006` must run before `007` conceptually makes sense to run after it (both touch integrity, no hard dependency, but running in the numbered order matches how they were designed and tested against each other). `009` depends on `journeys` existing (it always has) and does not depend on `006`/`007`. `008`'s indexes reference columns that have existed since `DATABASE_SETUP.sql`/`MIGRATE_FIREBASE_AUTH.sql` — no dependency on `004`–`007`, but running it last (as numbered) keeps the full set's history linear and easy to reason about.

## Verifying the migrations landed correctly

`api-server/migrations/tests/verify_backend_hardening.sql` — an automated SQL test script covering RLS enforcement (anon denied read/write on `community_reports`), duplicate-write rejection (`sos_events` idempotency-key upsert, `journeys.id` PK), cascade deletes (`app_users` → 4 dependent tables), CHECK-constraint rejection (bad coordinates, bad `community_reports.type`, bad journey duration — including confirming the 7 previously-missing report types are now accepted), the 8 new indexes' existence, and the journey-deadline monitor's detection + idempotency. Runs entirely inside one transaction that always `ROLLBACK`s at the end, so it is safe to run directly against production — it never leaves test data behind. Run it after applying `004`–`009` to confirm everything took effect as intended. Not executed in this environment (no live Supabase/Postgres access) — reviewed line-by-line for correctness against the migrations it verifies.

## No down-migrations as separate files

Consistent with `docs/backend-audit/disaster-recovery-plan.md`'s finding (no down-migrations exist anywhere in this codebase), rollback SQL is included as a commented block at the end of each new migration file rather than as a separate file — see `09-Rollback-Guide.md` for how to use them.
