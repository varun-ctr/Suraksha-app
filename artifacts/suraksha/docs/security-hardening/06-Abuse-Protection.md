# 6. Community Report Abuse Protection

## The gap this closes

The prior security audit (`docs/security-audit/08-Abuse-Prevention.md`) identified `POST /community-reports` as the highest-residual-risk unrated-limited route: unlike most other unrated-limited endpoints (which only let an account act on its own data), a spam/fake-report flood here would be visible to **every other user** on the shared community safety map.

## What was implemented (`api-server/src/routes/community-reports.ts`)

### 1. Server-side rate limiting

Reuses the exact, already-proven `checkRateLimit` helper `/sos/alert` and email-OTP already use (Supabase-backed, shared across autoscaled instances — not an in-memory-per-instance counter that a client could bypass by hitting a different backend instance): **10 reports per hour per uid**. Chosen to give a genuine user comfortable headroom for real, repeated legitimate use (reporting several unrelated hazards while out) while capping unbounded spam from one compromised/malicious account. A 429 response includes a clear `rate_limited` error the client already surfaces as a toast (see "Client retry safety" below).

### 2. Duplicate prevention / client retry safety

Before inserting, the route checks for an existing report from the same user, same `type`, same `lat`/`lng`, created within the last 60 seconds — if found, it returns that existing row (`200`) instead of inserting a second, visually-identical report. This directly protects against the realistic retry scenario: a client-side network timeout whose insert actually succeeded server-side, followed by the user (or the app) retrying the same submission. No schema migration or client-side idempotency key was needed — this is a content-and-time-window check, the same category of protection `sosEventsRepository`'s `findRecentUnresolvedEvent` already provides client-side for SOS events, applied here server-side instead.

### 3. Spam detection hook

`api-server/src/lib/spamDetection.ts` exports `detectSpamSignals(report)` — called before every insert, logged via `captureAlert` if it ever returns a non-empty result. **Deliberately a no-op today** (always returns `[]`): a real heuristic or ML-based classifier needs actual traffic data to calibrate thresholds against, and getting it wrong in a safety app — incorrectly flagging or hiding a genuine harassment/stalking report — is a worse outcome than not detecting spam at all. This environment has no real traffic to validate thresholds against, so building a real classifier now would mean shipping unvalidated logic on a safety-critical data path. The hook exists as a clean extension point: wiring in a real implementation later requires changing only this one function, not the route.

### 4. Abuse telemetry

New `core/analytics/communityTelemetry.ts` (mirrors `sosTelemetry.ts`'s pattern exactly — bare Sentry breadcrumbs, no data payload, no-ops without a DSN): `community_report_submitted`, `community_report_duplicate_prevented`, `community_report_rate_limited`, `community_report_failed`. Wired into `features/community/hooks/useIncidentScreen.ts`'s existing `submit()` function — the mobile client already receives a `NetworkError` with a `.status` field on failure (`domain/errors/NetworkError.ts`), so distinguishing a 429 (rate-limited) from any other failure required no new plumbing, just reading a field that was already there. A spike in `community_report_rate_limited` breadcrumbs is now a visible abuse/spam signal in aggregate, without ever logging the reporter's identity, the report's content, or its location.

## Client-side UX (unchanged behavior, one new message)

`useIncidentScreen.ts`'s `submit()` keeps its exact existing success/failure structure — the only change is a new branch that shows `t("incident.rateLimited")` ("Too many reports submitted recently — please wait a bit and try again.") instead of the generic error message specifically when the server returns 429, so a legitimately-rate-limited user gets an accurate, actionable message rather than being told to "check your connection."

## Do not reduce usability — how this was honored

- The rate limit (10/hour) is well above any plausible legitimate single-session use.
- Duplicate-prevention only ever *helps* a retrying user (adopts their prior successful submission rather than rejecting the retry or creating a duplicate) — it never blocks a genuinely new report, even one submitted moments after a previous, different one (the check is scoped to the same `type` + exact same coordinates).
- The spam-detection hook currently blocks nothing.
- No existing, already-shipped behavior was changed — every addition is either transparent (rate limiting/duplicate-prevention) or purely additive (telemetry).

## Verification

Backend: `pnpm run typecheck` 0 errors, `pnpm run test` 29/29 passing. Mobile: `npx tsc --noEmit` 0 errors, `pnpm run lint` 0 errors (9 pre-existing warnings), `pnpm run test` 95/95 passing. Both `madge --circular` clean.
