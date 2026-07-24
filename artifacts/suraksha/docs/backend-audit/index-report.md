# 5. Index Report

## The headline finding

**No table in this schema has a single explicitly-created index beyond what a `PRIMARY KEY` or `UNIQUE` constraint creates implicitly.** Postgres does **not** automatically index foreign-key or filter columns — every `WHERE user_id = ?` query (which is nearly every query this app makes, since almost everything is scoped to the signed-in user) is doing a full table scan today. At current scale (per the brief: "thousands" of users, presumably low-thousands of rows per table) this is invisible in practice; at 100k–1M users it becomes the single largest performance risk in the entire backend, and is fully within reach to fix via a plain SQL migration (no application code changes needed).

## Recommended indexes, table by table

| Table | Query pattern (from actual repository code) | Recommended index | Why |
|---|---|---|---|
| `sos_events` | `listForUser`: `WHERE user_id = ? ORDER BY triggered_at DESC` | `CREATE INDEX sos_events_user_triggered_idx ON sos_events (user_id, triggered_at DESC);` | Composite, matches the exact filter+sort — a single index serves both |
| `sos_events` | `findRecentUnresolved`: `WHERE user_id = ? AND resolved_at IS NULL AND triggered_at >= ? ORDER BY triggered_at DESC LIMIT 1` | `CREATE INDEX sos_events_unresolved_idx ON sos_events (user_id, triggered_at DESC) WHERE resolved_at IS NULL;` | **Partial index** — `resolved_at IS NULL` matches only currently-active emergencies, a tiny fraction of all rows at any moment; this is exactly the retry/idempotency-check query, which fires during every active SOS's retry loop, so its speed matters most precisely when the system is under the most safety-critical load |
| `journeys` | `listForUser` (not yet used by any screen, but `db.journeys.listForUser` exists) | `CREATE INDEX journeys_user_started_idx ON journeys (user_id, started_at DESC);` | Same pattern as `sos_events` |
| `journeys` | `getById` (idempotent-retry check, by exact UUID) | None needed beyond the existing `PRIMARY KEY (id)` — already indexed | — |
| `emergency_contacts` | `fetchContacts`: `WHERE user_id = ? ORDER BY created_at ASC` | `CREATE INDEX emergency_contacts_user_created_idx ON emergency_contacts (user_id, created_at ASC);` | The table's PK is `(id, user_id)` — `id` is the *leading* column, so a `WHERE user_id = ?` query does **not** benefit from the PK index at all (composite index columns only help left-to-right) |
| `community_reports` | `listAll` (moderation queue): `WHERE moderation_status = 'pending' ORDER BY created_at DESC` | `CREATE INDEX community_reports_pending_idx ON community_reports (created_at DESC) WHERE moderation_status = 'pending';` | Partial index — the moderation queue only ever cares about pending reports, a shrinking-over-time subset |
| `community_reports` | `listForUser`/backend's `/mine`: `WHERE user_id = ? ORDER BY created_at DESC` | `CREATE INDEX community_reports_user_created_idx ON community_reports (user_id, created_at DESC);` | Same pattern |
| `subscriptions` | `getForUser`: `WHERE user_id = ?` | None needed — `UNIQUE (user_id)` already creates this exact index | — |
| `notification_tokens` | `listForUser`/`deleteForUser`: `WHERE user_id = ?` | None needed — `UNIQUE (user_id, token)` already indexes with `user_id` as the leading column, which serves a `user_id`-only filter too | — |
| `live_sessions` | `getByShareId`/`get_live_session` RPC: `WHERE share_id = ?` | None needed — `UNIQUE (share_id)` already creates this | — |
| `live_sessions` | `endAllActiveForUser`: `WHERE user_id = ? AND is_active = true` | `CREATE INDEX live_sessions_active_user_idx ON live_sessions (user_id) WHERE is_active = true;` | Partial index — most sessions are inactive most of the time (every session ends eventually); indexing only the active ones keeps this small and fast regardless of total historical row count |
| `live_sessions` | *(recommended, for a future cleanup job — see Disaster Recovery Plan)* `WHERE is_active = true AND expires_at < NOW()` (finding zombie sessions to close) | `CREATE INDEX live_sessions_expired_active_idx ON live_sessions (expires_at) WHERE is_active = true;` | Partial index — supports the exact query a scheduled zombie-session-cleanup job would run |
| `profiles` | `getById`: `WHERE id = ?` | None needed — `PRIMARY KEY (id)` already covers this | — |
| `sos_idempotency_cache` / `rate_limit_counters` / `email_otp_codes` | Cleanup queries: `WHERE expires_at < NOW()` | ✅ **Already done** — `api-server/migrations/001` and `002` both explicitly create `..._expires_at_idx` on each table | Credit where due: this is exactly the right index for exactly the right query, already in place |

## Composite vs. partial index guidance applied above

- **Composite indexes** (`sos_events`, `journeys`, `emergency_contacts`, `community_reports`'s user-scoped queries): every one of this app's "my own records, most recent first" queries follows the same `WHERE user_id = ? ORDER BY <timestamp> DESC` shape — a `(user_id, timestamp DESC)` composite index serves the filter and the sort in one structure, avoiding a separate sort step entirely.
- **Partial indexes** (`sos_events`'s unresolved-event check, `community_reports`'s pending-moderation queue, `live_sessions`'s active-session lookups): applied everywhere a query only ever cares about a small, well-defined subset of rows (unresolved emergencies, pending reports, active sessions) rather than the whole table — keeping the index itself small regardless of how large the full table grows, which matters specifically at the "1M users" scale this audit was asked to plan for.

## Indexes deliberately NOT recommended (avoiding unnecessary indexes, per the brief)

- No index on `sos_events.address`/`community_reports.description`/`description` text columns — never filtered or sorted on, would only add write overhead.
- No index on `journeys.route_json`/`sos_events.contacts_notified` JSONB columns — never queried into (no `->`/`@>` usage found anywhere in the codebase); a GIN index here would be pure overhead for zero query benefit.
- No additional index on `live_sessions.is_active` alone (non-partial) — the partial indexes above already cover every real query shape that filters on it; a second, broader index would be redundant write cost.
- No index on any `created_at`/`updated_at` column in isolation where no query actually orders or filters by it alone (checked against every `db.*` call site in `supabaseClient.ts` — none exist beyond what's already covered above).

## Migration status

**None of the indexes above have been created** — this is a review and recommendation only, consistent with every prior audit this session's stated constraint (no database migration access from this environment). The exact `CREATE INDEX` statements above are ready to run as-is.
