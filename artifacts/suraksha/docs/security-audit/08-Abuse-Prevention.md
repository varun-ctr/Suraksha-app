# 8. Abuse Prevention

## SOS abuse

- Rate-limited: 20/hour/uid, shared across autoscaled instances via a Supabase-backed counter (`api-server/migrations/001_sos_idempotency_and_rate_limit.sql`, `sos-alert.ts:16,138-142`) — not an in-memory-per-instance counter that a client could bypass by hitting a different backend instance.
- Idempotency-cached: a retried request with the same `idempotencyKey` returns the cached result instead of re-sending SMS via Twilio — prevents a client-side retry bug (not malice) from spamming a real contact, and (as a side effect) bounds how many times an attacker could force-resend within the 5-minute cache window even with a captured key.
- Request body is Zod-validated and bounded (`SendSosAlertBody.safeParse`) — contact list and message length are capped, so a single request can't fan out to an unbounded number of Twilio sends or an oversized message body.
- Database-level idempotency (partial unique index on `sos_events(user_id, idempotency_key)`) prevents duplicate emergency *records* even if the rate limit/cache is somehow bypassed.

**Residual risk**: a legitimately-authenticated but malicious/compromised account is rate-limited to 20 real SOS-alert dispatches/hour — reasonable for a genuine safety feature (a real user in repeated distress shouldn't be blocked), but this is also the practical ceiling on how much Twilio spend/contact-spam a single compromised account could generate. Acceptable given the mitigating idempotency/validation controls above.

## Journey abuse

Journeys are owner-scoped (RLS), have DB-level duplicate-insert protection via a client-generated UUID primary key with retry-and-adopt semantics (prior phase), and now have bounded `duration_minutes` (1–1440, backend-hardening pass's CHECK constraint) preventing a malformed/malicious client from writing a nonsensical duration. No rate limit exists specifically on journey creation — not flagged as a gap, since a journey write has no external side effect (no SMS/Twilio cost) unless it later escalates via `/sos/alert`, which *is* rate-limited.

## Community-report abuse (fake reports / spam)

- Owner-scoped RLS write (fixed anon hole in the backend-hardening pass) means every report is attributable to a real, authenticated Firebase account — not anonymous.
- `type` is now constrained to the app's actual 11-value enum (backend-hardening pass fixed a bug where the DB only accepted 4 of the 11 values) and coordinates are bounds-checked — prevents malformed data, not malicious-but-well-formed spam.
- **No rate limit exists on `POST /community-reports`** — a compromised/malicious authenticated account could submit an unbounded number of reports per hour. Given reports are cross-user-visible (the shared safety map), this is a more meaningful gap than most other unrated-limited routes: a spam/fake-report flood would be visible to every other user, not just consumable by the attacker's own account. **Recommended**: apply the same per-uid rate-limit pattern already proven for `/sos/alert` (e.g. `checkRateLimit("community_report", uid, {windowSeconds: 3600, limit: 10})`) — a small, low-risk, well-precedented addition. Not implemented in this pass (a genuine new backend behavior change, appropriately left for explicit request rather than added silently during a certification pass).
- No moderation UI/workflow currently consumes `moderation_status` (confirmed dead-code `listAll()` in a prior phase) — meaning even though the schema supports removing a report, nothing in the shipped product currently exercises that path. This is a product-completeness gap more than a security one.

## API abuse generally

Rate-limiting coverage gap: `/nearby-places`, `/auth/sessions`, `/auth/account`, both `/community-reports` routes have no numeric rate limit, relying solely on Firebase-token auth. Risk-ranked:
1. **`/community-reports` POST** — highest residual risk (cross-user-visible spam potential), recommendation above.
2. **`/nearby-places`** — proxies a paid Google API; mitigated by a 5-minute response cache per lat/lng/category, but a malicious account varying coordinates slightly could still generate billable calls. Recommend a coarse per-uid rate limit as defense-in-depth for cost control, not primarily a security fix.
3. **`/auth/sessions`, `/auth/account`, `/community-reports/mine`** — lowest risk; these only let an account read/act on its own data, so "abuse" here is limited to self-inflicted load, not harm to other users.

## OTP abuse

Reviewed in `01-OWASP-MASVS.md`'s MASVS-AUTH section — dual rate limits (per-email + per-IP), attempt-capped verification, constant response shape to prevent account enumeration. This is the most thoroughly abuse-hardened endpoint pair in the backend. One minor finding (non-constant-time hash comparison) is tracked as a low-severity P2/P3 item, not an abuse-prevention gap per se.

## Replay attacks

No request-level replay protection exists beyond the SOS/journey/live-session idempotency mechanisms (which prevent *duplicate records*, not *reprocessing* of a captured request in general — see `06-Network-Security.md`'s "Request signing / replay protection" section). A captured, still-valid bearer token replayed against `/community-reports` POST, for instance, would create a second distinct report with no dedup at all. This is the same underlying gap noted in the network-security review, restated here from the abuse-prevention angle: it's a real, if bearer-token-lifetime-bounded, abuse vector.

## Notification abuse

No mechanism (correct — notification tokens are registered by the app itself post-authentication, not a user-facing input a client can spam; abuse here would require a compromised Firebase project or backend, which is out of scope for a code-level abuse-prevention review).

## Brute force

- OTP: capped and rate-limited (above).
- No password-based login exists (Firebase handles Google/Apple; no local password to brute-force).
- Firebase's own token issuance/verification has its own brute-force resistance (out of this app's code, delegated to Firebase's infrastructure) — appropriate architectural choice.

## Summary — recommended, not implemented (behavior changes appropriately left for explicit request)

1. Add per-uid rate limiting to `POST /community-reports` (highest-value single addition, reuses the existing, proven `checkRateLimit` pattern).
2. Consider a coarse rate limit on `/nearby-places` for cost control.
3. Consider a lightweight replay-window (timestamp + short validity, or a per-request nonce) on write routes beyond SOS, if this app's threat model is judged to warrant it beyond the existing idempotency mechanisms.
