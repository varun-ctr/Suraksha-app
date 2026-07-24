# 12. Production Certification

## Scope and method

This certification reviews `artifacts/suraksha` (mobile) and `artifacts/api-server` (backend) against OWASP MASVS, MASTG-style pentest categories, privacy/PII handling, and App Store/GDPR-adjacent compliance, following directly on from five prior certification phases (architecture, authentication, SOS reliability, journey tracking, backend & database) and one backend-hardening pass, all already complete. **No UI, navigation, or architectural redesign was performed or needed** — this pass is a certification/audit with two small, targeted, safe code fixes (below), consistent with the brief's "certify, don't redesign" objective.

## Cross-cutting theme, stated once and referenced throughout

This is a women's-safety app. Its realistic threat model must include an abuser with physical access to the victim's own device — not only a remote attacker. That single framing is why "no app-level session lock" and "SOS-queue data stored unencrypted locally" are weighted more heavily here than a generic consumer-app audit would weigh them; both findings would be minor in a typical app and are treated as elevated-priority here.

## Fixed in this pass (code)

1. **`api-server/src/routes/sos-alert.ts`** — the `/sos/alert` response, and the value cached into `sos_idempotency_cache`, previously included each contact's `name`/`phone` beyond the route's own declared TypeScript type. Confirmed the mobile client never reads those fields (it matches results back to its own local contact list by `id` only). Removed them — pure data minimization, zero functional impact, verified via `pnpm run typecheck` (0 errors) and the existing test suite.
2. **`api-server/src/lib/otp.ts` + `api-server/src/routes/email-otp.ts`** — five log call sites wrote a caller's plaintext email address to server logs (pino's `redact` config only covers headers, not these explicit body fields). Added a new, unit-tested `maskEmail()` helper (`jo***@example.com`) and applied it at all five sites. Two new tests added (`otp.test.ts`); full backend suite still passes (21/21).

Both changes are backend-only, revertible independently via `git revert`, require no migration/schema change, and were deliberately scoped to findings that were (a) concretely verifiable from the code with no ambiguity, (b) safe to fix without a live device/Supabase project to test against, and (c) zero-risk to existing behavior. Everything else below is review and recommendation, consistent with this phase's stated goal.

## OWASP MASVS Compliance: **~77%**

| Category | Classification |
|---|---|
| MASVS-AUTH | Partially Compliant |
| MASVS-STORAGE | Partially Compliant |
| MASVS-NETWORK | Compliant (L1); pinning tracked separately as L2 |
| MASVS-CRYPTO | Compliant |
| MASVS-PLATFORM | Partially Compliant |
| MASVS-CODE | Compliant |
| MASVS-RESILIENCE | Non-Compliant |

Full detail and evidence in `01-OWASP-MASVS.md`.

## P0 Issues

**None.** No currently-exploitable, critical, launch-blocking vulnerability was found in this pass. The one previously-live critical issue this codebase had (the `community_reports` anon RLS hole) was already identified and fixed in the prior backend-hardening phase.

## P1 Issues

1. **No app-level session lock / biometric gate wired**, despite a complete, working implementation existing (`core/permissions/biometrics.ts`). Given this app's threat model (device-access-capable abuser), this is the highest-value single recommendation in this audit. *Fix requires*: wiring the existing module to an app-foreground/launch gate — a UI-adjacent change appropriately left for explicit product/design sign-off rather than silently added during a certification pass.
2. **SOS offline queue and journey persistence store plaintext GPS/location data unencrypted** in `AsyncStorage` (`features/sos/services/sosOfflineQueue.ts`, `features/journey/services/journeyPersistence.ts`). The primitives to fix this already exist and are proven (`core/storage/cryptoBox.ts`) — not applied here because this touches the app's single most safety-critical retry/crash-recovery path, which this environment cannot device-test before shipping a change to it.
3. **No certificate pinning** — standard limitation of the current Expo managed-workflow architecture, elevated in priority here given the threat model; would require a config-plugin/native change, out of scope for a code-only certification pass.
4. **No root/jailbreak detection** — same reasoning as #3.
5. **No rate limit on `POST /community-reports`** — the one write route where abuse would be cross-user-visible (a shared safety map). Straightforward to add using the exact pattern already proven for `/sos/alert`; not added in this pass since it's a new backend behavior change appropriately left for explicit request.
6. **No request-replay protection beyond SOS/journey/live-session idempotency** — a captured bearer token + body is replayable against most other routes within the token's lifetime.
7. **No Sentry `beforeSend`/PII-scrubbing configured** (mobile or backend) — today's telemetry is clean by construction, but there's no safety net if a future raw error message ever embeds PII.
8. **Missing Apple Privacy Manifest (`PrivacyInfo.xcprivacy`)** — a real App Store submission-blocking gap under current Apple requirements; cannot be authored blind from this environment.

## P2 Issues

