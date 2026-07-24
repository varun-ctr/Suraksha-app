# 7. Operational Monitoring

Nothing in this codebase monitors the backend itself today — the mobile client's own Sentry-breadcrumb telemetry (built across the auth/SOS/journey audits earlier this session) covers client-side behavior only, with zero visibility into database query latency, cron job success/failure, or Edge Function errors. This pass adds no new monitoring infrastructure (that requires a live Supabase dashboard/billing tier and an alerting destination this environment cannot access or configure) — this document specifies exactly what to wire up and why, in priority order.

## 1. Cron job failure alerting — highest priority

Two jobs now exist: `cleanup_expired_operational_rows()` (15-minute schedule, extended in this pass to cover `live_sessions`) and, once deployed, the `journey-deadline-check` Edge Function (recommended 1-minute schedule). Both should page a human on failure, not fail silently — an undetected failure of the journey monitor specifically means the one server-side backstop for an unattended overdue journey silently stops working with no signal to anyone. Supabase's dashboard exposes `cron.job_run_details` for the SQL-side job; a scheduled check against that table (or a log-drain integration to an existing alerting tool) is the minimum viable version. Edge Function invocation failures/timeouts are visible in the Supabase Functions dashboard logs — wire an alert on non-2xx responses or timeouts.

## 2. Failed-write rate — specifically `sos_events` / `live_sessions` / `journeys`

These are the emergency-critical writes. The mobile client already has offline-queue-backed retry (`sosOfflineQueue.ts`) and the new DB-level idempotency (see `04-Idempotency.md`) as safety nets, but a *sustained* failure rate (e.g. a misconfigured RLS policy, a dropped Supabase connection pool, a bad deploy) should be visible to an operator well before it's noticed anecdotally. `req.log.error(...)` calls already exist in `community-reports.ts` and presumably `sos-alert.ts` — piping these to a real log aggregator/alerting tool (rather than only stdout) is the concrete next step.

## 3. RLS denials

Not currently logged anywhere. A spike in RLS-denied requests against `community_reports` (post-`04-migration`) or any other table would be a strong signal of either a client bug (sending unauthenticated requests where it shouldn't) or an active probing attempt against the just-closed `anon` hole (see `01-RLS-Hardening.md`) — worth a dashboard alert once Supabase's query-insights/log-drain features are configured.

## 4. Slow-query monitoring

Supabase's dashboard provides query performance insights on paid tiers. Worth enabling now that the indexes in `03-Indexes.md` exist — specifically so a **regression** back to table-scan behavior (e.g. a future query that doesn't hit one of these new indexes) is caught quickly rather than silently re-accumulating the exact risk this pass just closed.

## 5. Deadlocks

Not currently monitored. The `NOT VALID` + `VALIDATE CONSTRAINT` pattern used throughout this pass's migrations (`006`, `007`) was chosen specifically to avoid long-held locks that could contribute to this; ordinary application-level deadlocks (rare, given this schema has no cross-table transactions/joins in the hot path) should still be visible via Supabase's Postgres logs if they ever occur.

## 6. Edge Function failures

Not currently applicable beyond the new `journey-deadline-check` function (not yet deployed). Build alerting in from day one once it is — see item 1.

## 7. Realtime disconnects

Not applicable — no Realtime subscriptions are used anywhere (live tracking is poll-based by design). Revisit only if that design choice is revisited.

## 8. Storage growth

Not monitored. Worth a periodic manual/dashboard check on the `community-reports` bucket's size given no storage-object cleanup job exists yet (see `05-Retention.md`'s storage note).

## 9. Queue depth

Not applicable — this backend has no message queue; Twilio/Expo push calls are synchronous, direct API calls.

## What could and couldn't be verified from this environment

None of the above can be configured or verified from this code-only environment — every item requires Supabase dashboard/billing access and, for alerting, a real destination (PagerDuty, Slack webhook, etc.) this pass has no visibility into. What *was* verifiable and is done: the migrations themselves are reviewed line-by-line for correctness, idempotency, and safety (see `08-Migration-Guide.md`), and the mobile-side code changes are typechecked, linted, and tested (see `04-Idempotency.md`'s verification section).
