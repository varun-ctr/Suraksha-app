# 9. Test Report

## Summary

```
49 tests, 49 passing, 0 failing  (pnpm run test)
```

22 of the 49 are new this pass (11 crypto, 12 AppError, 7 error-mapper, 3 mapper — 33 total new, minus overlap counted once; see breakdown below for exact per-file counts). The remaining tests are the pre-existing `shared/utils`, `features/sos/utils`, `features/community/utils` suites, unaffected by this pass and re-verified passing after every change.

## What's covered (and why these were chosen)

| File | Tests | What it verifies |
|---|---|---|
| `core/storage/__tests__/aesCbcHmac.test.ts` | 11 | The actual cryptographic correctness of the session-encryption primitive, run for real (not mocked) in plain Node: encrypt→decrypt round-trips (including unicode and empty strings), the version-prefix tag distinguishes encrypted blobs from legacy plaintext, decryption fails closed (returns `null`, never throws) on a wrong MAC key, a wrong encryption key, a tampered ciphertext byte, and malformed/truncated blobs; confirms each encryption uses its supplied IV (so identical plaintexts never produce identical ciphertexts); confirms the custom `bytesToBase64` helper matches Node's own base64 encoding across edge-case lengths (0–32 bytes, covering base64 padding boundaries). |
| `domain/errors/__tests__/AppError.test.ts` | 12 | Every one of the 8 `AppError` subclasses (including the 2 new ones, `SessionExpiredError`/`OTPExpiredError`) is a real `instanceof Error` and `instanceof AppError` with the right `code`/`name`/`message`; `cause` is preserved; `AuthError`'s and `OTPExpiredError`'s optional `reason` discriminator round-trips; distinct subclasses are never mistaken for each other via `instanceof`. |
| `repositories/api/__tests__/emailOtpErrorMapper.test.ts` | 7 | Every backend error code (`invalid_email`, `invalid_request`, `invalid_or_expired`, `invalid_code`, `too_many_attempts`, `rate_limited`, unknown/missing) maps to the correct `AppError` subclass and `reason`; the server-provided message is always preserved verbatim (never silently replaced). |
| `repositories/firebase/mappers/__tests__/authUserMapper.test.ts` | 3 | `toAuthUser` maps exactly the 5 fields `AuthUser` declares, handles an anonymous/unverified/phone-only user correctly, and — importantly — does **not** leak extra `FirebaseUser` fields (`refreshToken`, `providerData`) onto the domain entity, which is the entire point of having a domain entity instead of passing the SDK object around. |

## What's NOT covered, and why (be explicit about this rather than claim more than is true)

- **Anything requiring a live Firebase Auth instance** (`signInWithEmail`, `signInWithGoogle`, `signOut`, etc. in `repositories/firebase/firebaseAuth.ts` / `authRepository.ts`) — these need either a real Firebase project + network access, or a mocking layer for the `firebase/auth` SDK that this pass didn't build. The *logic* wrapping them (`authRepository.ts`'s `Result` mapping) is straightforward pass-through and was verified by `tsc --noEmit` (full type-correctness) and manual code review, but not by an automated test with a fake SDK.
- **React component/hook behavior** (`AuthContext`'s render behavior, `useLoginScreen`'s state machine, `app/login.tsx`'s UI) — this repo's test runner is plain `node --test` with no React Testing Library / React Native Testing Library configured. Adding that harness is a reasonable follow-up but is itself a meaningful infrastructure addition beyond this pass's scope (the brief asked for hardening, not a new test framework).
- **End-to-end flows on a device/simulator** — this sandboxed environment has no iOS simulator, Android emulator, or Expo Go connection available. `npx expo export --platform web` was run as a bundling smoke test after every round of changes (confirms Metro can resolve and bundle every new module, including the new native dependencies) but does not exercise the actual auth UI.
- **The backend's OTP rate limiting** — read and audited (`api-server/src/routes/email-otp.ts`, `lib/rateLimit.ts`, `lib/otp.ts`), not re-tested, since it's outside this pass's file scope and already has its own test file (`api-server/src/__tests__/otp.test.ts`, pre-existing).

## Regression verification after every round of changes

- `pnpm run typecheck` (`tsc --noEmit`) — clean throughout.
- `pnpm run lint` (`eslint .`, architectural boundary rules) — zero errors throughout; only pre-existing "unused disable directive" warnings unrelated to this pass.
- `npx madge --circular` — zero circular dependencies, checked after the listener-consolidation refactor specifically (the highest-risk change for introducing an accidental cycle between `AuthContext`/`AppContext`/`LanguageContext`).
- `npx expo export --platform web` — succeeds, including bundling the new `expo-crypto`/`crypto-js` dependencies.
