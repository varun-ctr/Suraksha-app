# 10. Production Checklist

Everything on this list is either **done** (code/SQL written, reviewed, verified against the mobile app's own test/type/lint suite) or explicitly requires infrastructure/Supabase-dashboard access this environment does not have. Nothing on this list was left undone by oversight — each unchecked item states exactly what it's blocked on.

## Code and SQL — done in this pass

- [x] `community_reports` anon RLS hole closed (`004`) — mobile/backend callers unaffected (verified by reading every real call site's auth path).
- [x] `sos_events` server-enforced idempotency (`005` + repository/context wiring).
- [x] `live_sessions` extended to the same client-generated-id + retry pattern `journeys` already had.
- [x] `app_users` bridge table + FKs + `ON DELETE CASCADE` on 8 tables (`006`), safe backfill + `NOT VALID`/`VALIDATE` pattern for a live production table.
- [x] CHECK constraints: coordinate bounds, journey duration bounds, and a real pre-existing bug fixed (`community_reports.type`'s CHECK was missing 7 valid values) (`007`).
- [x] 8 production indexes, `CONCURRENTLY`-built, every one traced to an actual query (`008`).
- [x] `live_sessions` 30-day retention added to the existing cron (`009`).
- [x] Journey deadline monitor: SQL-side detection function + table (`009`) and a companion Edge Function (`supabase/functions/journey-deadline-check/index.ts`) — written, not deployed.
- [x] `community_reports.listAll()` unbounded-query fix (`.limit(50)`).
- [x] `npx tsc -p tsconfig.json --noEmit`: 0 errors.
- [x] `pnpm run lint`: 0 errors (9 pre-existing warnings, unrelated to this pass).
- [x] `pnpm run test`: 82/82 passing.
- [x] `npx madge --circular`: no circular dependencies.
- [x] `npx expo export --platform web`: builds clean.
- [x] All 6 new migrations are idempotent, reversible, and safe against an already-populated production table (backfill-before-FK, `NOT VALID`/`VALIDATE`, `CONCURRENTLY` for indexes).

## Requires Supabase dashboard / infrastructure access — cannot be done from this environment

- [ ] **Run migrations `004`–`009`** against the actual production database, in order (see `08-Migration-Guide.md`).
- [ ] **Deploy + schedule `journey-deadline-check`** as a Supabase Edge Function with the required secrets, on a 1-minute cron (see `08-Migration-Guide.md`).
- [ ] **Verify PITR/backup configuration** — a safety-critical app's emergency history (`sos_events`/`journeys`) warrants Point-in-Time Recovery, not just daily backups; this depends on the project's billing tier and cannot be checked from code.
- [ ] **Confirm `pg_cron` and `pg_net`/Supabase Scheduled Functions are enabled** for the project (Dashboard → Database → Extensions / Edge Functions → Cron).
- [ ] **Configure cron-failure and Edge-Function-failure alerting** to a real destination (PagerDuty, Slack, etc.) — see `07-Monitoring.md`.
- [ ] **Post-migration smoke test**: attempt an anonymous (publishable-key-only, no session) `select`/`insert` against `community_reports` and confirm both are now denied.
- [ ] **Decide and document** the retention policy for `sos_events`/`journeys`/`community_reports` (indefinite-retention-as-a-feature is a legitimate choice, but should be an explicit product/legal decision — see `05-Retention.md`).
- [ ] **A restore-testing drill** (quarterly or pre-launch minimum) — confirming a backup is actually restorable, not just assumed to be.

## Explicitly deferred (tracked, not silently dropped)

- **Atomic account deletion** (BE-P0-3 in the original backend audit) — the `app_users` cascade chain built in this pass now *supports* a single-statement atomic delete, but the existing multi-step client-driven deletion flow was intentionally left unchanged in this pass (out of scope: "no application behavior changes"). Wiring the atomic version in is a well-scoped, low-risk follow-up now that the schema supports it.
- **Storage-object cleanup** (old report photos/avatars orphaned in Supabase Storage after their referencing row is deleted) — has no authoritative retention policy to key off yet (see `05-Retention.md`); revisit once the retention decision above is made.
- **Notification-token expiry** — not urgent at current scale, tracked in `06-Background-Jobs.md`.