1. Camera/photo-library permission denial is silently swallowed in `useContactsScreen.ts` (no user-facing message), inconsistent with `useIncidentScreen.ts`'s explicit toast for the same permission class.
2. OTP verification's hash compare (`hashCode(code) !== row.code_hash`) is not constant-time — low practical severity given the existing attempt cap and rate limits, but a cheap, precise fix (`crypto.timingSafeEqual`).
3. No audit-log trail for security-relevant reads/writes (who accessed/modified emergency contacts, SOS events, moderation actions).
4. No self-service "sign out of all other devices" — relevant given the app's threat model for lost/stolen-device and abuser-access scenarios.
5. `eas.json` still has placeholder App Store Connect / Apple Team ID values — submission pipeline incomplete.
6. No published security-disclosure policy/contact (`SECURITY.md` or equivalent).

## P3 Issues

1. `logger.error` in the mobile logger isn't gated by `__DEV__` unlike `warn`/`info`/`debug` — currently only called with non-PII arguments, a latent inconsistency rather than a live issue.
2. RevenueCat env-var naming drift between `config.ts`'s "recommended" names and what `purchasesService.ts` actually reads — means `validateConfig()`'s warning never accurately reflects RevenueCat configuration state.
3. Stale `app.json` alongside the authoritative `app.config.ts` — no functional impact, but could mislead a future reader/auditor.
4. No data-portability ("export my data") feature — a GDPR-adjacent completeness gap, not a security defect.

## Scores

| Metric | Score |
|---|---|
| Overall Security Score | **7.5/10** |
| OWASP MASVS Compliance | **~77%** |
| Privacy Score | **8/10** |
| Compliance Score | **6.5/10** |
| Abuse Resistance Score | **7.5/10** |
| Estimated Security Readiness | **80%** |
| Estimated App Store Compliance | **~70%** |

**Rationale for Security Readiness (80%) vs. MASVS % (77%)**: readiness weights the *practical* launch risk (zero P0s, a strong backend/RLS/idempotency foundation already certified in prior phases) slightly above the raw category-averaged MASVS score, which is pulled down specifically by the RESILIENCE category — a category most consumer mobile apps also score Non-Compliant on, and one that (pinning/root-detection aside) doesn't block a first production launch for an app whose real trust boundary is server-side (RLS + verified tokens), which this audit confirmed is solid.

## Would I certify this application for production security review?

**Yes, conditionally.** There is no P0. The architecture, authentication, backend, and abuse-prevention foundations (five prior phases plus this one) are genuinely solid, and the two concrete PII-hygiene findings this pass surfaced were fixed on the spot. Certification should be conditioned on:
1. Deploying the P1 fixes that are well-scoped and low-risk to add without a live device/project (community-reports rate limiting, Sentry scrubbing).
2. A product decision + follow-up implementation pass for the app-lock/biometric wiring and SOS-queue encryption — both P1, both requiring device testing this environment cannot perform, and both squarely justified by this app's specific threat model.
3. Resolving the Privacy Manifest gap before any App Store submission — this one is a hard submission blocker, not a "nice to have."

None of the remaining items require an architectural redesign, and none weaken any existing security control — every recommendation in this document is additive.

## Distinguishing what requires what

**1. Issues fixed in code (this pass):**
- `/sos/alert` no longer returns/caches contact name/phone unnecessarily.
- Email addresses masked in backend logs (5 call sites + a new tested helper).

**2. Issues requiring Firebase/Supabase configuration (operational, not code):**
- Verify PITR/backup configuration (carried over, unchanged).
- Verify the `journey-deadline-check` Edge Function's own invocation-auth settings once deployed.
- Rotating the service-role key or any backend secret, if ever needed, is an env-var + redeploy operation.

**3. Issues requiring App Store configuration (operational, not code):**
- Author and bundle `PrivacyInfo.xcprivacy`.
- Fill in App Privacy Nutrition Labels in App Store Connect (data inventory in `03-Privacy-Audit.md` is ready to use as the source of truth).
- Replace `eas.json`'s placeholder App Store Connect App ID / Apple Team ID.

**4. Issues requiring operational processes (not code, not a dashboard toggle):**
- Publish a security-disclosure policy/contact.
- Establish a key-rotation runbook and a tested restore-from-backup drill (both carried over from the backend-hardening pass, still open).
- Decide the data-retention policy for `sos_events`/`journeys`/`community_reports` (carried over, still open).
- Design and validate Sentry PII-scrubbing rules against a real Sentry environment before enabling `beforeSend`.

## Verification performed for this pass

- `api-server`: `pnpm run typecheck` — 0 errors. `pnpm run test` — 21/21 passing (including 2 new `maskEmail` tests).
- `suraksha` (mobile): no files were changed in this pass, so its own `tsc`/`lint`/`test`/`madge`/`expo export --platform web` results are unchanged from the immediately-prior backend-hardening certification (0 TypeScript errors, 0 ESLint errors with 9 pre-existing-pattern warnings, 82/82 tests passing, no circular dependencies, clean web export) — re-confirmed as part of this pass's final verification step to be certain nothing regressed.
