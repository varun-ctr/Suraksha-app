# 9. Manual QA Checklist (Release Gate)

Every item is pass/fail. This is the single checklist to run before any TestFlight/production submission — it consolidates the manual-verification items called out across every other document in this certification rather than duplicating them in prose.

## Build & config

- [ ] `eas build` production profile completes for both platforms.
- [ ] Generated `ios/Podfile` deployment target and `android/build.gradle` `minSdkVersion`/`targetSdkVersion` recorded and cross-checked against current store policy (see `05-OS-Matrix.md` — **currently unverified, blocking item**).
- [ ] `app.config.ts`'s `backendUrl` and `easProjectId` are real production values, not the `https://example.com`/`TODO_EAS_PROJECT_ID` fallbacks (see `docs/ux-audit/11-App-Review.md`).
- [ ] `eas.json`'s `submit.production` iOS `ascAppId`/`appleTeamId` are filled in, not placeholders.

## Authentication

- [ ] Email sign-up + verification email.
- [ ] Email sign-in (correct + incorrect credentials).
- [ ] Apple Sign In on a real iOS device.
- [ ] Google Sign In on a real device.
- [ ] OTP request/verify/resend.
- [ ] Password reset email + link.
- [ ] Sign-out.
- [ ] Account deletion, including a backend-side check that Supabase rows are actually gone.
- [ ] Reauth-required account-deletion path shows its message (known manual-workaround gap, not a crash — confirm it doesn't regress further).

## SOS

- [ ] Countdown activates and is cancellable.
- [ ] Active SOS dispatches to all configured contacts (SMS/call/WhatsApp).
- [ ] "I'm Safe" cancels immediately.
- [ ] SOS record-save-status indicator transitions correctly.
- [ ] SOS behaves safely under: airplane mode, weak network, GPS off, low battery, device locked, background kill, app kill (see `02-Emergency-Testing.md` for full scenario list).
- [ ] Shake-to-SOS (if enabled) triggers only on a real triple-jolt, not on normal handling.
- [ ] Fake call rings convincingly and hangs up cleanly.

## Journey

- [ ] Start/check-in/cancel.
- [ ] Overdue grace period and auto-SOS escalation.
- [ ] Survives 4-hour background session (see `06-Background-Testing.md`).
- [ ] Survives app kill and reboot with correct resume/reconciliation.

## Maps & location

- [ ] Nearby-places categories load and render markers.
- [ ] Location-denied "Open Settings" affordance actually opens OS Settings.
- [ ] Dark mode map re-skin.
- [ ] Camera follow / recenter behavior feels responsive, not jarring.

## Notifications & permissions

- [ ] Permission request flows for location, background location, contacts, camera, notifications, biometrics.
- [ ] Denial of each degrades the relevant feature gracefully, without breaking SOS/journey core functionality.
- [ ] Journey-overdue local notification fires while backgrounded.

## Subscriptions

- [ ] Real sandbox purchase completes; entitlement reflects immediately.
- [ ] Restore Purchases recovers a prior purchase on a fresh install.
- [ ] Cancellation shows no false error.
- [ ] Premium "coming soon" copy accuracy confirmed against actual launch status (see `docs/ux-audit/11-App-Review.md`).

## Community

- [ ] Incident submission with and without photo.
- [ ] Rate-limiting shows the distinct message.
- [ ] "My Reports" reflects the user's own submissions correctly.

## Settings

- [ ] Every toggle persists across restart.
- [ ] Language switch reloads all strings; RTL switch shows the translated restart dialog and applies correctly after restart.

## Accessibility

- [ ] VoiceOver/TalkBack names and operates the SOS trigger, countdown-cancel, and "I'm Safe" buttons.
- [ ] Reduce Motion stops both pulse animations.
- [ ] Dynamic Type at a large setting doesn't clip the SOS countdown number.
- [ ] Color contrast spot-check on the WhatsApp mini-button and onboarding trust-row text (both fixed in the UX-certification phase).

## Device/OS matrix

- [ ] Smoke-test on at least one device per row in `04-Device-Matrix.md` (iPhone SE through 16, one representative small/medium/large Android device).
- [ ] iOS 17 and iOS 18 (or the two most recent major versions available at release time).
- [ ] Latest Android LTS and latest Android release.

## Localization

- [ ] Spot-check 3+ non-English, non-Hindi languages.
- [ ] No raw translation key visible anywhere (fallback-to-English is expected for known gaps; a raw `key`-as-text would indicate a genuine new bug).

## Stress (real-device execution of `07-Stress-Testing.md`'s designed cases)

- [ ] Repeated login/logout (50 cycles).
- [ ] 100 SOS attempts against a test/staging backend only.
- [ ] Repeated journeys (50 cycles).
- [ ] Rapid navigation.
- [ ] Repeated permission changes.
- [ ] Large-contact-list edge cases (6th-contact rejection, duplicate detection).
- [ ] Sustained poor connectivity (1+ hour).
- [ ] Long session (8+ hours).

## Sign-off

- [ ] All P0/P1 items in `12-QA-Certification.md` reviewed and either resolved or explicitly accepted as known, documented limitations.
- [ ] `npx tsc --noEmit`, `pnpm run lint`, `pnpm run test`, `npx madge --circular` all clean at the exact commit being submitted.
