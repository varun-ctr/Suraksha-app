# 5. Secure Storage

## Storage mechanism by data category — full inventory

| Data | Mechanism | Encrypted? | File:line |
|---|---|---|---|
| Firebase auth session (refresh/ID token) | `AsyncStorage`, wrapped by a custom Firebase persistence adapter | **Yes** — app-level AES-256-CBC+HMAC-SHA256, keys in SecureStore | `repositories/firebase/encryptedAuthStorage.ts:47-54`, `core/storage/cryptoBox.ts`, `core/storage/aesCbcHmac.ts` |
| Trusted contacts / profile | `expo-secure-store` directly (native); plain `AsyncStorage` fallback on web only | OS-level only (native); none (web, explicitly documented preview-only) | `features/profile/context/AppContext.tsx:27,92-96`, `core/storage/secureStore.ts:9-13,16-22,40` |
| **SOS pending activation (incl. live GPS coordinates + address)** | Plain `AsyncStorage` | **None** | `features/sos/services/sosOfflineQueue.ts:14,17,19-31,35` |
| **Journey state (journey ID, timing, outcome)** | Plain `AsyncStorage` | **None** | `features/journey/services/journeyPersistence.ts:25,29,31-51,55` |
| Sakhi chat history/cache | Plain `AsyncStorage` | None (explicitly documented as intentional — non-sensitive, can exceed SecureStore's size limit) | `features/community/services/sakhiHistoryStore.ts:6-9,11,19-20` |
| Bookmarks, language, theme, push token, active-share-ID | Plain `AsyncStorage` | None (appropriate — non-sensitive settings/flags) | Various — see `04-Cryptography.md`'s source agent report for the full list |
| Settings/onboarding flags | Plain `AsyncStorage` | None (appropriate — not PII) | `AppContext.tsx:28,97-103` |

## The one real gap: SOS offline queue and journey state are unencrypted

This is the most important finding in this document. `features/sos/services/sosOfflineQueue.ts` persists a `PendingSosActivation` record — **plaintext latitude, longitude, and street address of a user in the middle of a real emergency** — to bare `AsyncStorage`, with no encryption of any kind. `features/journey/services/journeyPersistence.ts` similarly persists journey identity/timing/outcome unencrypted (no raw coordinates here, but still unencrypted state).

**Why this matters specifically for this app**: `AsyncStorage` on both iOS and Android is sandboxed to the app (not world-readable to other apps without root/jailbreak), and modern OS full-disk encryption protects it at rest while the device is locked — so this is *not* equivalent to writing a plaintext file to shared public storage. The realistic exposure is: (a) a device backup extraction (iTunes/Finder unencrypted local backup, or an Android ADB backup) that captures app-sandbox data verbatim, or (b) a rooted/jailbroken device, or (c) — most relevant to this app's specific threat model — **an abuser with physical access to the victim's unlocked phone**, who could pull this data via a connected computer's backup tooling without needing any sophisticated exploit.

**Why it wasn't fixed in this pass**: the primitives needed already exist and are proven (`core/storage/cryptoBox.ts` + `core/storage/aesCbcHmac.ts`, already protecting the Firebase session) — reusing them for the SOS queue is a well-scoped, low-risk-*in theory* change. However, it touches the app's single most safety-critical code path (the offline-queue-backed retry logic that guarantees an SOS event is never silently lost — see the SOS-reliability audit from a prior phase), and this pass's environment has no device to actually exercise an encrypt/decrypt round-trip against a real native `expo-secure-store`/Keychain backend before shipping a change to that exact path. Given the explicit acceptance criterion "no weakening of existing security" and the safety-criticality of this specific queue, this is documented as a strong P1 recommendation rather than blind-implemented — see `12-Production-Certification.md`.

**Recommended fix** (for a future pass, with device testing): wrap `sosOfflineQueue.ts`'s `AsyncStorage.setItem`/`getItem` calls with the same `encryptForStorage`/`decryptFromStorage` helpers `encryptedAuthStorage.ts` already uses — no new crypto code needed, purely reusing the existing, reviewed primitive. Apply the same to `journeyPersistence.ts`.

## Keychain / Android Keystore usage

- `expo-secure-store` is the only Keychain/Keystore-backed library in use (no standalone `react-native-keychain`). Used for: (a) the two AES/HMAC keys protecting the Firebase session, (b) trusted contacts/profile directly.
- No per-item size violations found: the module's own documentation (`cryptoBox.ts:1-13`) explicitly notes *why* the bulk Firebase-session ciphertext is kept in AsyncStorage rather than SecureStore — it can exceed SecureStore's ~2048-byte per-item limit — while the small (32-byte) keys themselves do go into SecureStore. This is a correct, deliberate design, not a workaround-of-convenience.

## Biometric-gated storage

**None exists.** `core/permissions/biometrics.ts` is fully implemented (`isBiometricUnlockAvailable`, `getBiometricType`, `authenticateWithBiometrics`) but gates nothing — no key, no stored value, no screen is behind it. It delegates the actual pass/fail check entirely to the OS (`LocalAuthentication.authenticateAsync`) and returns a boolean; nothing in the app currently consumes that boolean to unlock or reveal anything. See `01-OWASP-MASVS.md`'s MASVS-AUTH section for why this is flagged as a priority gap given the app's threat model.

## Tamper detection

The only tamper-detection mechanism in the entire codebase is the HMAC-SHA256 tag on the encrypted Firebase-session blob — it correctly rejects a modified ciphertext (fails closed to "no session"), but this protects only that one stored value. The SOS queue and journey state have no integrity check at all: a corrupted or tampered `AsyncStorage` value for either would (at best) fail JSON parsing and be discarded, or (at worst, if structurally valid but semantically wrong) be trusted as-is — there is no cryptographic signal that the value is exactly what the app itself last wrote.

## Secrets lifecycle

- AES/HMAC keys: generated once on first use, persisted indefinitely in Keychain/Keystore, never rotated, never exported outside the OS-provided secure enclave/keystore API surface.
- No secret ever appears in application source code, `app.config.ts`'s `extra` block, or any committed file (cross-checked against `10-Secrets-Management.md`'s full environment-variable inventory).
- Session invalidation: a decrypt/MAC failure treats the session as absent (forces re-login) rather than trusting corrupted data — the correct fail-closed lifecycle behavior for a compromised or corrupted secret.
