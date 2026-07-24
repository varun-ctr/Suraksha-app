# 12. Production QA Certification

## Scope and method

This pass certified production reliability across 19 critical user flows, 14 emergency-scenario categories, offline behavior, device/OS compatibility, background reliability, stress-test design, regression suite composition, crash resilience, manual QA readiness, automation coverage, and production monitoring — under an active **Release Freeze** where only confirmed launch-blocking defects may be fixed. Three parallel research passes gathered evidence with file:line citations; the emergency/offline/background sections drew additionally on this session's own prior SOS, journey, backend-hardening, and performance-certification phases rather than re-deriving already-established, already-tested facts. No physical device, simulator, or CI pipeline was available in this environment — every finding is either a structural code fact, a directly-reproduced result (e.g. the `purchasesService.ts` test-import failure, reproduced and shown below), or an explicitly-labeled requirement for real-device validation.

## Scores

| Metric | Score |
|---|---|
| Critical Flow Reliability | **8/10** |
| Emergency Reliability | **8.5/10** |
| Offline Reliability | **7.5/10** |
| Automation Coverage | **5.5/10** |
| Manual QA Readiness | **7/10** |
| Device Compatibility | **6.5/10** |
| **Overall QA Readiness** | **7/10** |
| Estimated TestFlight Readiness | **~75%** |

**Rationale**: Emergency Reliability scores highest because the app's core safety mechanisms (SOS/journey wall-clock recovery, offline queue, idempotent writes, request de-duplication) were already built and hardened across four prior certification phases, and this pass found no new defect in them — only already-known, already-reasoned deferred items. Automation Coverage is the clear weak point: 100 passing unit tests are all pure-logic, and the single most important file in the app (`SafetyContext.tsx`, 819 lines) has zero test coverage, alongside zero E2E/integration/contract tooling of any kind. Device Compatibility is capped by a genuine, structural gap: this repo's Continuous-Native-Generation setup means the actual minimum supported iOS/Android version **cannot be read from any file in this repository** — it only exists in a generated native project this environment cannot produce.

## P0 Issues

**None.** No crash, no auth-broken, no SOS-untriggerable, no journey-failure, no background-tracking-failure, no notification-failure, no data-loss, no P0/P1 security vulnerability, no App Store rejection issue, no payment failure, and no backend-outage was found in this pass.

## P1 Issues

1. **Zero test coverage for `SafetyContext.tsx`** (819 lines, the core SOS/journey state machine). Not fixed — testing it properly requires either new component-test infrastructure or a structural extraction of more pure logic, both out of scope under freeze.
2. **No E2E/integration/contract test tooling exists anywhere in this codebase.** Confirmed by direct search (no Detox/Maestro/Playwright/Jest/Pact). Not fixed — introducing any of these is new infrastructure, not a targeted fix.
3. **The actual minimum supported iOS/Android version cannot be verified from this repository** — no native project directory exists (Expo CNG model), so `05-OS-Matrix.md` cannot state a real number without fabricating one. This blocks a fully-confident App Store/Play Store submission-readiness claim until a real `eas build`/`expo prebuild` is run and its output inspected.
4. **Contact-edit remote-sync failures are silent** (`AppContext.tsx`) — local and Supabase-side contact lists can diverge with no user-visible indicator and no retry queue. Not a launch blocker (no local data loss, no crash) but a real, previously-undocumented gap.
5. **No production telemetry exists for notification-delivery or location-fetch failures** — confirmed gap, not assumed. Both are squarely "Observability improvement" (an allowed freeze category) but were not added this pass to keep this already-large certification pass properly scoped; flagged as the top recommendation for the next release.

## P2 Issues

1. Community incident reports have no offline queue (unlike SOS/journey) — a submission attempted offline fails immediately with a generic message; form state is preserved for retry. Reasonable scope boundary for a non-time-critical feature, not a defect.
2. Account-deletion's `auth/requires-recent-login` case shows a message but has no in-app reauthentication screen wired to it (`reauthenticateWithPassword` exists but is uncalled) — a manual sign-out/in workaround exists; not a dead end, but real friction.
3. `features/premium/services/purchasesService.ts` has zero test coverage, including an easily-testable pure function (`hasPremiumEntitlement`). **Attempted this pass, reverted** — see "Accepted/Rejected Changes" below for the full account of why.
4. `features/journey/services/journeyPersistence.ts` has an empty, unpopulated test stub directory.
5. Backend outage/infra-level detection is only partially covered (request-level 5xx + explicit alert call sites exist; no in-repo uptime/health-check monitor — may exist outside this codebase, unverifiable from here).

## P3 Issues

