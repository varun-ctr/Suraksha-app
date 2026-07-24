# 10. Automation

## Method

Enumerated every `__tests__` directory and cross-checked against `package.json`'s test-script glob (Node's built-in test runner, `node --test --experimental-strip-types`) to confirm no test file is silently excluded from `pnpm run test`. Ran the suite directly rather than trusting a stale count.

## Already implemented: 100 passing unit tests across 18 files (all pure-logic)

| File | Cases |
|---|---|
| `shared/utils/__tests__/validate.test.ts` | 6 |
| `features/sos/utils/__tests__/emergencyMessage.test.ts` | 6 |
| `features/sos/services/__tests__/sosRecoveryPolicy.test.ts` | 3 |
| `features/community/utils/__tests__/emergencyKnowledge.test.ts` | 4 |
| `features/profile/context/__tests__/localCacheOwnership.test.ts` | 5 |
| `core/storage/__tests__/aesCbcHmac.test.ts` | 11 |
| `core/capabilities/__tests__/nativeCapabilities.test.ts` | 3 |
| `core/analytics/__tests__/sentryScrubber.test.ts` | 8 |
| `core/network/__tests__/inFlightDedup.test.ts` | 5 |
| `domain/errors/__tests__/AppError.test.ts` | 5 |
| `domain/policies/__tests__/liveSessionPolicy.test.ts` | 2 |
| `domain/policies/__tests__/journeyRecoveryPolicy.test.ts` | 6 |
| `domain/policies/__tests__/journeyValidation.test.ts` | 7 |
| `domain/policies/__tests__/retryBackoff.test.ts` | 3 |
| `domain/policies/__tests__/appLockPolicy.test.ts` | 5 |
| `repositories/api/__tests__/emailOtpErrorMapper.test.ts` | 7 |
| `repositories/firebase/mappers/__tests__/authUserMapper.test.ts` | 3 |
| `repositories/firebase/__tests__/reauthCheck.test.ts` | 4 |

All 18 files fall under one of the 11 glob patterns in `package.json`'s `"test"` script — none are orphaned/silently excluded. `pnpm run test` reports **100 pass / 0 fail** (nested subtests account for the difference between the flat per-file count above and 100). One stub directory exists with no test file (`features/journey/services/__tests__/`, empty) — not a glob-exclusion bug, just unpopulated.

## Missing: confirmed gaps, with the reason each isn't trivially fixable under Release Freeze

- **`SafetyContext.tsx`** (819 lines — the core SOS/journey orchestration): **zero test coverage.** It's a React Context/hook wiring native dependencies directly (haptics, crypto, location, notifications, Firebase auth) — the pure *decision* logic it delegates to (`sosRecoveryPolicy`, `journeyRecoveryPolicy`) is tested; the orchestration itself is not, and testing a React hook with this many native dependencies would require either a React Testing Library + native-module-mocking setup (new test infrastructure, not present in this repo) or extracting more pure logic out of it (a structural refactor). Neither is a freeze-appropriate change to attempt in this pass — flagged as the **single most valuable test-coverage investment for a future release**.
- **`features/premium/services/purchasesService.ts`**: zero test coverage, including an easily-testable pure function, `hasPremiumEntitlement(info)`. **Attempted and reverted this pass**: importing this file directly under the plain Node test runner fails immediately, because it has top-level imports of `expo-constants` and React Native's `Platform`, which transitively load the real `react-native` package — this package uses Flow syntax the Node runner can't parse (confirmed by direct reproduction: `SyntaxError: Unexpected token 'typeof'` from `react-native/index.js`). The codebase's own established pattern for testable native-adjacent code (see `core/capabilities/nativeCapabilities.ts`'s header comment) is to keep the tested file's own imports dependency-free and reach native modules via **lazy** `require()` inside functions — `purchasesService.ts` doesn't follow that pattern today. Making it testable would mean extracting `hasPremiumEntitlement` (and potentially `platformKey`) into a new, dependency-free module — a structural change, not a pure test addition, so it was **not done this pass** to respect the "no changes except confirmed launch blockers" constraint. Flagged as a concrete, scoped recommendation for the next release.
- **`features/journey/services/journeyPersistence.ts`**: has an empty, unpopulated `__tests__` stub — no coverage.
- **Maps, Notifications, Localization, Accessibility**: no pure-logic module exists for any of these that isn't already covered above — the code that would need testing is either rendering-dependent (not unit-testable under this project's tooling) or thin OS-permission wrappers with no meaningful branching logic to assert on beyond what's already covered by the `nativeCapabilities` guard tests.

## E2E / Integration / Snapshot / Contract testing

**None of these exist in this codebase today** — confirmed by direct search: no Detox config, no Maestro flows, no Playwright config, no Jest config (the project deliberately uses Node's built-in test runner, not Jest), no contract-testing tool (e.g. Pact) between the mobile app and its backend API. This is a genuine, significant gap for a safety-critical app, but introducing any of these (Detox/Maestro for E2E, a Jest+React-Testing-Library setup for component/snapshot tests) is **new test infrastructure**, not a targeted bug fix — explicitly out of scope for a freeze-era pass that must reject anything beyond confirmed launch blockers. This is the clearest, single largest automation recommendation for the next non-freeze release.

## Cannot be automated at all (requires a human + a real device, permanently)

- Real Apple Sign In native flow and nonce/token round-trip with Apple's servers.
- Real RevenueCat sandbox/production purchase flow and the App Store/Play Store payment sheets.
- Real SMS/call/WhatsApp delivery confirmation to an actual trusted-contact device.
- Real OS background-execution behavior (whether iOS/Android actually wake the JS engine on schedule, whether a force-quit truly halts background tracking).
- Real GPS accuracy in varying physical environments.
- Real screen-reader (VoiceOver/TalkBack) behavioral confirmation — automated accessibility testing tools can check for the *presence* of labels/roles but not confirm the actual spoken/announced experience is coherent.
- Real device-specific rendering (small-screen scroll-reachability of "I'm Safe," per the UX-certification phase's finding).

## Recommendation summary (not implemented this pass — all require either new test infrastructure or a structural refactor, both out of scope under Release Freeze)

1. Extract `hasPremiumEntitlement` (and similar pure logic) out of `purchasesService.ts` into a dependency-free module, then test it.
2. Introduce a component-testing setup (Jest + React Testing Library + native-module mocks) specifically scoped to `SafetyContext.tsx`'s state-machine transitions, which is this codebase's highest-value, currently-untested surface.
3. Introduce Maestro (lower setup cost than Detox for Expo apps) for a minimal E2E smoke suite covering sign-in → SOS trigger → cancel, as the highest-priority real-device-adjacent automation investment.

## Verification

`npx tsc --noEmit`: 0 errors. `pnpm run lint`: 0 errors. `pnpm run test`: 100/100 passing. No test files were added or modified this pass (the one attempted addition was reverted after confirming it would fail under this project's test runner, and no residual files were left behind — confirmed via `git status`).
