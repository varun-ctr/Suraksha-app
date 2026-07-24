# 10. Backend Production Readiness Report

## Background Processing (Section 9) — current state and recommendations

**Already implemented and working**: `api-server/migrations/003_cleanup_jobs.sql` schedules a `pg_cron` job every 15 minutes purging expired rows from `sos_idempotency_cache`, `rate_limit_counters`, and `email_otp_codes` — a genuinely well-built piece of infrastructure (idempotent to re-run, `SECURITY DEFINER` + pinned search path, falls back gracefully with a clear error message if `pg_cron` isn't available).

**Not implemented — recommended, review-only (per this audit's scope)**:
1. **Journey deadline monitor** — fully specified already in the Journey audit's `docs/journey-audit/backend-contract.md` (schema additions, event contracts, Edge Function + cron responsibilities). Not duplicated here; that document remains the authoritative spec.
2. **Zombie live-session cleanup** — extend `cleanup_expired_operational_rows()` (or a sibling function/cron job) to also handle `live_sessions`: the client already closes zombie sessions *it knows about* (`endAllActiveForUser`, from the SOS audit), but a session from an app that's simply never relaunched again stays `is_active = true` until its `expires_at` heartbeat lapses — which correctly makes it invisible to the public share-link RPC, but the row itself is never deleted, so the table still grows unboundedly (see Technical Debt BE-P1-3). Recommended: `DELETE FROM live_sessions WHERE expires_at < NOW() - INTERVAL '7 days'` on the same 15-minute cron.
3. **Notification-token cleanup** — no expiry concept currently exists for stale push tokens (a token becomes invalid if a user uninstalls the app without signing out first). Not urgent at current scale; worth revisiting if push-delivery failure rates are ever observed to correlate with stale tokens.
4. **Rate limiting** — already implemented and reviewed (`increment_rate_limit` RPC, atomic, service-role-only) — no further recommendation.

## Performance & Scalability

See the dedicated Performance Report and Scalability Report — summary: the schema's shape (no joins, owner-scoped access) is well-suited to scale to 1M users; the missing indexes (Index Report) are the one change that most determines whether that's actually true in practice.

## Monitoring (Section 13) — recommendations

**Nothing in this codebase currently monitors the backend itself** (the mobile client's own Sentry-breadcrumb telemetry, built across this session's auth/SOS/journey/startup audits, covers client-side behavior only — it has no visibility into database query latency, cron job success/failure, or Edge Function errors). Recommended, in priority order:

1. **Cron job failure alerting** — `cleanup_expired_operational_rows()` (and any future journey-deadline-monitor job) should page a human on failure, not fail silently. Supabase's own dashboard exposes `cron.job_run_details` — a scheduled check (or a Supabase log-drain integration to an existing alerting tool) against that table for failed runs is the minimum viable version of this.
2. **Slow-query monitoring** — Supabase's dashboard provides query performance insights on paid tiers; worth enabling and setting an alert threshold once the Index Report's recommendations are applied (so a *regression* back to table-scan behavior, e.g. from a future query that doesn't hit an index, is caught quickly).
3. **Failed-write rate** — specifically for `sos_events`/`live_sessions` inserts, since these are the emergency-critical writes; the backend's own `req.log.error(...)` calls (already present in `community-reports.ts`, presumably mirrored in `sos-alert.ts`) are a reasonable foundation if piped to a real log aggregator/alerting tool rather than only stdout.
4. **Realtime disconnects** — not currently applicable (no Realtime usage), revisit if adopted.
5. **Edge Function failures** — not currently applicable (no Edge Functions exist yet beyond the recommended-but-unbuilt journey monitor); build this in from day one if that function is implemented.
6. **Queue depth** — not applicable; this backend has no message queue (Twilio/Expo push calls are synchronous, direct API calls, not queued).

None of the above can be configured or verified from this code-only environment — they require Supabase dashboard/billing access and (for alerting) a destination (PagerDuty, Slack webhook, etc.) this audit has no visibility into.

## Storage (Section 12) — review

Buckets referenced across the SQL files: `avatars`, `contact-avatars`, `report-photos` (commented-out in `DATABASE_SETUP.sql`, so possibly not yet created), `community-reports` (referenced in `supabase/community_reports.sql`, set up as a **public** bucket). Reviewed:
- **File naming**: not verified from this environment — depends on client-side upload code not read in this pass (out of the backend/database scope this audit was asked to cover; flagged for a follow-up mobile-side review if warranted).
- **Access policies**: `community-reports` is explicitly public (photo URLs must be readable without auth, since they're referenced by `photo_url` in a table some users can read cross-user) — reasonable for its purpose. `avatars`/`contact-avatars` are not yet confirmed to exist as actual buckets (the SQL creating them is commented out) — if they are relied upon by any shipped feature, this should be verified directly in the Supabase dashboard.
- **Signed URLs**: not used anywhere found — every photo reference is a plain public URL. Acceptable for genuinely public content (community reports, meant to be visible to any authenticated user); would be worth revisiting if any *private* photo (e.g. a contact avatar) is ever stored in a bucket that isn't itself access-controlled.
- **Retention/cleanup**: no storage-object cleanup job exists anywhere — an old community report's photo, or a contact's avatar after the contact is deleted, is never removed from storage even after its referencing row is deleted. Recommended as a follow-up cleanup job once retention policy (BE-P1-4) is decided.

## Final Scores

| Dimension | Score | Rationale |
|---|---|---|
| **Backend Architecture** | 8/10 | Clean repository-pattern-vs-backend-API split, well-reasoned RLS-vs-service-role usage, genuinely solid existing idempotency/rate-limit/cron infrastructure. Docked for the conflicting `community_reports` policy files and non-atomic account deletion |
| **Database Design** | 6/10 | Correctly normalized, correct types post-Firebase-migration, sound constraint usage (`UNIQUE`, `CHECK`) — but zero indexes anywhere and no referential-integrity safety net (all FKs dropped, none replaced) are real structural gaps at scale |
| **Security** | 5/10 | RLS is correct and well-implemented everywhere else, `SECURITY DEFINER` functions are written safely (pinned search path, minimal exposed shape), server-side Firebase token verification is real and correct — but the `community_reports` anon-policy exposure (BE-P0-1) is a genuine, currently-shippable vulnerability that alone caps this score meaningfully given the audit's explicit compliance-review framing |
| **Scalability** | 6/10 | The schema's shape (no joins, owner-scoped) is inherently scale-friendly; missing indexes are the main risk at 1M users, fully addressable without a redesign |
| **Operational Readiness** | 5/10 | Good existing cron/cleanup for 3 tables; no equivalent for `live_sessions`; no journey-deadline monitor; no verified backup/PITR; no backend-side monitoring/alerting exists at all today |

## P0 / P1 / P2 / P3 Summary

See the Technical Debt Report for full detail. **3 P0s** (community_reports anon RLS; sos_events idempotency; non-atomic account deletion), **6 P1s**, **3 P2s**, **3 P3s** — full descriptions and fixes there.

## Estimated Backend Production Readiness: 68%

Lower than the mobile client's own certifications (88–92% across the auth/SOS/journey/startup audits) because the backend has real, structural gaps that require actual database/infrastructure work that has not happened yet — as opposed to the mobile-client work in prior phases, which was actually implemented and verified in this pass. The gap is concentrated in exactly three things: (1) one live, currently-shippable RLS vulnerability that is trivial to fix but unfixed; (2) missing indexes/referential-integrity that don't hurt at current scale but would at real growth; (3) no backend-side monitoring or verified disaster-recovery posture.

## Would you certify this backend for production?

**Not yet — conditionally, pending one specific, small, already-fully-specified fix.** The `community_reports` RLS gap (BE-P0-1) is the one item in this entire audit that is both genuinely severe (unauthenticated read/write access to user-submitted safety-incident data) and trivial to close (two `DROP POLICY` statements + a `REVOKE`, zero functional impact, already written out verbatim in the RLS Matrix). I would not certify a safety application's backend for production while that specific gap is open, given this audit's explicit compliance-review framing. Once that fix is applied and verified, and given a committed near-term plan for the two remaining P0s (sos_events idempotency constraint, atomic account deletion — both real but already well-mitigated in practice by existing client-side/application-level behavior), I would certify this backend as production-ready for the "thousands to 100k users" range immediately, with the Index Report's recommendations completed before scaling meaningfully past that toward 1M.
