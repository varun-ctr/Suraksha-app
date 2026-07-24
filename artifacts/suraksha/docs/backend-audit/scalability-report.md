# 7. Scalability Report (Section 15 — assume 1 million users)

## Database bottlenecks

The single biggest bottleneck identified is the complete absence of indexes (Index Report) — this alone determines whether the database degrades gracefully or becomes the incident at 1M users. Applied, the schema's inherent simplicity (no joins, no complex queries, every access pattern owner-scoped) means Postgres itself is very unlikely to be the bottleneck even at 1M users; Supabase's managed Postgres tiers scale vertically well past what this schema's access patterns would ever demand. The second-order bottleneck is unbounded table growth on `sos_events`/`journeys`/`community_reports`/`live_sessions` with no archival strategy (see Disaster Recovery Plan) — indexes keep queries fast regardless of table size, but backup/restore time, storage cost, and `pg_dump`-based disaster-recovery all still scale with total row count.

## Realtime scaling

Not a bottleneck at any scale currently under consideration — zero Realtime subscriptions exist. If a genuinely live (WebSocket-pushed) tracking view is built in the future (see the Journey/SOS audits' recommendation to consider Realtime instead of polling for the live-tracker web view), Supabase Realtime's connection-count-based pricing and its per-project connection ceiling would become the relevant scaling axis at 1M users — worth designing for a bounded number of *concurrent active emergencies* (which is always vastly smaller than total user count) rather than one channel per user, if adopted.

## Edge Function scaling

None exist today (Section 9/backend-contract.md's journey-deadline-monitor and the recommended zombie-live-session cleanup are both specified but not implemented). Supabase Edge Functions scale horizontally by design (each invocation is an isolated Deno instance) — the actual scaling concern at 1M users is the *query* the function runs (e.g. "find all journeys past deadline"), not the function's own execution model. As long as that query is indexed (per the Index Report's recommended partial indexes), a single scheduled Edge Function invocation stays fast regardless of total user count, since it only ever touches the small subset of currently-overdue/currently-active rows.

## Storage growth

Reviewed against the three buckets referenced in `DATABASE_SETUP.sql`'s commented-out storage setup (`avatars`, `contact-avatars`, `report-photos`) plus `community-reports` (referenced in `supabase/community_reports.sql`). Every profile/contact/incident photo is a single small image — storage cost scales linearly and predictably with user count and incident-report volume; no runaway-growth risk found (no video, no large file uploads anywhere in this app). The one real growth-management gap: no retention/cleanup policy exists for photos attached to old/resolved community reports or deleted contacts — see the Storage section of the Production Readiness Report and the Disaster Recovery Plan.

## Notification throughput

`notification_tokens` correctly stores one row per (user, platform) via a `UNIQUE (user_id, token)` constraint with upsert-on-conflict — this scales linearly and cleanly; there is no fan-out, batch-send, or throughput concern in the *storage* layer. The actual throughput constraint at 1M users would be **Expo's push notification service and/or Twilio's SMS throughput** for SOS alerts specifically — both are third-party services outside this codebase's control, but worth flagging: at genuine 1M-user scale, a mass-simultaneous-incident scenario (unlikely for this app's use case, but worth naming) could hit Twilio rate limits; the backend's existing `rate_limit_counters` mechanism (migration 001) already provides the per-user throttling needed to prevent runaway retry storms from a single client, which is the relevant protection at this layer.

## Cost optimisation

- **Indexes** (Index Report) reduce compute cost per query at scale, which directly reduces Supabase compute-tier cost pressure — the single highest-leverage recommendation in this entire audit for cost, not just latency.
- **Partial indexes specifically** (vs. full-column indexes) keep index storage cost proportional to the *active* subset of rows (unresolved SOS events, pending reports, active sessions), not the ever-growing historical total — meaningful at 1M users where "currently relevant" rows are a tiny fraction of "ever created" rows.
- **Archival/retention** (Disaster Recovery Plan) for old `sos_events`/`journeys`/`community_reports` rows, if implemented, directly reduces primary-table size (and therefore query cost, backup time, and storage cost) while preserving the historical record in cheaper storage.
- **No caching layer is recommended at this stage** — introducing one (Redis, etc.) before the indexing gap is closed would be optimizing the wrong layer; revisit only if post-indexing query latency is still a concern at real 1M-user load, which is not expected to be the case given this schema's simplicity.

## Summary judgment

This schema's fundamental shape (no joins, owner-scoped single-table access) is **well-suited to scale to 1M users** — the gaps found (no indexes, no archival strategy, no cascade-delete safety net) are all real but all straightforward, well-understood fixes, not signs of an architecture that needs to be redesigned to scale. The Index Report's recommendations alone would resolve the overwhelming majority of the scaling risk identified here.