1. Settings' background-location toggle sets local preference state with no accompanying OS permission check at toggle-time (the actual permission is correctly requested at SOS-trigger time regardless) — reviewed, not confirmed as a functional bug, flagged for product clarification.
2. No dedicated Android tablet layout verification exists (mirrors the already-documented `supportsTablet: false` iOS finding from the UX-certification phase).
3. No client-side message-delivery *confirmation* (receipts) for SMS/WhatsApp alerts to trusted contacts — the app can confirm the OS accepted the send request, not that the contact's device received it. Feature enhancement, not a regression.

## Accepted Changes

**None — no code was changed this pass.** Every finding above either (a) was already mitigated by a prior certification phase and required no further action, (b) was investigated and confirmed to be a non-issue upon verification (see below), or (c) requires new test infrastructure, a structural refactor, or real build/device infrastructure this environment cannot safely provide within Release Freeze constraints. This is a valid, and expected, outcome for a QA-planning-and-validation phase running after eight prior phases that already fixed the concrete, fixable bugs — consistent with "only launch-blocking defects may be fixed," and none were found.

**One finding investigated and confirmed as a non-issue** (documented, not "fixed," since there was nothing broken): the account-deletion flow's client-side `resetAllData()` skips its own remote contact-deletion call (uid is null post-`deleteUser()`) — traced into the backend (`artifacts/api-server/src/routes/auth.ts:9-15,56-87`) and confirmed the backend's `DELETE /auth/account` handler authoritatively deletes `emergency_contacts`/`sos_events`/`journeys`/`live_sessions` server-side, keyed to the request's verified UID, *before* the client's Firebase `deleteUser()` call runs. The client-side skip is genuinely harmless, not a data-retention bug.

## Rejected Changes

**One test addition attempted, then reverted before commit**: a unit test for `purchasesService.ts`'s `hasPremiumEntitlement()`. Reproduced and confirmed the import fails under this project's plain Node test runner (`SyntaxError: Unexpected token 'typeof'` from `react-native/index.js`, since the file's top-level imports of `expo-constants`/React Native's `Platform` transitively load the real `react-native` package, which uses Flow syntax the Node runner can't parse). Fixing this properly requires extracting the pure function into a dependency-free module — a structural change, not a pure test addition — so it was reverted rather than either (a) shipped as a test that can't run, or (b) accompanied by an out-of-scope refactor. No residual files were left behind (confirmed via `git status`).

## Manual Tests Remaining

The full checklist is `09-Manual-QA.md` (pass/fail, organized by area). Highest-priority items: Apple Sign In on a real iOS device; a real RevenueCat sandbox purchase + restore; SOS behavior across all 14 emergency scenarios in `02-Emergency-Testing.md` on real hardware; the 4-hour background-journey soak test in `06-Background-Testing.md`; all 8 stress-test scenarios in `07-Stress-Testing.md` (especially the 100-SOS-attempts case, which must run against a test/staging backend only).

## Device Tests Remaining

The full matrix is `04-Device-Matrix.md`. Blocking item: an actual `eas build`/`expo prebuild` run to determine the real minimum iOS/Android version (currently unknowable from this repo alone — see `05-OS-Matrix.md`). Once that's resolved, smoke-test coverage across iPhone SE through 16 and representative small/medium/large Android devices per the matrix; iPad and Android tablet are explicitly out of scope (`supportsTablet: false`).

## Production Monitoring Gaps

Two confirmed, specific gaps: no telemetry for notification-delivery failure, no telemetry for location-fetch failure (both detailed in `11-Production-Monitoring.md`). Everything else required by this certification's brief — crash spikes, failed SOS, journey failures, authentication failures, backend failures (partially) — is already detectable via the existing 48-event client telemetry + backend structured logging/alerting.

## Would I certify this application for TestFlight deployment?

**Yes, with two explicit conditions attached, not as an unqualified pass.** No P0 issue exists, and the app's safety-critical paths (SOS, journey) are the most thoroughly hardened and tested part of the entire codebase across this session's eight prior certification phases. However, this certification cannot respons­ibly claim full confidence without: (1) resolving the actual-minimum-OS-version unknown (P1 #3) via a real build before submission, since an OS-version mismatch is a genuine App Store rejection risk this environment literally cannot verify; and (2) acknowledging that TestFlight testers — not this pass — are the first real validation of every item marked "requires real-device validation" throughout this certification (background execution timing, real GPS accuracy, real Apple Sign In, real purchase flows). TestFlight itself is an appropriate and reasonable next step specifically *because* it's the mechanism for closing those exact gaps — this is not a reason to withhold certification, but it is why the estimated readiness is ~75%, not higher.

## Verification performed for this pass

`npx tsc -p tsconfig.json --noEmit`: 0 errors. `pnpm run lint`: 0 errors (9 pre-existing-pattern warnings, unchanged from prior phases). `pnpm run test`: 100/100 passing (unchanged — no test-covered logic was touched). `npx madge --circular`: no circular dependencies across 215 files. `npx expo export --platform web`: builds clean.
