# 6. Performance Report

No production database, load-testing tool, or Supabase project metrics are accessible from this sandboxed environment — this is a code-path analysis of query shapes and payloads, not a measured benchmark, consistent with every performance report produced this session.

## Query performance

Every query reviewed (see the Index Report) is a simple, single-table, indexed-or-should-be-indexed lookup — no complex joins exist anywhere in this schema (there are no cross-table joins at all in any repository's query, since every table is independently owner-scoped). This is a performance *strength* of the current design: there is no query in this app that could exhibit join-explosion or multi-table lock contention, because there are no multi-table queries.

## N+1 queries

**None found.** Reviewed every repository's data-loading path:
- `contactsRepository.syncContactsOnLoad` fetches all of a user's contacts in one query, then batches any local-only pushes via `upsertContactsBatch` (a single multi-row upsert, not a loop of individual upserts) — correctly avoids N+1.
- `sosAlertService.sendSosAlerts` iterates contacts for the *native SMS fallback* (one `sendSms`/`callNumber` call per contact) — this is not a database N+1, it's an inherent one-action-per-recipient requirement of SMS/calling, already reviewed and accepted in the SOS audit.
- No repository loads a list and then issues a follow-up per-row query for related data (the classic N+1 shape) anywhere in this codebase.

## Batching

`upsertContactsBatch` is the one place batching genuinely matters (potentially several contacts at once) and it's already implemented correctly as a single multi-row `upsert`. No other current operation needs batching (SOS/journey/live-session writes are inherently one-row-at-a-time, matching their one-event-at-a-time semantics).

## Pagination

**Not implemented anywhere**, and — reviewed against actual usage — **not yet needed**: every list query (`listForUser` for SOS events, journeys, contacts, community reports) is scoped to a single user's own data, and a single user's SOS-event/journey history, while unbounded in principle, is not the kind of dataset that grows into the thousands for one person. The one exception worth flagging: `db.communityReports.listAll()` (the moderation queue) has **no limit at all** — this one *does* need pagination or a hard `LIMIT`, since it's a cross-user, unboundedly-growing queue with no natural per-request ceiling. Recommended: add `.limit(50)` (or proper cursor-based pagination if a moderation UI is ever built beyond the current admin-less state) to that one query.

## Caching

No caching layer exists (no Redis, no in-memory cache in the mobile client beyond the already-reviewed local persistence for offline-safety purposes, which is a reliability mechanism, not a performance cache). At current and near-term scale this is fine — nothing in this schema is expensive enough to compute that caching would meaningfully help, since every query is an indexed (once the Index Report's recommendations are applied) single-table lookup.

## Payload size

Reviewed every response shape: all rows are small, flat objects with no large text/blob fields (photos are stored via `photo_url`/`avatar_url` referencing Supabase Storage, not embedded as base64 — correct). `contacts_notified`/`route_json` JSONB columns are small (a handful of contact-delivery records; an empty array in practice, since route tracking isn't built) — no payload-size concern found.

## Realtime bandwidth

**Not applicable — this app uses zero Supabase Realtime subscriptions anywhere** (confirmed via a full-codebase search for `.channel()`/`postgres_changes` — no matches). Live tracking is implemented via periodic polling of a single row through the `get_live_session` RPC on the viewer side, and periodic `UPDATE` pushes from the background-location task on the app side — see Section 8 (Realtime) findings for the full discussion and why this is a legitimate, if not maximally bandwidth-efficient, design choice for this feature's actual scale.

## Database connection usage

The mobile client uses Supabase's standard REST-over-HTTP interface (via `@supabase/supabase-js`), not a persistent Postgres connection — so "connection usage" per mobile client is effectively zero marginal cost per idle user (no connection pool exhaustion risk from mobile clients scaling up). The backend (`api-server`) does hold its own Supabase client instances (constructed per-request in `community-reports.ts`'s `getSupabaseClient()`, and presumably similarly elsewhere) — worth confirming this isn't creating a new client (and thus new connection-pool pressure) on every single request rather than reusing one; not verified in this pass (would require reading every route file in full) and flagged as a follow-up review item in the Technical Debt Report.

## Estimated behavior at scale

| Users | Expected behavior today (no indexes) | Expected behavior after applying the Index Report's recommendations |
|---|---|---|
| 10k | Fine — table scans on tables this size are fast enough to be invisible (low hundreds of thousands of rows across all tables combined, easily cached in Postgres's shared buffers) | No perceptible difference — already fine |
| 100k | Noticeable but probably not yet an incident — `sos_events`/`journeys`/`emergency_contacts` table scans start costing real milliseconds under concurrent load, especially the community-reports moderation queue's unbounded `listAll()` | Comfortably fine — every hot query becomes an index lookup |
| 1M | **Likely production-impacting** — full table scans on multi-hundred-thousand-to-million-row tables under concurrent load from every active user is exactly the kind of thing that produces slow-query alerts, connection-pool saturation (queries holding connections longer while scanning), and, worst of all, **slower SOS-event writes and reads during real emergencies precisely when load and urgency are both highest** | Comfortably fine — this is specifically what the recommended indexes exist to prevent, and is the single highest-leverage backend change for the "up to 1M users" requirement in this audit's brief |
