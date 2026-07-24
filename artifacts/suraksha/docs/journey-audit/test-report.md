# 9. Test Report

`pnpm run test` — **72/72 passing**, 0 failures. This pass added 6 new tests; all 66 pre-existing tests (auth, SOS, startup-capability, mappers, phone/message utils) still pass unmodified.

## New tests this pass

### `domain/policies/__tests__/journeyRecoveryPolicy.test.ts` (6 tests)

| Test | Scenario covered |
|---|---|
| "well within the planned duration is active, with correct seconds remaining" | The common case — a journey ticking normally |
| "exactly at the duration boundary transitions to overdue, not active" | Boundary condition: `elapsedSec === durationSec` must be overdue, not still active |
| "partway through the grace period is overdue with the correct remaining countdown" | The countdown value shown to the user during the grace period |
| "exactly at the grace-period boundary is expired, not overdue" | Boundary condition: the exact moment auto-SOS should fire |
| "long past the grace period ... is still just expired, not a crash or a negative countdown" | The specific scenario this whole fix exists for — an app backgrounded/killed for hours must resolve cleanly to "expired," not throw, not produce a nonsensical negative value |
| "a timestamp before startedAtMs (clock skew) clamps to zero elapsed rather than going negative" | Defensive: a slightly-wrong device clock or an out-of-order recovery read must not produce garbage output |

## Why this module, specifically

`journeyRecoveryPolicy.ts` is the one new piece of **pure decision logic** this pass introduces — zero native/network/AsyncStorage dependencies, making it directly unit-testable in the plain Node test runner this repo already uses (no mocking framework, no RN testing library). This matches the established pattern from every prior audit this session (`sosRecoveryPolicy.ts`, `liveSessionPolicy.ts`) — pure logic gets tests; native-dependent orchestration wrappers do not, by the same convention.

## Scenario-level verification performed (code-path review, not executed against a device)

Per the brief's requested test list — journey creation, journey completion, offline tracking, offline recovery, background updates, permission changes, GPS timeout, duplicate locations, duplicate journeys, crash recovery, reconnect, zombie cleanup, destination reached, geofence triggers — every reachable one of these is traced through actual code in the **Reliability Audit** (`reliability-audit.md`), classified, and mapped to the specific mitigating code path. Several items on that list (destination reached, geofence triggers, duplicate GPS points, reconnect, zombie session cleanup) do not apply to journey's actual scope as a check-in timer rather than a continuous-tracking/live-session feature — see the Architecture Diagram's scope note and the Technical Debt Report for why these aren't fabricated as tested when the underlying capability doesn't exist.

## What is NOT covered by automated tests (and why)

- **`SafetyContext.tsx`'s journey orchestration itself** (the tick effect, the recovery effect, `startJourney`/`endJourney`/`checkInJourney`) — would require mocking React's effect lifecycle, `AsyncStorage`, Firebase auth, and the Supabase repository simultaneously; no such harness exists in this repo for any feature's context provider, not just journey's. The pure logic it depends on (`computeJourneyStatus`) is fully tested in isolation instead, which is where the actual risk of a boundary-condition bug lives.
- **`journeyRepository.ts`'s Supabase calls** — not directly unit tested, matching the established convention (`liveSessionRepository.ts`/`sosEventsRepository.ts` aren't either) — these require a live or mocked Supabase client, which this test setup doesn't provide for any repository.
- **The local notification's actual delivery timing** — inherently requires a real device/OS scheduler to verify; the *code* that computes the correct remaining-seconds value to schedule it with is straightforward arithmetic, reviewed by hand (see Reliability Audit).

## Full verification suite run for this pass

- `npx tsc -p tsconfig.json --noEmit` — 0 errors
- `pnpm run lint` — 0 errors, 9 warnings (all pre-existing-pattern "unused eslint-disable directive," one newly appearing in the rewritten journey section of `SafetyContext.tsx` for the same reason as the SOS pass's equivalent — not an architecture-boundary violation)
- `pnpm run test` — 72/72 passing
- `npx madge --circular` — no circular dependencies found across 198 files
- `npx expo export --platform web` — builds clean
