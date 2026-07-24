# 8. Disaster Recovery Plan

No Supabase project dashboard, billing tier, or actual backup configuration is accessible from this environment — this section documents what should be verified/configured and why, not what's currently configured (which cannot be confirmed from code alone).

## Backup strategy

**To verify (not visible from code):** Supabase's automatic backup behavior depends on the project's pricing tier — daily backups are available on paid tiers, with Point-in-Time Recovery (PITR) as a paid add-on. For a safety-critical application where `sos_events`/`journeys` are the historical record of real emergencies, **PITR should be treated as a requirement, not an optional upgrade** — a daily-only backup means up to 24 hours of emergency records could be unrecoverable after an incident. This is a configuration/billing recommendation, not something expressible in this repository's code or SQL files.

## Point-in-time recovery

Recommended: enable PITR with a retention window matching this app's data-sensitivity profile (30 days minimum for a safety app, so a delayed report of an incident, a support inquiry, or a compliance request can still be investigated against a specific point in time). Cannot be verified or configured from this environment.

## Migration rollback

Every SQL file in this repository (`DATABASE_SETUP.sql`, `MIGRATE_FIREBASE_AUTH.sql`, `supabase/*.sql`, `api-server/migrations/*.sql`) is written to be **idempotent and forward-only** (`IF NOT EXISTS`, `DROP POLICY IF EXISTS` then `CREATE`, `CREATE OR REPLACE FUNCTION`) — safe to re-run, but **none has a corresponding down-migration**. For a project of this size and a schema this stable, this is a reasonable trade-off, but it means any future schema change (e.g. this audit's recommended indexes, the journey `deadline_at`/`outcome` columns from the Journey audit's backend-contract, or the `app_users`-with-cascade-delete table recommended in the ER Diagram) should be written with an explicit rollback statement alongside it, given the increasing operational maturity this audit's other findings assume is coming.

## Disaster recovery — worked scenario

**Scenario: the Supabase project is unrecoverable (region outage beyond Supabase's own DR, accidental project deletion, etc.).**

1. Restore from the most recent backup/PITR snapshot to a new Supabase project.
2. Every SQL file in this repo can be re-run in order (`DATABASE_SETUP.sql` → `supabase/emergency_contacts.sql` → `supabase/community_reports.sql` (**after** applying this audit's recommended `DROP POLICY`/`REVOKE` fix — see the RLS Matrix) → `supabase/walkthrough_seen.sql` → `MIGRATE_FIREBASE_AUTH.sql` → `api-server/migrations/001` → `002` → `003`) to reconstruct schema + RLS + operational tables from scratch if a snapshot isn't available, though this would **not** recover any actual user data (contacts, SOS history, etc.) — only the schema.
3. The mobile app's `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and the backend's `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` env vars would need updating to point at the restored/new project — both are already externalized as environment variables (confirmed via `core/config/env.ts`, `config.ts`), not hardcoded, so this is a configuration change, not a code change.
4. Firebase Auth is a **separate system** from Supabase and is not affected by a Supabase-side disaster — user accounts/sessions survive independent of Supabase's state, which is a genuine architectural strength of this app's Firebase-Auth-plus-Supabase-data split: authentication identity and application data have independent failure domains.

## Data retention

No explicit retention/expiry policy exists for `sos_events`, `journeys`, or `community_reports` — they accumulate forever (see Scalability Report). Recommended, as a policy decision requiring product/legal input, not purely an engineering one: define how long emergency history should be retained (a safety app has a real argument for retaining SOS/journey history indefinitely as a user-facing safety-history feature, distinct from a typical app where old data is just deleted) — whatever the decision, it should be an explicit, documented policy rather than "accumulates forever by default because no one decided otherwise."

## Restore testing

**Not performed and not verifiable from this environment** — no ability to actually trigger a Supabase restore/PITR test from this sandbox. Recommended as an operational practice once the project has real production users: a quarterly (or pre-launch, at minimum once) restore-to-a-scratch-project drill, confirming the backup is actually restorable and the restored schema/RLS matches expectations — an untested backup is not a verified disaster-recovery capability, only an assumed one.

## What this pass could verify vs. what it could not

| Item | Verifiable from this environment? |
|---|---|
| SQL migration idempotency/correctness | ✅ Yes — read and reviewed directly |
| RLS policy correctness | ✅ Yes — read and reviewed directly (see RLS Matrix) |
| Actual backup/PITR configuration | ❌ No — requires Supabase dashboard/billing access |
| Actual restore capability | ❌ No — requires a live Supabase project to test against |
| Firebase Auth's independence from Supabase state | ✅ Yes — architectural fact, verified by reading how the two systems integrate (`accessToken` callback pattern in `supabaseClient.ts`) |
