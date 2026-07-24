# 1. Test Strategy & Coverage Audit

## Current automated coverage — measured, not estimated

`pnpm run test` → **100 passing / 0 failing**, across 18 files. Every one is a
pure-logic unit test running under Node's built-in test runner
(`node --test --experimental-strip-types`). All 18 files are matched by the
11 glob patterns in `package.json`'s test script — no test file is silently
excluded from the suite.

| Test type | Status | Evidence |
|---|---|---|
| Unit | **Present** — 100 cases | 18 files across `domain/policies`, `core/storage`, `core/network`, `core/analytics`, `core/capabilities`, `shared/utils`, `features/*/utils`, `repositories/*` |
| Integration | **Absent** | No test wires two real modules together across a boundary |
| Repository | **Partial** | Mappers and error-mappers are tested (`authUserMapper`, `emailOtpErrorMapper`, `reauthCheck`); no repository's actual I/O path is tested |
| Hook | **Absent** | No React hook is tested — no renderer is installed |
| Component | **Absent** | No component is rendered in any test |
| Context | **Absent** | `SafetyContext.tsx` (819 lines, the SOS/journey state machine) has zero coverage |
| Backend | **Absent in this repo** | `artifacts/api-server` has no test suite |
| API contract | **Absent** | No Pact or equivalent between app and `api-server` |
| E2E | **Authored this phase, not yet executed** | 10 Maestro flows in `.maestro/flows/` |
| Snapshot | **Absent** | No snapshot tooling installed |
| Mutation | **Absent** | No Stryker or equivalent |
| Coverage report | **Absent** | No coverage instrumentation is configured; the 100-test figure is a pass count, not a line/branch percentage. Stated plainly rather than presented as a coverage number it is not. |

## Why the gaps exist — mechanical, not negligent

The test runner is plain Node with TypeScript type-stripping. It can only
import modules whose transitive import graph is free of React Native. This was
verified directly, twice this session:

- Importing `features/premium/services/purchasesService.ts` fails with
  `SyntaxError: Unexpected token 'typeof'` from `react-native/index.js` (Flow
  syntax the Node runner cannot parse).
- Importing any `core/analytics/*Telemetry.ts` fails with
  `ERR_MODULE_NOT_FOUND` on `@sentry/react-native`'s internal exports.

So the untested modules are not untested by oversight — they are *unreachable*
by the current runner. Closing those gaps requires a second test runner
(Jest + React Native preset, or Vitest with RN mocked), which is new
infrastructure and therefore out of scope under Release Freeze. It is the
top-priority recommendation for the first post-freeze release.

## Priority and risk of each missing area

| Missing area | Priority | Risk if it stays missing |
|---|---|---|
| `SafetyContext.tsx` context/state-machine tests | **P1** | Highest-consequence file in the app. Its pure decision logic (`sosRecoveryPolicy`, `journeyRecoveryPolicy`) *is* tested; the orchestration that calls it is not. A regression in phase transitions or effect wiring would ship undetected. |
| E2E execution (flows exist, unrun) | **P1** | Flows are authored but unvalidated. Until first run they are a plan, not a safety net. |
| Component/hook tests | **P2** | UI regressions are currently caught only by manual QA. |
| API contract tests | **P2** | App and backend can drift silently; partially mitigated by both being in one repo and changed together. |
| Backend test suite | **P2** | Backend correctness rests on review plus the app's own integration behavior. |
| Coverage instrumentation | **P3** | Cannot currently answer "what fraction of the code is exercised" — only "these 100 assertions pass." |
| Mutation testing | **P3** | Meaningful only once line coverage is materially higher. |

## Strategy going forward

1. **Freeze period (now):** unit tests + the authored Maestro suite + the
   manual regression gate (`09-Regression-Gate.md`). No new test
   infrastructure.
2. **First post-freeze release:** add a React-Native-capable test runner and
   use it for `SafetyContext.tsx` first — it is the single highest-value
   target and the only P1 that new infrastructure unlocks.
3. **Ongoing:** execute the Maestro suite on every release candidate; promote
   flows from "authored" to "validated" as each first passes on a real device.

## Verification

`npx tsc --noEmit`: 0 errors. `pnpm run lint`: 0 errors (9 pre-existing
warnings, unchanged). `pnpm run test`: 100/100 passing.
