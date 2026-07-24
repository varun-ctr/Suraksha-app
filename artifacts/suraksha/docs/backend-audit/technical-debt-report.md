# 9. Backend Technical Debt Report

Classified per this audit's explicit instruction: any finding risking loss, duplication, or unauthorized access to emergency data is P0, regardless of how it would otherwise be scored on likelihood or effort.

## P0

| ID | Debt | Why P0 | Fix |
|---|---|---|---|
| BE-P0-1 | `supabase/community_reports.sql` grants the `anon` role full SELECT and INSERT on `community_reports` with `USING (true)`/`WITH CHECK (true)` — no authentication, no ownership check | **Unauthorized access** — the anon/publishable key is bundled in the mobile app and is not a secret; anyone extracting it could read every user-submitted safety report (locations, descriptions of harassment/stalking/unsafe areas) and insert forged ones, entirely bypassing the backend's own correct Firebase-token verification | `DROP POLICY anon_server_insert/anon_server_select; REVOKE INSERT, SELECT ... FROM anon;` — see RLS Matrix for the exact statements. Trivial, zero functional impact (the backend already prefers the service-role key, which doesn't need these grants at all) |
| BE-P0-2 | `sos_events` has no server-enforced idempotency key / unique constraint | **Duplication risk to emergency data** (explicit P0 criteria) — a retried insert after a lost response could, in a narrow window, create two rows for one real emergency. Client-side mitigation exists (`findRecentUnresolvedEvent`, a 5-minute lookback) but is best-effort, not structurally guaranteed | Schema migration: add an `idempotency_key` column + `UNIQUE (user_id, idempotency_key)` constraint, mirroring the pattern the Journey audit's v2 pass already achieved for `journeys` via a client-generated UUID primary key |
| BE-P0-3 | Account deletion spans 6+ independent, non-transactional round trips across tables including `sos_events`/`journeys` | **Risk of inconsistent retention of emergency data** — if interrupted, a user's explicit request to delete their account could leave some emergency records deleted and others not, with no database-level safety net (all FKs to `auth.users` were dropped post-Firebase-migration — see ER Diagram) | Backend: a single `SECURITY DEFINER` Postgres function performing every table's delete in one `BEGIN...COMMIT`, callable via RPC from a verified-token route — see Transaction Matrix |

## P1

| ID | Debt | Impact | Fix |
|---|---|---|---|
| BE-P1-1 | No foreign keys / cascade-delete exist for any table's `user_id` (root cause behind BE-P0-3) | Structural — no database-level safety net for any user-scoped table, not just the emergency ones | A lightweight `public.app_users` bridge table (Firebase uid PK) every other table can `REFERENCES ... ON DELETE CASCADE` against — see ER Diagram |
| BE-P1-2 | Zero indexes exist beyond implicit PK/UNIQUE ones on any table | Full table scans on every `WHERE user_id = ?` query — fine at current scale, a real production risk at 100k–1M users, specifically including `sos_events` reads/writes during real emergencies | Exact `CREATE INDEX` statements specified in the Index Report |
| BE-P1-3 | No cleanup/retention job for `live_sessions` | Unbounded table growth — the table accumulates every historical session forever, unlike the three operational tables (`sos_idempotency_cache`, `rate_limit_counters`, `email_otp_codes`) which already have a working `pg_cron` cleanup job | Extend `cleanup_expired_operational_rows()` (or add a sibling function) to archive/delete `live_sessions` rows past a retention window (e.g. 30+ days, distinct from the `expires_at` heartbeat field which serves a different purpose — see Disaster Recovery Plan) |
| BE-P1-4 | No data-retention policy decided for `sos_events`/`journeys`/`community_reports` | Indefinite accumulation with no explicit product/legal decision behind it | Product decision needed: define retention duration (or "retain indefinitely as a safety-history feature," which is a legitimate choice for this app) — engineering can implement either once decided |
| BE-P1-5 | `community_reports.listAll()` (moderation queue) has no `LIMIT`/pagination | Unbounded result set on a cross-user, ever-growing table | Add `.limit(50)` at minimum; cursor pagination if a real moderation UI is built |
| BE-P1-6 | Backup/PITR configuration cannot be verified from this environment | Unknown actual disaster-recovery posture | Verify (and if needed, upgrade to) PITR in the Supabase dashboard — see Disaster Recovery Plan |

## P2

| ID | Debt | Impact | Fix |
|---|---|---|---|
| BE-P2-1 | Backend's `getSupabaseClient()` (in `community-reports.ts`, likely mirrored elsewhere) constructs a new client per request | Unverified whether this causes unnecessary connection overhead at scale — not confirmed as an actual problem, just unreviewed | Audit `api-server`'s route files for client-reuse opportunities |
| BE-P2-2 | Supabase call timeouts added this pass only to `sos_events`/`journeys`/`live_sessions` | `profiles`, `community_reports` (direct-table path, unused by the app today), `subscriptions`, `notification_tokens` calls still have no explicit timeout | Extend the same `.abortSignal(timeoutSignal())` pattern to the remaining tables in `supabaseClient.ts` |
| BE-P2-3 | No Realtime subscriptions used anywhere; live tracking is poll-based | Not a defect — a legitimate design choice for this feature's current scale — but worth a deliberate revisit if live-tracking UX (viewer-side update latency) ever becomes a product priority | See Scalability Report's Realtime section for the trade-off if ever revisited |

## P3

| ID | Debt | Impact |
|---|---|---|
| BE-P3-1 | `journeys.route_json` is dead schema (no continuous-tracking feature populates it) | Cosmetic — no functional impact, just unused column |
| BE-P3-2 | No down-migrations for any schema change | Fine at current operational maturity; worth adopting as this project's infrastructure practices mature |
| BE-P3-3 | No restore-testing drill has ever been performed (or could be, from this environment) | Unverified disaster-recovery capability, not a known failure |

## Debt already paid down (credit where due — not re-flagged as missing)

- SOS alert idempotency cache + atomic rate-limit counters, shared correctly across autoscaled backend instances (`api-server/migrations/001`).
- A working `pg_cron` job cleaning up all three ephemeral operational tables every 15 minutes (`003_cleanup_jobs.sql`) — closes the TODOs explicitly left in migrations 001/002.
- Correct, real Firebase Admin SDK-based ID token verification server-side (not a naive decode) — `firebaseAdmin.ts`.
- A previously-real IDOR vulnerability in `/community-reports/mine` (reading `user_id` from an unauthenticated query string) already found and fixed, with the fix documented in-code.
- The `get_live_session` share-link lookup correctly implemented as a narrow `SECURITY DEFINER` function rather than a leaky table-wide policy.
- This pass's own fix: `.abortSignal()` timeouts added to every `sos_events`/`journeys`/`live_sessions` Supabase call (see Repository Flow Diagram).
