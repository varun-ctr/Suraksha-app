# 6. Technical Debt Report

## Resolved this pass

| Debt item | Where | Resolution |
|---|---|---|
| Auth bypassed the repository/DI/Result pattern | `AuthContext.tsx` called `repositories/firebase/firebaseAuth.ts` functions directly | `AuthRepository` + `EmailOtpRepository` domain interfaces, Firebase/API implementations, DI registration, `AuthContext`/`useLoginScreen` rewired |
| 4 redundant `onAuthStateChanged` listeners | `AuthContext`, `AppContext`, `LanguageContext`, `app/_layout.tsx` | Consolidated to one subscription in `AuthContext`; others derive via `useAuth()` |
| Two divergent `signOut` implementations | `AuthContext.signOut` (dead code, did anon re-auth) vs `authService.signOut` (the one actually wired to both "Sign out" buttons, didn't) | One implementation (`authService.signOut`), `AuthContext.signOut` now delegates to it |
| Dead code: `authService.onAuthStateChange`, `isAnonymous`, `signInAnonymously` exports | `authService.ts` | Removed (confirmed zero call sites via repo-wide grep before deleting) |
| Email-OTP repository didn't return `Result<T, AppError>` | `repositories/api/emailOtpRepository.ts` | Rewritten to the `EmailOtpRepository` domain interface; error-code mapping extracted to a pure, unit-tested `emailOtpErrorMapper.ts` |
| Silent failure on account-deletion backend cleanup | `authService.deleteAccount` | Now logged via `logger.warn` (still non-fatal — Firebase deletion remains authoritative) |
| Session tokens unencrypted at rest | `firebaseClient.ts`'s AsyncStorage persistence | Envelope encryption via `encryptedAuthStorage.ts` / `cryptoBox.ts` |
| No OTP resend cooldown / no duplicate-verify guard | `useLoginScreen.ts` | 30s cooldown + `otpVerifying` re-entrancy guard |
| No iOS OTP autofill | `app/login.tsx` | `textContentType="oneTimeCode"` / `autoComplete="one-time-code"` |
| Push token not deregistered on sign-out | `core/permissions/notifications.ts` | `deregisterPushToken()` added, called from `authService.signOut` |

## Still open (deliberately not fixed this pass — see rationale)

| Debt item | Why it's still open |
|---|---|
| Account-deletion backend cleanup has no retry mechanism | Backend infrastructure change (Cloud Function trigger or reconciliation job), outside a mobile-client-scoped pass. See risk assessment #2. |
| No native-Keychain-backed session persistence (envelope encryption is the mitigation, not a full replacement) | Would require migrating from the `firebase` JS SDK to `@react-native-firebase/auth` — a native rebuild, not a JS-only change. See risk assessment #1. |
| `AuthUser` domain entity is used additively, not everywhere | `AuthContext.user` (raw Firebase `User`) is still what most of the app reads (`SafetyContext`, `AppContext`, `useProfileScreen`, etc., via `firebaseAuth.currentUser` or `useAuth().user`) — many of those call sites need `.getIdToken()` or other live-SDK-object methods that a plain domain entity can't offer without its own indirection layer. Forcing a full migration in this pass would have meant touching a much larger surface than the auth module itself, for a benefit (type purity) that doesn't change behavior. `authUser: AuthUser | null` is available now for new code that doesn't need the live object; existing call sites weren't required to move. |
| No per-device signal (App Attest / Play Integrity) backing the backend's rate limits | The current per-email/per-IP limits are adequate for launch; device attestation is a reasonable post-launch hardening step given real usage patterns, not a launch blocker. |
| Backend URL scheme (`https://`) isn't verified at runtime | Relies on the EAS build's env var configuration being correct; enforcing this in-app would be defense-in-depth, not a fix for a currently-exploitable gap. |

## Debt this pass explicitly avoided introducing

- **No custom crypto rolled from scratch.** `aesCbcHmac.ts` composes well-established primitives (AES-CBC, HMAC-SHA256) from `crypto-js` rather than hand-rolling a cipher; construction (encrypt-then-MAC, verify-before-decrypt) follows established practice, not an ad hoc design.
- **No forced abstraction where a live-streaming subscription doesn't fit a Result-returning repository shape.** `AuthRepository` deliberately excludes `getCurrentUser`/`onAuthStateChanged` — those stay a direct, documented pass-through from `firebaseAuth.ts`, rather than wrapping a fundamentally-always-succeeding stream in a fallible-operation abstraction for its own sake.
- **No blanket rewrite of `user: User` to `AuthUser` across the app.** Scoped to additive (see above) rather than a big-bang migration with a large, hard-to-fully-verify blast radius.
