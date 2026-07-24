# 6. Permission Experience

## Method

Traced every permission request call site (location, background location, contacts, notifications, camera/microphone, biometrics) to its educational-pre-prompt behavior, denial handling, and recovery path.

## What was already correct

- **Foreground location**: onboarding's `LocationStep` (`app/onboarding.tsx`) explains the purpose and shows a manual "Allow Location" button *before* the OS dialog fires — a proper educational pre-prompt. Denial degrades gracefully (home/map screens show a "location off" state, not a broken feature).
- **Background location** (Apple's most scrutinized permission category): requested only when actually needed — inside `triggerSOS` → `startBackgroundLocationTracking`, never at app launch. The usage string in `app.config.ts` is specific and scoped ("...only while an SOS is active..."). Denial degrades safely to foreground-only tracking (`core/permissions/backgroundLocation.ts:151-163` returns `false` rather than throwing).
- **Contacts**: uses `Contacts.presentContactPickerAsync()` — Apple/Android's limited native picker — avoiding a blanket contacts-permission grant entirely. Already best-practice.
- **Notifications/Biometrics**: both request permission without a hard failure path; denial degrades to a disabled feature state, never a crash or broken flow.

## Fixed this pass

1. **Onboarding's background-location copy was factually inaccurate.** `app/onboarding.tsx` read: "Used only for SOS alerts — never tracked in background" — which directly contradicts the app's actual, correct behavior (background tracking *does* activate during an active SOS or journey, by design, per `app.config.ts`'s own usage-description string). This is exactly the kind of privacy-string inconsistency Apple review has been known to flag, and — independent of App Store risk — it's simply untrue and undermines user trust in a safety app. Changed to: "Used only to share with contacts and respond to an SOS — background access turns on only while an SOS or journey is active." Routed through a new `onb.trustLocationUse` translation key. **Category**: Fix a confirmed bug (factually incorrect user-facing claim) / App Store compliance. **Risk**: none — content-only change, no logic touched. **Regression risk**: none. **Rollback**: revert the string.
2. **No Settings deep-link anywhere in the app** — confirmed via a repo-wide search: zero calls to `Linking.openSettings()` existed before this pass (only generic `Linking.openURL` for mailto/web links). A user who permanently denies location had no in-app way to fix it short of knowing to navigate to OS Settings manually. Added `openAppSettings()` (`shared/utils/native.ts`, wraps `expo-linking`'s `Linking.openSettings()`, no-ops on web) and wired it into:
   - The map screen's existing "location off" notice (`app/(tabs)/map.tsx`, both the full-screen and bottom-panel variants) — now offers "Open Settings" alongside the existing "Enable Location" retry button.
   - The home screen's location-status pill (`app/(tabs)/index.tsx`) — now tappable (with an accessible label) when `status === "denied"`, opening Settings directly.
   **Category**: Reduce user error / emergency usability (a denied-location user in a safety app should have the fastest possible path back to a working state). **Risk**: low — `openAppSettings()` is a thin, try/caught wrapper around a documented Expo API; no-ops safely on web and on any OS/emulator that doesn't support the deep link. **Regression risk**: none (purely additive UI affordances, no existing behavior changed). **Rollback**: remove the new buttons/pill-onPress and the helper function.

## Reviewed, not changed

- **No dedicated educational screen for the background-location "Always" upgrade specifically** — it's requested silently mid-SOS-countdown rather than with its own explanatory screen. Not changed this pass: the existing onboarding location step already explains location use broadly (and its copy is now accurate, per fix #1 above), and inserting a *second*, separate educational interstitial specifically for the background upgrade would be a new UI flow — feature-shaped work, out of scope for Release Freeze. Flagged as a P2 recommendation for a future minor release.
- **Camera/photo library**: no pre-permission explanation screen exists (the picker is invoked directly). Not changed — adding one is a new UI element (feature-shaped), not a targeted fix; the picker's *failure* path was fixed instead (see `05-Errors.md`), which was the concrete, confirmed bug.
- **RTL-language restart dialog**: unrelated to permissions strictly, but discovered adjacent to this section's research — see `10-Localization.md`.

## Verification

`npx tsc --noEmit`: 0 errors. `pnpm run lint`: 0 errors. `pnpm run test`: 100/100 passing. `npx expo export --platform web`: builds clean.
