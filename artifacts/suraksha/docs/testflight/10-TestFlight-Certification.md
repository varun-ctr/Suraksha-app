# 10. TestFlight Certification

## Scope and method

This phase built test infrastructure and assembled a TestFlight validation
package, under an active Release Freeze. Evidence came from direct inspection
of the repository and from commands actually run — not from assumption. No
device, emulator, Maestro CLI, or profiler existed in the environment, and
every claim below is labelled accordingly.

## Scores

| Metric | Score |
|---|---|
| Unit Test | **6/10** |
| Integration Test | **2/10** |
| E2E Readiness | **5/10** |
| Device Testing Readiness | **5/10** |
| TestFlight Readiness | **7/10** |
| Regression Protection | **7/10** |
| **Overall Test Infrastructure** | **5.5/10** |
| Estimated Production Confidence | **~72%** |

**How these were reasoned.** Unit at 6: 100 tests that genuinely pass, but all
pure-logic, no coverage instrumentation, and the app's most important file
untested. Integration at 2: nothing wires two real modules together; the only
credit is that mappers and error-mappers sit on real boundaries. E2E at 5: a
designed, safety-gated, selector-grounded suite exists — worth real points —
but it has never executed, and unrun tests protect nothing. Device at 5: the
matrix and criteria are specific and actionable, but the minimum-OS question is
still open. TestFlight at 7: the process package is complete and the blocking
prerequisites are identified precisely rather than vaguely. Regression at 7:
five automated gates genuinely pass today and an architecture-boundary rule is
demonstrably live.

Overall 5.5 is deliberately not generous. This phase produced a good *plan* and
two real observability improvements; it did not produce executed tests, and
scoring it as though it had would be the single easiest way to mislead the
reader of this document.

## Accepted Changes (Release Freeze)

### 1. Location-failure telemetry

- **Classification:** Accepted — Observability improvement (category 10). Not a
  Launch Blocker; queued for the next scheduled release.
- **Reason:** `core/permissions/location.ts` returned `null` on both permission
  denial and fetch failure. Correct behavior — a location failure must never
  block an SOS — but it left production unable to distinguish "user has location
  off" from "the OS geocoder is failing" during an emergency. Identified as a
  confirmed gap in `docs/qa-certification/11-Production-Monitoring.md`.
- **Risk:** Low. New file plus three call sites inside existing `catch`/guard
  branches. Emits a Sentry breadcrumb, no-ops without a DSN, wrapped in
  try/catch.
- **Regression risk:** None. No control flow changed — every branch returns
  exactly what it returned before.
- **Rollback:** Delete `core/analytics/locationTelemetry.ts`, revert the four
  lines in `core/permissions/location.ts`.
- **Expected benefit:** Location failures during a live SOS become visible in
  production for the first time.
- **Files:** `core/analytics/locationTelemetry.ts` (new),
  `core/permissions/location.ts`.

### 2. Notification-failure telemetry

- **Classification:** Accepted — Observability improvement (category 10). Not a
  Launch Blocker.
- **Reason:** Every failure path in `core/permissions/notifications.ts` is
  deliberately non-fatal and silent. The most consequential is
  `scheduleLocalNotification` returning `null`: that call schedules the
  journey-overdue notification, the durability backstop that fires even when
  the OS never wakes the JS engine. If it silently failed, the backstop was
  gone and nothing anywhere reported it.
- **Risk:** Low. New file plus six call sites, all inside existing `catch` or
  denial branches.
- **Regression risk:** None. No return value or control flow changed.
- **Rollback:** Delete `core/analytics/notificationTelemetry.ts`, revert the six
  lines in `core/permissions/notifications.ts`.
- **Expected benefit:** Closes the second of the two monitoring gaps carried
  since the QA phase, and makes the highest-consequence silent failure in the
  journey subsystem detectable.
- **Files:** `core/analytics/notificationTelemetry.ts` (new),
  `core/permissions/notifications.ts`.

### 3. Maestro E2E infrastructure

- **Classification:** Accepted — Test improvement. Zero production impact.
- **Reason:** No E2E tooling of any kind existed (verified). This is the
  automation gap flagged as P1 in the QA certification.
- **Risk:** None to production. Twelve YAML/Markdown files under `.maestro/`.
  No npm dependency is added — Maestro installs as a standalone CLI — so
  `package.json`, `pnpm-lock.yaml`, and the bundle are untouched. The
  acceptance criterion "new automation must not change production behavior" is
  satisfied structurally, not by inspection.
- **Regression risk:** None. Nothing imports these files.
- **Rollback:** Delete `.maestro/`.
- **Expected benefit:** A safety-gated, selector-grounded E2E skeleton that a
  QA engineer can run immediately instead of authoring from scratch.
