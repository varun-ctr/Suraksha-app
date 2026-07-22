# 7. Code Changes

Grouped by theme; every change preserves existing user-visible behavior except where explicitly noted as a security/reliability fix (per the brief's acceptance criteria).

## A. Repository pattern + DI for auth (Section 1, 2)

**New:**
- `domain/repositories/AuthRepository.ts` — interface: `signInWithEmail`, `signUpWithEmail`, `signInWithCustomToken`, `signInWithGoogle`, `signInWithApple`, `linkPendingCredential`, `signOut`, `signInAnonymously`, `sendPasswordReset`, `resendVerificationEmail`, `reloadCurrentUser`, `isAppleSignInAvailable` — all `Result<T, AuthError>`-returning except the sync `isAppleSignInAvailable`. `getCurrentUser`/`onAuthStateChanged` deliberately excluded (see technical debt report).
- `domain/repositories/EmailOtpRepository.ts` — interface: `requestCode`, `verifyCode`, both `Result<T, AppError>`-returning.
- `repositories/firebase/authRepository.ts` — implements `AuthRepository`, wrapping the existing (unchanged) `firebaseAuth.ts` glue with `Result`/`AuthError` mapping.
- `repositories/firebase/mappers/authUserMapper.ts` — `toAuthUser(FirebaseUser): AuthUser`.
- `core/di/registry.ts`, `core/di/hooks.ts` — extended with `authRepository`/`emailOtpRepository` + `useAuthRepository`/`useEmailOtpRepository`.

**Changed:**
- `repositories/api/emailOtpRepository.ts` — rewritten from an ad hoc `{ok, error}`/`{ok, customToken, error}` shape to `Result<T, AppError>`, implementing `EmailOtpRepository`. Error-code → typed-error mapping extracted to `repositories/api/emailOtpErrorMapper.ts` (kept separate specifically so it's unit-testable without pulling in native-dependent modules).
- `features/authentication/context/AuthContext.tsx` — no longer imports `repositories/firebase/firebaseAuth.ts`'s action functions directly; resolves `AuthRepository` via `useAuthRepository()` and unwraps `Result` internally. **Public `AuthContextValue` shape is unchanged** except one additive field (`authUser: AuthUser | null`) — every existing consumer (`useLoginScreen`, `useProfileScreen`, `app/login.tsx`, `app/sessions.tsx`) needed zero changes to its own logic.
- `features/authentication/hooks/useLoginScreen.ts` — OTP request/resend/verify now go through `useEmailOtpRepository()` instead of importing `repositories/api/emailOtpRepository.ts` functions directly.
- `features/authentication/services/authService.ts` — `signOut`/`deleteAccount` now call `authRepository` (module-level import, not the DI hook — this file is a plain function module, not a component) instead of `firebaseAuth.ts` directly.

## B. Consolidating four `onAuthStateChanged` listeners into one (Section 14, Section 3)

- `features/authentication/context/AuthContext.tsx` — the one remaining subscription; now also owns a 6-second safety timeout (`AUTH_STATE_TIMEOUT_MS`) so `loading` can't get stuck forever if Firebase's listener never fires — this timeout previously lived only in `app/_layout.tsx`'s `Gate` and only protected `Gate`, not the other three listeners.
- `features/profile/context/AppContext.tsx` — its sync/clear-on-signout effect now depends on `useAuth().user` instead of its own `onFirebaseAuthStateChanged` subscription. Same trigger conditions, same effect body, one dependency source instead of two.
- `features/settings/context/LanguageContext.tsx` — same change; the language-init effect (mount-only, unrelated to auth) was split out from the profile-sync effect (now auth-dependent) since they'd been incorrectly combined into one effect before.
- `app/_layout.tsx`'s `Gate` — derives `authChecked`/push-registration-trigger from `useAuth()` instead of its own listener + its own duplicate 6-second timeout (moved into `AuthContext`, see above).

## C. Session storage hardening (Section 4, user-approved after a risk/reward discussion)

- `core/storage/aesCbcHmac.ts` (new) — pure AES-256-CBC + HMAC-SHA256 encrypt-then-MAC primitives over caller-supplied key/IV material. Zero randomness, zero storage access — unit-tested directly (11 tests).
- `core/storage/cryptoBox.ts` (new) — key generation/retrieval (via `expo-crypto`'s CSPRNG + the existing `core/storage/secureStore.ts` SecureStore wrapper) and the `encryptForStorage`/`decryptFromStorage` public API.
- `repositories/firebase/encryptedAuthStorage.ts` (new) — a `ReactNativeAsyncStorage`-shaped adapter (Firebase's own interface for `getReactNativePersistence`) that transparently encrypts/decrypts, with legacy-plaintext read-through so existing signed-in users aren't logged out by the upgrade.
- `repositories/firebase/firebaseClient.ts` — one-line change: `getReactNativePersistence(AsyncStorage)` → `getReactNativePersistence(encryptedAuthStorage)`.
- `package.json` — added `expo-crypto` (pinned to `~15.0.9`, the version Expo SDK 54 actually bundles — the initial install resolved `57.0.1`, built for SDK 57, and was corrected), `crypto-js` + `@types/crypto-js`.

## D. Logout hardening (Section 7)

- `core/permissions/notifications.ts` — added `deregisterPushToken()` (extracted from the pre-existing notification-toggle-off code) and exported `NOTIF_TOKEN_STORAGE_KEY` as the single source of truth for the local storage key.
- `features/authentication/services/authService.ts` — `signOut()` now calls `deregisterPushToken()` before signing out of Firebase and re-establishing anonymous auth — previously only reachable via the notifications toggle, never via sign-out.
- `features/profile/hooks/useProfileScreen.ts` — its notification-toggle-off handler now calls the same shared `deregisterPushToken()` instead of duplicating the Supabase-delete + AsyncStorage-remove logic inline.

## E. Typed errors (Section 12)

- `domain/errors/SessionExpiredError.ts`, `domain/errors/OTPExpiredError.ts` (new) — added per the brief's explicit list; wired into the email-OTP error mapping (`invalid_or_expired`/`invalid_code`/`too_many_attempts` → `OTPExpiredError` with a `reason` discriminator).
- All 8 error-subclass files' internal `import { AppError } from "./AppError"` were given explicit `.ts` extensions (mechanical, Metro-safe) so the whole hierarchy is importable from plain-Node unit tests — see the test report.

## F. OTP UX/security polish (Section 5, Section 11 iOS readiness)

- `features/authentication/hooks/useLoginScreen.ts` — added a 30-second resend cooldown (`otpCooldown`) and a re-entrancy guard on `handleVerifyOtp` (prevents a double-tap from firing two verify requests for the same one-time code).
- `app/login.tsx` — OTP `TextInput` gained `textContentType="oneTimeCode"`, `autoComplete="one-time-code"`, `importantForAutofill="yes"` (iOS/Android autofill support); resend button now shows a live countdown and is disabled during it.

## G. Dead code removed

- `features/authentication/services/authService.ts` — removed unused exports `onAuthStateChange`, `AuthChangeEvent`, `isAnonymous`, `signInAnonymously` (verified zero call sites via repo-wide grep before deletion).

## H. Tests added (see test report for full detail)

- `core/storage/__tests__/aesCbcHmac.test.ts` (11 tests)
- `domain/errors/__tests__/AppError.test.ts` (12 tests)
- `repositories/api/__tests__/emailOtpErrorMapper.test.ts` (7 tests)
- `repositories/firebase/mappers/__tests__/authUserMapper.test.ts` (3 tests)
