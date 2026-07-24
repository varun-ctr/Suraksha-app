# 3. Indexes

## The problem (P1, resolved)

No table in this schema had a single explicitly-created index beyond what a `PRIMARY KEY`/`UNIQUE` constraint creates implicitly. Postgres does not automatically index foreign-key or filter columns, so every `WHERE user_id = ?` query — nearly every query this app makes — was a full table scan. Invisible at current ("thousands of users") scale; the single largest performance risk at 100k–1M users.

Every index below traces to an actual query in `repositories/supabase/supabaseClient.ts` (full derivation in `docs/backend-audit/index-report.md`). Migration: `api-server/migrations/008_production_indexes.sql`.

## Indexes added

| Table | Index | Type | Serves |
|---|---|---|---|
| `sos_events` | `(user_id, triggered_at DESC)` | Composite | `listForUser` |
| `sos_events` | `(user_id, triggered_at DESC) WHERE resolved_at IS NULL` | Partial | `findRecentUnresolvedEvent` — the idempotency-retry check, fires during every active SOS's retry loop |
| `journeys` | `(user_id, started_at DESC)` | Composite | `listForUser` |
| `emergency_contacts` | `(user_id, created_at ASC)` | Composite | `fetchContacts` — PK is `(id, user_id)` with `id` leading, so it gave zero benefit to a `user_id`-only filter |
| `community_reports` | `(created_at DESC) WHERE moderation_status = 'pending'` | Partial | Moderation queue |
| `community_reports` | `(user_id, created_at DESC)` | Composite | `listForUser` / backend's `GET /community-reports/mine` |
| `live_sessions` | `(user_id) WHERE is_active = true` | Partial | `endAllActiveForUser` (the zombie-session-cleanup-on-write path) |
| `live_sessions` | `(expires_at) WHERE is_active = true` | Partial | The new retention/zombie-cleanup query (see `06-Background-Jobs.md`) |

No new index needed for: `subscriptions` (`UNIQUE(user_id)` already covers its only query), `notification_tokens` (`UNIQUE(user_id, token)` already leading on `user_id`), `live_sessions.getByShareId`/`get_live_session` (`UNIQUE(share_id)` already covers it), `profiles.getById` (covered by its `PRIMARY KEY`), `journeys.getById` (covered by its `PRIMARY KEY`).

## Why composite vs. partial

- **Composite**: every "my own records, most recent first" query follows the same `WHERE user_id = ? ORDER BY <timestamp> DESC` shape — a `(user_id, timestamp DESC)` index serves the filter and the sort in one structure, no separate sort step.
- **Partial**: applied wherever a query only ever cares about a small, well-defined subset of rows (unresolved emergencies, pending reports, active sessions) — keeps the index small regardless of how large the full table grows, which matters specifically at 1M-user scale.

## Deliberately not indexed (avoiding unnecessary write overhead)

- `sos_events.address` / `community_reports.description` — never filtered/sorted on.
- `journeys.route_json` / `sos_events.contacts_notified` (JSONB) — never queried into (no `->`/`@>` usage anywhere in the codebase); a GIN index would be pure overhead for zero benefit.
- `live_sessions.is_active` alone (non-partial) — the two partial indexes above already cover every real query shape.

## Write-overhead trade-off

Every index above adds a small amount of write cost to its table's inserts/updates. For `sos_events`/`live_sessions` specifically (emergency-critical write paths), this is an explicit, accepted trade-off: at the write volumes this app will realistically see even at 1M users (a small fraction of users ever have an active emergency at once), the write-side cost of two focused partial indexes is negligible next to the read-side cost of a full table scan during an actual emergency.

## Migration safety

Every `CREATE INDEX` uses **`CONCURRENTLY`** — it builds the index without holding a lock that blocks concurrent reads/writes, the correct way to add an index to a live, populated production table. `CONCURRENTLY` cannot run inside a transaction block, so unlike every other migration in this set, `008_production_indexes.sql` must be run **without** wrapping it in `BEGIN`/`COMMIT` (see the file's header comment and `08-Migration-Guide.md`).

## Also fixed in this pass: unbounded moderation queue (BE-P1-5)

`repositories/supabase/supabaseClient.ts`'s `communityReports.listAll()` had no `LIMIT` — an unbounded result set on a cross-user, ever-growing table. Added `.limit(50)`, a trivial, zero-behavior-change fix (this query path is currently unused by any shipped feature, so there was no user-visible change to verify beyond the typecheck/lint/test suite already passing).