- **Files:** `.maestro/config.yaml`, `.maestro/README.md`, 10 flows.

### 4. TestFlight documentation package

- **Classification:** Accepted — Documentation. No code impact.
- **Files:** `docs/testflight/` (10 files).

## Rejected Changes

| Proposal | Why rejected |
|---|---|
| Add Jest + React Testing Library to test `SafetyContext.tsx` | New test infrastructure and new dependencies. The highest-value target, but a second test runner during freeze is exactly the kind of change freeze exists to defer. First post-freeze priority. |
| Extract `hasPremiumEntitlement` into a testable module | Structural refactor. Re-confirmed this phase that the file cannot be imported by the current runner; the fix is a code change, not a test addition. |
| Add coverage instrumentation | New tooling; would also surface a low percentage that invites reactive test-writing during freeze. |
| Detox instead of Maestro | Assumes native-project access this CNG repo does not have, and adds dependencies. |
| Write E2E flows for Apple Sign In / purchases | Cannot be driven reliably; a stubbed version would manufacture false confidence in the paths carrying real money and real identity. |
| Backend test suite | Out of the mobile app's scope for this phase. |
| Fix any known issue found in prior phases | None is a Launch Blocker. Freeze holds. |

## Launch Blockers Remaining

**One, and it is procedural rather than a defect:**

**Minimum supported OS versions are unknown and unknowable from this
repository.** No `deploymentTarget`, no `minSdkVersion`, and no `ios/`/`android/`
directories (Expo CNG). This matters because App Store and Play Store both
validate the submitted binary's minimum-OS against current policy, making it a
genuine rejection risk. Resolution is mechanical — run `expo prebuild` or read
an `eas build` artifact — but it must happen before submission.
Procedure: `03-Device-Matrix.md`.

Also blocking, and equally mechanical: the placeholder values in `eas.json`
(`ascAppId`, `appleTeamId`) and the `example.com` / `TODO_EAS_PROJECT_ID`
fallbacks in `app.config.ts` must be confirmed as real injected values.
A build carrying the `example.com` fallback launches fine and fails every
backend call.

No functional Launch Blocker was found in any of the eleven categories.

## Manual Tests Remaining

`04-Smoke-Test.md` (15 min, every build), `06-Tester-Checklist.md` (internal +
external), `03-Device-Matrix.md` (10 checks × device). Highest-value items that
can never be automated: Apple Sign In, sandbox purchase and restore, real SMS
delivery, the 4-hour backgrounded journey, and overdue auto-SOS escalation.

## Automation Remaining

Execute the Maestro suite and fix selectors until green — this is the step that
converts the suite from a plan into protection. Then: add Logout, Registration,
and Community Report flows; add a React-Native-capable runner and test
`SafetyContext.tsx`; add coverage instrumentation; consider contract tests
against `api-server`.

## Recommended E2E Framework

**Maestro.** Full comparison in `02-E2E-Plan.md`. Decisive factors: it drives
the installed binary and so is indifferent to Continuous Native Generation
(Detox is not), and it adds zero npm dependencies — which under Release Freeze
is the difference between a change that cannot affect production and one that
needs to be argued about.

## Would I certify for Internal TestFlight?

**Yes.** All five automated gates pass. Every critical flow has been traced to
real code across this and the QA phase. The safety-critical paths carry the
most hardening in the codebase. The two observability gaps carried since the QA
phase are now closed, so an internal round will produce better failure data than
one run a week ago. Internal testers are the correct mechanism for closing the
device-dependent gaps, and the blocking prerequisites above are all verifiable
during internal distribution.

## Would I certify for External TestFlight?

**Not yet — three conditions first.**

1. **Resolve the minimum-OS question.** Real Beta App Review risk, mechanically
   resolvable, unacceptable to submit blind.
2. **Execute the Maestro suite green at least once, and complete one internal
   round on the minimum device pool.** External testers are the public. Sending
   them a build whose E2E suite has never run means the first execution of these
   flows happens on strangers' phones, in a safety app.
3. **Confirm the injected production config and the placeholder-free
   `eas.json`.**

None is a code defect and none requires lifting the freeze. All three are
verification steps that need infrastructure this environment does not have.
Once they are done, external certification follows without further code changes.

## Verification performed for this pass

`npx tsc -p tsconfig.json --noEmit`: 0 errors. `pnpm run lint`: 0 errors (9
pre-existing warnings, unchanged). `pnpm run test`: 100/100 passing.
`npx madge --circular`: clean across 215 files. `npx expo export --platform
web`: builds clean.

The Maestro suite is **not** included in that list because it was not run. Its
absence from the verification line is deliberate.
