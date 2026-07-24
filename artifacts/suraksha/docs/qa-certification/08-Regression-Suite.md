# 8. Regression Suite

## Automated regression coverage (runs today, `pnpm run test`: 100/100 passing)

| Area | Automated coverage | Files |
|---|---|---|
| Authentication | OTP error-mapping (7 cases), Firebase auth-user mapper (3), reauth-check logic (4) | `repositories/api/__tests__/emailOtpErrorMapper.test.ts`, `repositories/firebase/mappers/__tests__/authUserMapper.test.ts`, `repositories/firebase/__tests__/reauthCheck.test.ts` |
| Journey | Recovery policy (6), validation (7), retry/backoff (3) | `domain/policies/__tests__/journeyRecoveryPolicy.test.ts`, `journeyValidation.test.ts`, `retryBackoff.test.ts` |
| SOS | Recovery-staleness policy (3), emergency-message formatting (6), live-session policy (2) | `features/sos/services/__tests__/sosRecoveryPolicy.test.ts`, `features/sos/utils/__tests__/emergencyMessage.test.ts`, `domain/policies/__tests__/liveSessionPolicy.test.ts` |
| Maps | None (no pure-logic module exists for map behavior — the map component itself has native/rendering dependencies not unit-testable under this project's plain Node test runner) | — |
| Notifications | None directly (permission-request logic has no dedicated test file) | — |
| Subscriptions | None (`purchasesService.ts` has zero test coverage — confirmed not currently testable under the plain Node runner without a structural refactor to extract pure logic; see `10-Automation.md`) | — |
| Community | Community-knowledge utility (4 cases) | `features/community/utils/__tests__/emergencyKnowledge.test.ts` |
| Settings | App-lock policy (5) | `domain/policies/__tests__/appLockPolicy.test.ts` |
| Localization | None (no test exercises the i18n fallback chain or per-locale key coverage) | — |
| Accessibility | None (accessibility props/labels are not unit-testable without a rendering/snapshot layer, which this project doesn't have) | — |

Plus infrastructure-level coverage not tied to one feature area: crypto (`aesCbcHmac`, 11 cases), Sentry PII-scrubbing (`sentryScrubber`, 8 cases), request de-duplication (`inFlightDedup`, 5 cases), native-module-guard safety (`nativeCapabilities`, 3 cases), `AppError` hierarchy (5 cases), input validation (6 cases), local-cache-ownership helper (5 cases).

## Manual regression checklist (by area — pass/fail, run before every release)

**Authentication**: [ ] Email sign-up creates account + sends verification. [ ] Email sign-in succeeds with correct credentials, fails safely with wrong ones (generic message, no account-existence leak). [ ] Apple Sign In completes on a real iOS device. [ ] OTP request/verify/resend-cooldown all work. [ ] Password reset email arrives and its link works. [ ] Sign-out returns to a usable signed-out state with no stale data visible. [ ] Account deletion completes and, separately, confirm Supabase rows are actually gone (backend-side check).

**Journey**: [ ] Start/check-in/cancel all work. [ ] Overdue grace period correctly counts down and auto-escalates to SOS if ignored. [ ] Journey survives app backgrounding for its full duration. [ ] Journey survives an app kill and correctly resumes/reconciles on relaunch.

**SOS**: [ ] Countdown fires and is cancellable. [ ] Active SOS correctly dispatches to all configured contacts. [ ] "I'm Safe" cancels immediately with no confirmation friction. [ ] SOS record-save-status indicator (added in the UX-certification phase) correctly transitions from "saving" to "saved." [ ] SOS survives airplane mode, GPS-off, and app backgrounding (per `02-Emergency-Testing.md`).

**Maps**: [ ] Category chips load nearby places. [ ] Map markers render and are tappable. [ ] Location-denied state shows the "Open Settings" affordance (added in the UX-certification phase) and it actually opens OS Settings. [ ] Dark mode correctly re-skins the map (`customMapStyle`).

**Notifications**: [ ] Permission request flow completes. [ ] Denial doesn't break SOS/journey core functionality. [ ] Journey-overdue local notification fires while backgrounded.

**Subscriptions**: [ ] Premium paywall displays real offerings. [ ] A real sandbox purchase completes and entitlement reflects immediately. [ ] Restore Purchases correctly recovers a prior purchase on a fresh install. [ ] Purchase cancellation doesn't show a false error.

**Community**: [ ] Incident submission with photo succeeds. [ ] Rate-limiting shows the correct distinct message (not the generic error). [ ] "My Reports" tab shows the user's own submissions.

**Settings**: [ ] Every toggle (shake-to-SOS, App Lock, background location, notifications) persists correctly across app restarts. [ ] Language switch correctly reloads all translated strings. [ ] RTL language switch shows the (now-translated, per the UX-certification phase) restart dialog and actually applies RTL after restart.

**Localization**: [ ] Spot-check at least 3 non-English, non-Hindi languages for the known gap areas (login screen strings, per `docs/ux-audit/10-Localization.md`, remain English — confirm this is expected, not a new regression). [ ] Confirm no locale shows a raw translation key (the `key` fallback) for any newly-added string from the UX-certification phase.

**Accessibility**: [ ] VoiceOver/TalkBack can name and operate the SOS trigger, countdown-cancel, and "I'm Safe" buttons (added in the UX-certification phase). [ ] Reduce Motion setting stops both pulse animations. [ ] Dynamic Type at a large setting doesn't clip the SOS countdown number or button label.

## Verification

`npx tsc --noEmit`: 0 errors. `pnpm run lint`: 0 errors (9 pre-existing warnings, unchanged). `pnpm run test`: 100/100 passing. `npx madge --circular`: clean. No code changed this phase — this document consolidates existing automated coverage and defines the manual checklist that fills the gap around it.
