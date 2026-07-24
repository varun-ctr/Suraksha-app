# 2. Constraints — Referential Integrity, CHECK, UNIQUE, NOT NULL

## The problem (P0-3, resolved)

Every foreign key to `auth.users` was dropped by `MIGRATE_FIREBASE_AUTH.sql` (a Firebase uid is a text string, not a Supabase-Auth UUID, so those FKs could never have worked post-migration) and **never replaced**. Since then, zero database-level referential integrity has existed for any user-scoped table — nothing prevented an orphaned `sos_events`/`journeys`/`live_sessions`/`notification_tokens`/`community_reports`/`emergency_contacts`/`subscriptions` row, and nothing cascaded a delete.

## Design: a self-healing `app_users` bridge table

Firebase Auth is a separate system from Supabase (see `docs/backend-audit/disaster-recovery-plan.md`) — there is no Firebase-backed `auth.users` equivalent in Postgres to reference. Reusing `profiles` directly as the FK target was considered and rejected: `profiles` rows are created by app code (`features/profile/hooks/useWalkthroughScreen.ts` calling `db.profiles.upsert`), not guaranteed to exist before a user's first `sos_events`/`journeys`/etc. row — an FK straight to `profiles` could reject a legitimate first write.

Instead: `public.app_users (id TEXT PRIMARY KEY, created_at TIMESTAMPTZ)`, kept in sync automatically by a `BEFORE INSERT` trigger on every user-scoped table:

```sql
INSERT INTO app_users (id) VALUES (NEW.user_id) ON CONFLICT (id) DO NOTHING;
```

This guarantees the FK target always exists at the moment it's needed, regardless of which table the app happens to write to first — **zero mobile-code changes required**.

## Relationship map

| Table | Column | References | On delete |
|---|---|---|---|
| `profiles` | `id` | `app_users(id)` | CASCADE |
| `sos_events` | `user_id` | `app_users(id)` | CASCADE |
| `journeys` | `user_id` | `app_users(id)` | CASCADE |
| `community_reports` | `user_id` | `app_users(id)` | CASCADE |
| `subscriptions` | `user_id` | `app_users(id)` | CASCADE |
| `notification_tokens` | `user_id` | `app_users(id)` | CASCADE |
| `live_sessions` | `user_id` | `app_users(id)` | CASCADE |
| `emergency_contacts` | `user_id` | `app_users(id)` | CASCADE |
| `journey_escalations` | `journey_id` | `journeys(id)` | CASCADE |

No emergency-critical row can now be orphaned: `sos_events`, `journeys`, `live_sessions`, `notification_tokens`, `community_reports`, `emergency_contacts`, and `profiles` all cascade from `app_users`.

This does **not** change today's multi-step, client-driven account-deletion flow (tracked separately as BE-P0-3 in `docs/backend-audit/technical-debt-report.md`, out of this pass's scope) — but it makes it strictly safer: a future single `DELETE FROM app_users WHERE id = ?` would now cascade every one of these tables atomically in one statement, which was previously structurally impossible (there was nothing to cascade *from*).

## Migration safety on an already-populated production table

1. **Backfill first**: `app_users` is populated from every distinct `id`/`user_id` already present across all eight tables *before* any FK is added — otherwise validation would fail on pre-existing rows.
2. **`NOT VALID` then `VALIDATE CONSTRAINT`**: each FK is added as `NOT VALID` (a brief metadata-only lock, no table scan) and validated in a separate statement (scans without blocking concurrent writes) — the standard safe pattern for adding a FK to a live, populated table.

Migration: `api-server/migrations/006_referential_integrity.sql`.

## CHECK constraints (also P0-3)

| Table | Constraint | Why |
|---|---|---|
| `sos_events` | `lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180` | Corruption safety net for a safety-critical coordinate |
| `live_sessions` | same bounds, NULL-safe (`lat`/`lng` are nullable before the first location update) | Same |
| `community_reports` | same bounds | Same |
| `journeys` | `duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 1440` | Deliberately wider than the mobile client's own 5–240 minute UI bound (`domain/policies/journeyValidation.ts`) — this is a corruption backstop, not a duplicate of product validation, so it will never reject a value the app itself would send |

### A real bug found and fixed in passing: `community_reports.type`

`DATABASE_SETUP.sql`'s `CREATE TABLE` declares `CHECK (type IN ('unsafe_area','harassment','stalking','suspicious_activity'))` — only **4** values. But `shared/types/database.ts`'s `CommunityReportType` (what the mobile app actually sends) has **11**: those four plus `accident`, `medical`, `road_block`, `fire`, `flood`, `animal_attack`, `other`. If `DATABASE_SETUP.sql`'s version of the table is the one that physically exists in production (it runs before `supabase/community_reports.sql` in the documented setup order, and `CREATE TABLE IF NOT EXISTS` means whichever ran first wins), every report submitted with one of those seven newer types would be **rejected today** by this constraint. Fixed by replacing it with a constraint matching the app's actual full type union.

Migration: `api-server/migrations/007_check_constraints.sql` (also `NOT VALID` + `VALIDATE` pattern).

## UNIQUE / NOT NULL — reviewed, no new constraints needed

Existing schema already correctly uses:
- `subscriptions (user_id) UNIQUE`, `notification_tokens (user_id, token) UNIQUE`, `live_sessions.share_id UNIQUE`, `emergency_contacts PRIMARY KEY (id, user_id)`.
- `sos_events (user_id, idempotency_key)` partial unique index — added in this pass, see `04-Idempotency.md`.
- All `user_id`/timestamp/required-text columns were already `NOT NULL` where correctness requires it (`profiles.name`/`phone` are legitimately nullable — a user hasn't filled them in yet, not a data-integrity gap).

## Rollback

Each migration file (`006`, `007`) includes a commented rollback block at the end (drop FKs → drop triggers/functions → drop `app_users`; drop the added CHECK constraints). See `09-Rollback-Guide.md` for the full ordering rationale.
