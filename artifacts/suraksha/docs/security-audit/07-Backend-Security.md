# 7. Backend Security

This section reviews Supabase RLS, JWT/Firebase verification, service-role usage, SQL injection, privilege escalation, Edge Functions, storage policies, rate limiting, and audit logging. It builds directly on — and does not re-litigate — the backend-hardening pass's own documentation (`docs/backend-hardening/`), which already resolved the P0 RLS/idempotency/referential-integrity findings from the prior backend audit. This section focuses on what's new for a security/privacy/compliance certification lens.

## Supabase RLS

Every user-scoped table (`sos_events`, `journeys`, `live_sessions`, `emergency_contacts`, `profiles`, `subscriptions`, `notification_tokens`) uses owner-scoped RLS keyed on `auth.jwt() ->> 'sub'`. `community_reports` correctly allows cross-user SELECT (by design — a shared safety map) but owner-only INSERT/UPDATE/DELETE. The previously-live `anon`-role RLS hole on `community_reports` was closed in the backend-hardening pass (`docs/backend-hardening/01-RLS-Hardening.md`) — re-verified in this pass by re-reading the migration and the corrected source SQL file; no regression found.

The three ephemeral operational tables (`sos_idempotency_cache`, `rate_limit_counters`, `email_otp_codes`) are service-role-only (no client-facing RLS policy grants them to `anon`/`authenticated` at all) — correct, since these tables should never be readable/writable by a regular client.

## JWT / Firebase verification

`api-server/src/lib/firebaseAdmin.ts`'s `verifyFirebaseToken` performs real Firebase Admin SDK verification (signature, expiry, issuer/audience checks are all handled by the SDK) — not a naive decode. Every route that touches PII or writes data calls this before proceeding (see the route table in `06-Network-Security.md`). No route trusts a client-supplied `uid`/`user_id` from the request body or query string for authorization purposes — every service-role write derives the owner from the verified token, a pattern explicitly reinforced after a prior IDOR fix (`community-reports.ts:21-24,76-79`).

## Service-role usage

The service-role key (which bypasses RLS entirely) is used in exactly three places, all appropriate: `community-reports.ts` (writes/reads gated by Firebase-token-derived `user_id`), `sos-alert.ts` (idempotency cache read/write), and the new `journey-deadline-check` Edge Function (backend-hardening pass — reads `journeys`/`emergency_contacts` across users, which is exactly what a system-level cron job needs to do and a regular RLS-scoped client cannot). Confirmed via cross-boundary grep that the service-role key is never referenced from any file under the mobile app's `repositories/`/`features/` — it exists only in `api-server`'s env surface and the Deno Edge Function's own env surface (a separate runtime, correctly out of the React Native bundle).

## SQL injection

No raw SQL string concatenation was found anywhere in the application code paths (`api-server/src/routes/*.ts` all use the Supabase JS client's parameterized query builder — `.eq()`, `.insert()`, `.upsert()` — never a hand-built SQL string with interpolated user input). The only raw SQL in the repo lives in the `migrations/*.sql` files (author-controlled, not built from request input) and the Edge Function's use of a `SECURITY DEFINER` RPC (`get_overdue_journeys()`), which takes no parameters at all. **No SQL injection surface exists in this codebase.**

## Privilege escalation

- RLS policies correctly scope every write to `auth.jwt()->>'sub' = user_id` — a client cannot write a row it doesn't own via the direct Supabase path.
- Server-side, every service-role write derives ownership from the verified token, not client input (above) — a client cannot forge another user's `user_id` through the backend either.
- `SECURITY DEFINER` functions (`get_live_session`, `cleanup_expired_operational_rows`, the `app_users` self-healing triggers, `get_overdue_journeys` — all from prior/this-pass migrations) are reviewed and consistently pin `search_path` and expose only the minimal shape needed (e.g. `get_live_session` returns a narrow public shape with no `user_id` field) — this is the correct pattern to avoid the classic `SECURITY DEFINER` privilege-escalation footgun (an unpinned search_path letting a caller's own function shadow a system one).
- No admin/moderator role exists in the schema today (confirmed in the backend-hardening pass) — so there is no elevated-role escalation surface to review beyond the service-role key itself, which is correctly never exposed to the client.

## Edge Functions

One Edge Function exists: `supabase/functions/journey-deadline-check/index.ts` (written in the backend-hardening pass, **not yet deployed**). Reviewed here from a security lens:
- Uses the service-role key and Twilio secrets exclusively via `Deno.env.get(...)` — never hardcoded, never logged.
- Marks a journey "escalated" (inserts into `journey_escalations`) **before** sending any SMS, so a concurrent/overlapping invocation's insert fails the PK conflict and skips — a correct idempotency-first ordering that prevents duplicate emergency SMS under overlapping cron runs.
- Logs failures with `journeyId` (a UUID, not directly identifying) and the Twilio error string — does **not** log the contact's name/phone or the SMS body, even though it fetches `emergency_contacts(name, phone)` a few lines earlier to send the SMS. Correct minimization.
- No request-signing/auth check on the function's own invocation is visible in the code (Edge Functions are typically invoked by Supabase's own cron/scheduler with its own access control) — this depends on Supabase project-level configuration (function visibility/JWT requirement settings) that this environment cannot verify; flagged as an operational check in `12-Production-Certification.md`.

## Storage policies

Reviewed in the prior backend audit (`docs/backend-audit/production-readiness-report.md`'s Storage section, not re-litigated in full here): `community-reports` bucket is explicitly public (correct — photo URLs must be readable cross-user, matching the community-reports read model); `avatars`/`contact-avatars` buckets are not yet confirmed to physically exist (their creation SQL is commented out) — an operational verification item, not a code defect. No storage-object cleanup job exists for orphaned photos after a referencing row is deleted (carried over, tracked in `docs/backend-hardening/05-Retention.md`).

## Rate limiting

Real, shared (Supabase-backed, survives autoscale) rate limiting exists for `/sos/alert` (20/hour/uid) and email-OTP (5/hour/email + 20/hour/IP). `/sakhi/chat` has an in-memory limiter (30/hour) that resets per instance — a known, lower-severity gap for a non-safety-critical, cost-bounded feature (the underlying OpenAI call cost is the real constraint, not abuse per se). `/nearby-places`, `/community-reports` (both routes), `/auth/sessions`, and `/auth/account` have **no numeric rate limit**, relying on Firebase-token authentication alone — see `08-Abuse-Prevention.md` for the full risk assessment and recommendation.

## Audit logging

No dedicated audit-log table/mechanism exists for security-relevant events (who read/wrote what, when) beyond: (a) pino's structured request logs (method/path/status per request, no bodies), (b) Sentry breadcrumbs/exceptions when configured, (c) the `sos_idempotency_cache`/`rate_limit_counters` tables' own timestamps (incidental, not designed as an audit trail). For a safety app, a durable audit trail of who accessed/modified `emergency_contacts`, `sos_events`, and `community_reports` moderation actions would be valuable for incident response (see `09-Incident-Response.md`) but does not exist today — tracked as a P2 recommendation, not a code defect (building one is a genuine feature addition, not a fix).
