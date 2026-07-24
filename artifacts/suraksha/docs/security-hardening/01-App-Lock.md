# 1. App Lock

## What existed before this pass

`core/permissions/biometrics.ts` was a complete, working wrapper around `expo-local-authentication` (`isBiometricUnlockAvailable`, `getBiometricType`, `authenticateWithBiometrics`) — but it was never called from any screen. `NSFaceIDUsageDescription` was already declared in `app.config.ts`. It was architecture without a feature behind it.

## What this pass built

An opt-in, off-by-default App Lock feature wired directly onto that existing module — no new native dependency, no changes to the login/authentication flow itself.

### New files
- `domain/policies/appLockPolicy.ts` — pure wall-clock logic (`shouldRequireUnlock(backgroundedAtMs, nowMs, graceMs)`), unit-tested (`domain/policies/__tests__/appLockPolicy.test.ts`, 5 tests). Mirrors `journeyRecoveryPolicy.ts`'s established pattern: derive the answer from timestamps, not an incrementally-updated flag, so it's correct regardless of how long the JS engine was suspended.
- `features/security/hooks/useAppLock.ts` — wires the policy + `biometrics.ts` into React: tracks `AppState` transitions, decides the cold-start lock state once settings finish loading, and exposes `{ locked, biometricsAvailable, biometricType, unlock }`.
- `features/security/components/AppLockScreen.tsx` — the full-screen overlay shown in place of the navigation stack while locked. Auto-prompts biometric auth on mount, with a visible, accessible "Unlock" button as the fallback for anyone who dismisses the OS prompt.

### Wiring (minimal, additive changes to existing files)
- `features/profile/context/AppContext.tsx`: added `appLockEnabled: boolean` to `Settings`, defaulting to `false` — an existing user's persisted settings blob simply won't have this key, and the existing `{...prev.settings, ...plain.settings}` merge already handles a missing key gracefully (falls back to the `false` default). **Zero behavior change for any existing user unless they explicitly opt in.**
- `app/_layout.tsx`'s `Gate` component: calls `useAppLock(settings.appLockEnabled, appReady)` and renders `<AppLockScreen />` in place of `<RootLayoutNav />` when locked — the exact same conditional-render pattern already used for `ConfigErrorScreen` and the splash-hold `null` at this same spot. **No new `Stack.Screen`, no navigation change.**
- `features/profile/hooks/useProfileScreen.ts` + `app/(tabs)/profile.tsx`: a new `handleAppLockToggle` mirrors the existing `handleNotificationsToggle` pattern exactly — checks `isBiometricUnlockAvailable()` before allowing the toggle on, shows a toast if unavailable, otherwise persists the setting. A new `Row`/`Switch` was added to the existing Settings card, in the same visual style as the pre-existing `shakeToSos` toggle immediately above it.

## Requirement-by-requirement

| Requirement | How it's met |
|---|---|
| Face ID | `authenticateWithBiometrics` → `LocalAuthentication.authenticateAsync` — handled by `expo-local-authentication` on iOS |
| Touch ID | Same call — the OS decides which biometric method to prompt for based on device hardware |
| Android Biometrics | Same call — `expo-local-authentication` is cross-platform; no Android-specific code was needed |
| Session timeout / App background timeout | One unified mechanism: `DEFAULT_APP_LOCK_GRACE_MS` (30s) in `appLockPolicy.ts` — backgrounding past this window requires a fresh unlock. Quick app-switches (answering a call, copying an SMS OTP code) under 30s don't force a re-prompt |
| Unlock on resume | `useAppLock`'s `AppState` listener sets `locked: true` on returning to `active` past the grace window |
| Graceful fallback | `authenticateWithBiometrics` already sets `disableDeviceFallback: false`, so the OS itself offers a device-passcode fallback after a failed/cancelled biometric attempt. `unlock()` additionally treats `error === "unavailable"` as a successful unlock (see below) |
| Accessibility preserved | `AppLockScreen` sets `accessibilityViewIsModal`, `accessibilityLabel`s on the screen and the Unlock button, and `accessibilityRole="button"` — screen readers get a coherent, navigable lock screen, not silently-hidden content behind it |
| No regression to login flow | Default `false`; every hook/effect is a no-op when `enabled` is `false` (each `useEffect` in `useAppLock` returns early); `locked` is computed as `enabled && locked`, so even a stale internal `true` can never surface if the feature is off |

## The one deliberate safety-first design decision: fail-open on unavailable biometrics

If biometrics become unavailable after the setting was enabled (Face ID de-enrolled, hardware fault, a future OS change), `unlock()` treats `{success: false, error: "unavailable"}` identically to a success — it unlocks the app rather than trapping the user behind a broken gate. This is a life-safety application: a user unable to reach a trusted contact or trigger SOS because a sensor failed would be a serious regression, not an acceptable security trade-off. The Settings toggle already checks availability before letting a user turn the feature on in the first place, so this fail-open path should be rare in practice — it exists purely as a last-resort safety net.

## Scope boundaries (documented, not implemented)

- **No "emergency bypass" affordance was added to the lock screen itself** (e.g. a visible SOS button reachable while locked). This was considered given the app's safety-critical nature, but was deliberately left out of this pass: it's not one of the eight explicit requirements, and adding new safety-critical UI without the ability to validate it on a real device carries more risk than value here. If product wants this, it's a small, well-scoped follow-up (the `SafetyContext` provider already wraps `Gate` in the component tree, so `useSafety()` is reachable from `AppLockScreen` without restructuring providers).
- **Translations**: new locale strings (`profile.appLock`, `appLock.*`) were added to `features/settings/locales/strings/en.ts` only. `LanguageContext.tsx`'s `t()` already falls back to English for any key missing from the active locale (`locale[key] ?? enLocale[key] ?? key`), so no other language's UI breaks or shows a raw key — but the strings show in English for all 29 non-English locales until translated. Tracked as a follow-up localization task, not a defect.
