# 9. Test Report

`pnpm run test` (plain Node `--test` runner, `--experimental-strip-types`, no framework/mocking library) — **63/63 passing**, 0 failures, 0 skipped. This pass added 5 new tests across 2 new files; all 58 pre-existing tests (auth, mappers, phone-number utils, emergency-message builder) still pass unmodified.

## New tests this pass

### `features/sos/services/__tests__/sosRecoveryPolicy.test.ts` (3 tests)

| Test | Scenario covered |
|---|---|
| "a pending activation within the recoverable window is not stale" | Crash-recovery resume path — an activation just-triggered or up to just-under-30-minutes old should resume the full active-SOS UI |
| "a pending activation exactly at the cutoff is not yet stale" | Boundary condition at exactly `MAX_RECOVERABLE_AGE_MS` |
| "a pending activation past the cutoff is stale" | An activation minutes-to-hours past the cutoff should NOT resume the UI, only reconcile the DB record silently |

### `domain/policies/__tests__/liveSessionPolicy.test.ts` (2 tests)

| Test | Scenario covered |
|---|---|
| "computeExpiresAt returns a timestamp exactly one timeout window ahead" | The heartbeat/expiry math that makes zombie live-sessions self-clean is correct against a fixed reference time |
| "computeExpiresAt produces a parseable, strictly-future ISO string" | Guards against a subtle bug class (wrong units, `NaN` from a bad `Date` construction) that a single fixed-input test wouldn't catch |

## Why these two modules, specifically

Both are the **new pure decision-logic modules** introduced by this pass's reliability work — deliberately extracted with zero native/network/AsyncStorage dependencies specifically so they're unit-testable in the plain Node test runner already used throughout this codebase (no jest/RN-testing-library setup exists or was introduced). This mirrors the established pattern from the auth-hardening passes (`shouldClearLocalCache`, `isReauthRequired`) — pure logic gets tests; native-dependent orchestration wrappers (`sosOfflineQueue.ts`'s AsyncStorage calls, `core/permissions/backgroundLocation.ts`'s TaskManager/Location calls, `liveSessionRepository.ts`'s Supabase calls) are, by the same established convention, not directly unit tested in this repo — they require a running native runtime or a mocked Supabase client, neither of which this test setup provides.

## Manual / scenario-level verification performed (code-path review, not executed against a device)

Per the brief's requested scenario list — SOS success, cancelled, no internet, poor internet, GPS unavailable, permission denied, notification failure, backend timeout, app killed/restart, offline queue, retry, duplicate taps, multiple contacts, journey escalation, SMS fallback, location timeout — every one of these is traced through actual code in the **Reliability Audit** (`reliability-audit.md`), classified, and mapped to the specific mitigating code path. This document intentionally doesn't duplicate that table; see it for the scenario-by-scenario detail.

## What is NOT covered by automated tests (and why)

- **End-to-end SOS trigger → DB write → alert dispatch flow** — would require mocking Firebase auth, Supabase, `apiFetch`, and native modules (`expo-haptics`, `expo-location`, `expo-task-manager`) simultaneously; no such harness exists in this repo for any feature, not just SOS. Flagged as a Technical Debt item, not silently skipped.
- **Background location task behavior** — `TaskManager.defineTask`'s callback can only be meaningfully exercised on a real device/simulator with actual OS-level location delivery; this is inherently outside what a Node unit test can verify.
- **`sosAlertService.sendSosAlerts`'s branching (backend success/failure/retry, per-contact fallback)** — logic is straightforward and already reviewed by hand (see Reliability Audit, FMEA); not covered by an automated test because doing so would require mocking `apiFetch`/`callNumber`/`sendSms`, which no other service-layer file in this codebase currently does either. Extracting the retry/fallback *decision* into a pure function (given the same treatment as `sosRecoveryPolicy`/`liveSessionPolicy`) is a reasonable low-effort follow-up, noted in the Technical Debt Report.

## Full verification suite run for this pass

- `npx tsc -p tsconfig.json --noEmit` — 0 errors
- `pnpm run lint` (ESLint) — 0 errors, 8 warnings (all pre-existing-pattern "unused eslint-disable directive" warnings, 3 of them newly appearing in the rewritten `SafetyContext.tsx` for disables that turned out unnecessary once the file was restructured; not errors, not architecture-boundary violations)
- `pnpm run test` — 63/63 passing
- `npx madge --circular` — no circular dependencies found across 186 files
