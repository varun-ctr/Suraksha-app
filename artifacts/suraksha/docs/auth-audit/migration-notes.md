# 8. Migration Notes

## For engineers picking up this branch

### New dependencies

```
expo-crypto@~15.0.9   (must stay pinned to the Expo SDK 54-bundled version — see below)
crypto-js@^4.2.0
@types/crypto-js@^4.2.2  (devDependency)
```

**Important:** when this project's Expo SDK is next upgraded, re-check `expo-crypto`'s version against the new SDK's `bundledNativeModules.json` (found at `node_modules/expo/bundledNativeModules.json`). A plain `pnpm add expo-crypto` or `pnpm up` can silently resolve a version built for a newer/different SDK than the app targets (this happened once already during this pass — the first install pulled `57.0.1` against an SDK-54 app; the correct version was `~15.0.9`). `expo-crypto`'s own `peerDependencies` only says `"expo": "*"`, so pnpm won't catch this for you.

### Session storage — no action required, but know what happens

Existing signed-in users' persisted sessions are in the old plaintext format. On upgrade:
1. First read: `encryptedAuthStorage.getItem()` sees no `encv1:` prefix, returns the value as-is (unchanged behavior — user stays signed in).
2. Firebase's SDK writes back routinely (token refresh, etc.) — that write goes through `encryptedAuthStorage.setItem()`, which always encrypts. From that point on, the session is encrypted at rest.
3. No explicit migration script, feature flag, or one-time job is needed or exists.

If you ever need to force-invalidate all persisted sessions (e.g., suspected key compromise), the SecureStore keys are `suraksha.crypto.enc.v1` and `suraksha.crypto.mac.v1` — clearing them (via a new app version that calls `secureDelete` on both at startup, once) makes every previously-encrypted session undecryptable, which the app already handles gracefully (fails closed → fresh anonymous sign-in, not a crash).

### API-shape changes internal to the app (not user-facing)

- `repositories/api/emailOtpRepository.ts`'s exported functions changed from `requestEmailOtp(email): Promise<EmailOtpResult>` / `verifyEmailOtp(email, code): Promise<EmailOtpVerifyResult>` to a single exported object `emailOtpRepository: EmailOtpRepository` with `requestCode`/`verifyCode` methods returning `Result<T, AppError>`. The only caller (`useLoginScreen.ts`) was updated in the same change; if any other code was calling the old named exports directly (none was found via repo-wide grep), it would need updating to resolve `emailOtpRepository` via `useEmailOtpRepository()` (React) or the module import (non-React) and unwrap the `Result`.
- `AuthContextValue` gained one new field (`authUser: AuthUser | null`) — purely additive, no existing consumer needed changes.

### Testing this locally

```bash
pnpm run typecheck   # tsc --noEmit
pnpm run lint         # eslint . (architectural boundary rules)
pnpm run test         # node --test — pure-logic tests only, no device needed
npx madge --circular --extensions ts,tsx --ts-config tsconfig.json .   # dependency-cycle check
npx expo export --platform web   # bundling smoke test
```

None of the auth changes can be exercised end-to-end without a device/simulator or Expo Go session (this sandbox has neither) — see the test report for exactly what is and isn't covered by the automated suite, and manually verify at minimum: email/password sign-in, email OTP request+verify (against a real backend), sign-out (check the device's push token row is gone from `notification_tokens` in Supabase), and cold-start session restore after force-quitting the app.
