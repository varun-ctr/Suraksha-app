# 9. Regression Gate

Mandatory pre-release validation. **No release passes unless every gate below
passes.** A gate that "mostly passes" has failed.

---

## Gate 1 · TypeScript — BLOCKING

```bash
npx tsc -p tsconfig.json --noEmit
```
**Pass:** 0 errors. **Current: PASS** (verified this phase.)

## Gate 2 · ESLint — BLOCKING

```bash
pnpm run lint
```
**Pass:** 0 errors. Warnings are recorded, not blocking.
**Current: PASS** — 0 errors, 9 pre-existing "unused eslint-disable directive"
warnings, unchanged across the last four phases.

This gate also enforces the architecture boundary: `import/no-restricted-paths`
blocks `shared/` importing from `features/`. It caught a real accidental
violation during the UX phase — the rule is live, not decorative.

## Gate 3 · Circular dependencies — BLOCKING

```bash
npx madge --circular --extensions ts,tsx .
```
**Pass:** none found. **Current: PASS** — clean across 215 files.

## Gate 4 · Unit tests — BLOCKING

```bash
pnpm run test
```
**Pass:** 100% of tests pass. **Current: PASS** — 100/100.

## Gate 5 · Web export — BLOCKING

```bash
npx expo export --platform web
```
**Pass:** completes without error. **Current: PASS.**
Cheapest available proxy for "the bundle actually builds." Not a substitute for
a real native build.

## Gate 6 · E2E — BLOCKING once validated, ADVISORY until first green run

```bash
maestro test .maestro/flows --include-tags safe
```
**Pass:** all `safe`-tagged flows pass.
**Current: NOT YET RUN.** The 10 flows were authored this phase but have never
executed — no device or Maestro CLI existed in the authoring environment.

**Honest status:** this gate is advisory for the first release only, because a
gate that has never run cannot be claimed as protection. It becomes blocking
the moment the suite goes green once on a real device. Do not mark it passed
on the basis that the files exist.

Never include `--include-tags emergency` here — those flows send real alerts.

## Gate 7 · Manual QA — BLOCKING

- [ ] `04-Smoke-Test.md` — 15 min, physical device
- [ ] `06-Tester-Checklist.md` internal section
- [ ] `03-Device-Matrix.md` on at least the minimum device pool

## Gate 8 · Performance — BLOCKING on regression

- [ ] Cold start does not visibly regress
- [ ] No new memory growth over a long session
- [ ] Battery impact of a 1h journey comparable to the prior build
Baseline: `docs/performance-audit/`. **Requires real-device profiling** — no
profiler exists in this environment.

## Gate 9 · Security — BLOCKING

- [ ] No new dependency with a known critical advisory
- [ ] No secret committed (scan the diff)
- [ ] Sentry PII scrubbing tests pass (covered by Gate 4)
- [ ] No new permission added to `app.config.ts` without written justification
Baseline: `docs/security-audit/`, `docs/security-hardening/`.

## Gate 10 · Accessibility — BLOCKING

- [ ] VoiceOver/TalkBack names the SOS trigger, Cancel, and "I'm Safe"
- [ ] Reduce Motion stops both pulse animations
- [ ] Largest Dynamic Type does not clip the countdown number
- [ ] No new interactive element ships without an accessible name
Baseline: `docs/ux-audit/02-Accessibility.md`.

---

## Launch Blocker validation

Release Freeze permits a bypass only for a **Launch Blocker**. Each is listed
below with the evidence available today and what still requires a device.

| Blocker | Evidence available now | Still requires |
|---|---|---|
| **Crash** | Sentry auto-capture + `ErrorBoundary` + pre-render `ErrorUtils` handler, all verified present. `tsc`/lint/madge clean. | Real-device crash-free-session rate from TestFlight |
| **Authentication broken** | All 19 flows traced to code (`docs/qa-certification/01-Critical-Flows.md`); OTP/mapper/reauth logic unit-tested | Apple/Google Sign In on a real device |
| **SOS cannot trigger** | Phase machine traced; activation does not gate on location or network; Maestro flow `06` authored | Flow `06` executed on a device |
| **Journey workflow fails** | `computeJourneyStatus` is pure wall-clock, 6 unit tests; recovery effects verified | 4-hour backgrounded soak test |
| **Background tracking fails** | Task registered at module load by design; verified | Real OS background-execution behavior, both platforms |
| **Emergency notifications fail** | Local-notification backstop verified; **`notification_schedule_failed` telemetry added this phase** so a silent failure is now detectable | Real delivery on device |
| **Data loss** | SOS offline queue + idempotency keys + wall-clock recovery, all tested; account deletion verified against `api-server/src/routes/auth.ts` | Live deletion test against a real account |
| **Security (P0/P1)** | Two prior certification phases; PII scrubbing unit-tested | Ongoing dependency-advisory monitoring |
| **App Store rejection** | Permission strings specific and non-generic; Privacy Manifest present | **Minimum OS versions unknown** (`03-Device-Matrix.md`) — the one open App-Store-risk item |
| **Subscriptions fail** | Purchase/restore paths traced; entitlement check reads both current and legacy keys | Real sandbox purchase — not automatable |
| **Backend outage** | Structured request logging + `captureError`/`captureAlert` at SOS/rate-limit call sites | No in-repo uptime monitor; verify externally |

---

## Sign-off

```
Build:            ______   Date: ______   Signed: ______

Gate 1  TypeScript      [ ] PASS
Gate 2  ESLint          [ ] PASS
Gate 3  Circular deps   [ ] PASS
Gate 4  Unit tests      [ ] PASS
Gate 5  Web export      [ ] PASS
Gate 6  E2E             [ ] PASS  [ ] ADVISORY (not yet validated)
Gate 7  Manual QA       [ ] PASS
Gate 8  Performance     [ ] PASS
Gate 9  Security        [ ] PASS
Gate 10 Accessibility   [ ] PASS

Launch Blockers outstanding: ______
Approved for:  [ ] Internal TestFlight   [ ] External TestFlight
```
