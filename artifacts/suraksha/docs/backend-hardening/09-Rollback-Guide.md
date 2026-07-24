# 9. Rollback Guide

Every migration in this pass (`004`–`009`) includes a commented rollback block at the end of its file. None of them should be needed in normal operation — they exist because the brief explicitly requires every migration to be reversible. This document is the ordering/reasoning guide for using them; the actual SQL to run is in each file.

## General rule: roll back in reverse numeric order

Because `006`'s FKs reference `app_users` (created in `006`), and `009`'s `journey_escalations` references `journeys` (unaffected by rollback) but not `app_users`, there's no strict cross-file dependency forcing a single global order — but rolling back `009` → `008` → `007` → `006` → `005` → `004` (reverse of application order) is the safe default and avoids ever needing to reason about a partially-rolled-back intermediate state.

## Per-migration rollback notes

- **`004` (RLS)**: rollback re-opens the `anon` policy hole. There is no legitimate production reason to run this — included only because every migration must have one. If you do run it, immediately re-run `004`'s forward migration afterward rather than leaving the hole open.
- **`005` (idempotency)**: safe to roll back at any time. The mobile client's `db.sosEvents.insert` falls back to a plain insert whenever `idempotency_key` isn't present in the row it's given (`row.idempotency_key ? upsert : insert` in `supabaseClient.ts`) — dropping the column doesn't break the app, it only removes the DB-level guarantee, reverting to the pre-existing client-side-only `findRecentUnresolvedEvent` best-effort dedup.
- **`006` (referential integrity)**: rollback order matters *within* this file's own rollback block (already correct as written): drop the 8 FK constraints first, then the 8 triggers, then the 2 trigger functions, then the `app_users` table itself — attempting the table drop before the FKs are gone will fail with a dependency error. Rolling this back removes all cascade-delete protection; any code relying on it (none does yet — see `05-Retention.md`'s note that the atomic-delete flow is not yet wired to any app behavior) would need to be reverted first, but nothing currently depends on it.
- **`007` (CHECK constraints)**: rollback restores the *original, buggy* 4-value `community_reports.type` constraint — not recommended, since it would actively reject 7 legitimate report types the app sends today. Only roll back the coordinate/duration bounds individually if needed, not the type fix.
- **`008` (indexes)**: each `DROP INDEX CONCURRENTLY IF EXISTS` is independent — safe to roll back one index at a time without affecting the others. Like the forward migration, `DROP INDEX CONCURRENTLY` cannot run inside a transaction either.
- **`009` (retention + background jobs)**: rollback reverts `cleanup_expired_operational_rows()` to its pre-`009` definition (the exact `003`-era function body is included verbatim in the rollback block) and drops `journey_escalations`/`get_overdue_journeys()`. If the `journey-deadline-check` Edge Function has been deployed and scheduled by this point, **unschedule/undeploy it first** — otherwise it will start failing every invocation once `get_overdue_journeys()` no longer exists.

## What rollback does NOT undo

Data. `006`'s backfill (`INSERT INTO app_users ...`) and `007`'s constraint validation don't modify any existing `sos_events`/`journeys`/etc. rows — rolling back only removes the *new* schema objects (tables, columns, constraints, indexes, functions), never touches user data. The one exception: if you've been running `009`'s extended `cleanup_expired_operational_rows()` for a while before rolling back, any `live_sessions` rows it already deleted (>30 days old) are gone — rollback stops future deletions, it cannot restore rows already purged. This is expected and matches the retention design in `05-Retention.md`.

## Testing a rollback

No live Supabase project is accessible from this environment, so none of these rollback blocks have been executed — only reviewed line-by-line for correctness (matching each forward migration's objects exactly, checked by cross-reference). Before relying on any of these in a real incident, run the full forward-then-rollback sequence once against a scratch/staging project.
