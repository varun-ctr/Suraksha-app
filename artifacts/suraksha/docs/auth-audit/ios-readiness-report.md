# 10. iOS Readiness Report

## Keychain usage

- Session encryption keys (this pass's addition) live in the iOS Keychain via `expo-secure-store` — small values (32-byte keys, base64-encoded), well within Keychain norms.
- Trusted-contacts/profile data already used `expo-secure-store` (pre-existing, `core/storage/secureStore.ts`) — unaffected by this pass.
- `app.config.ts` already declares `usesAppleSignIn: true` and a `bundleIdentifier` — required for both Keychain entitlements and Sign in with Apple to work in a production build.

## Background authentication / app lifecycle

- Firebase's `onAuthStateChanged` listener (now singular, see architecture diagram) is independent of RN's `AppState` — it doesn't need to re-subscribe on foreground/background transitions, and doesn't. Verified no lifecycle-specific auth code exists that could double-fire or miss events.
- The one thing that *is* lifecycle-sensitive — SOS/live-tracking (`SafetyContext`) — was explicitly checked and found to be **correctly independent of auth state by design**: an active emergency-location share must not stop because of an unrelated auth hiccup (a forced session refresh, a backend blip). This was verified as correct, not changed.

## Face ID compatibility (future-ready)

- Not implemented as an app-level gate. The repository/DI pattern this pass establishes (`AuthRepository`) means adding a biometric step-up check later is a contained addition (a new method + a call site in `AuthContext` or a dedicated hook), not a re-architecture. Apple's own Face ID prompt already appears during the native Sign in with Apple flow (`expo-apple-authentication`), which is unaffected.

## Apple Sign In readiness

- Implemented (`signInWithApple` in `firebaseAuth.ts`, requesting `FULL_NAME` and `EMAIL` scopes, the two Apple grants by default). Handles the anonymous-upgrade path (linking), the "cancelled" path, and the "email already registered under a different provider" path (`needsLink`) — all three are required by Apple's App Store Review Guidelines §4.8 for apps offering third-party/social sign-in options, which mandates that Sign in with Apple be offered and function correctly alongside them. Verified present and correctly wired through the new `AuthRepository` layer without behavior change.
- `isAppleSignInAvailable()` correctly gates the button to iOS only (`Platform.OS !== "ios"` short-circuits to `false`), so it doesn't appear on Android/web where it wouldn't work.

## Universal Links

- Not used for auth in this app — password reset uses Firebase's own hosted reset page (no deep link back into the app), and email OTP is a typed code, not a magic link. This means there's no Universal Links / Associated Domains configuration to audit for auth specifically. If a future magic-link flow is added, `app.config.ts` will need an `associatedDomains` entry and the corresponding `apple-app-site-association` file — noted here so it isn't missed later, not because it's missing now.

## Authentication interruptions / state restoration

- Covered in depth in the session lifecycle diagram. Summary: the 6-second safety timeout (now centralized in `AuthContext`) guarantees the splash screen can never hang indefinitely waiting on Firebase's listener, which is the one iOS-cold-start scenario (slow network on first launch) that could otherwise strand a user on a blank screen.

## Deep links

- The app's URL scheme (`sakhisuraksha`, in `app.config.ts`) is registered but not used for any auth flow — no auth-related deep link handling exists to audit for the insecure-deep-link class of vulnerability (arbitrary sign-in via a crafted URL, etc.). Verified clean by absence.

## App Store submission considerations specific to auth

- **Guideline 4.8 (Sign in with Apple)**: satisfied — see above.
- **Guideline 5.1.1 (Data collection and storage)**: the Delete Account flow exists and is reachable from the Profile screen; per Apple's requirement that account deletion be available in-app (not just "contact support"), this is met. The one gap (best-effort backend cleanup, see risk assessment #2) affects Supabase-side data hygiene, not the user-facing deletion flow itself — from the user's perspective, deleting their account works.
- **Guideline 2.1 (App Completeness)**: all auth flows (email/password, email OTP, Google, Apple, password reset, account deletion, sign-out) were traced end-to-end in code and are complete — no dead-end states, no unhandled error paths found (every Firebase/backend error surfaces a user-facing message, verified across `firebaseErrMsg`, the OTP error mapper, and every `Result`-unwrapping call site touched this pass).
