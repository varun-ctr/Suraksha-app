# 4. Cryptography

## What's actually encrypted, and how

**The Firebase auth session** is the one place this app does real, deliberate application-level encryption:

| Property | Value | Evidence |
|---|---|---|
| Algorithm | AES-256-CBC, encrypt-then-MAC with HMAC-SHA256 | `core/storage/aesCbcHmac.ts:24,29-31,73-85` |
| Key length | 256-bit (32-byte) keys for both the encryption key and the MAC key | `cryptoBox.ts:38` |
| IV/nonce | 16 bytes, freshly generated **per encryption call** via `expo-crypto`'s CSPRNG (`Crypto.getRandomBytesAsync`) — never reused | `cryptoBox.ts:59` |
| Integrity | HMAC-SHA256 computed over `iv.ciphertext`, checked with a **constant-time compare** before any decryption is attempted — an explicit padding-oracle defense | `aesCbcHmac.ts:60-65,106-107` |
| Key storage | Both 256-bit keys generated once via CSPRNG and stored in `expo-secure-store` (Keychain on iOS / Keystore on Android) | `cryptoBox.ts:20-21,35-41` |
| Library | `crypto-js` (`^4.2.0`) | `package.json` |
| Failure mode | Tampered/undecryptable blob → `null` → treated as "no session" (fail-closed, never fail-open) | `encryptedAuthStorage.ts:36-44` |

This is a **correct construction**. Encrypt-then-MAC (rather than MAC-then-encrypt) is the right order; a fresh IV per message with CBC mode is required and present; the MAC check happening *before* decryption is the standard, correct defense against padding-oracle attacks on CBC. The one thing this library doesn't offer is an AEAD mode (no GCM in this version of `crypto-js`), which is why the code manually implements encrypt-then-MAC instead — a reasonable, explicitly-documented trade-off (`aesCbcHmac.ts:8-13`), not an oversight.

## Why `crypto-js` + manual encrypt-then-MAC rather than a native AEAD

Documented in-code: this version of `crypto-js` has no GCM/AEAD mode available, so the manual construction is the correct alternative rather than falling back to unauthenticated CBC. If this dependency is ever upgraded or replaced, migrating to AES-256-GCM (native AEAD, no separate MAC step needed) would be a reasonable future simplification — not urgent, since the current construction is not broken, just slightly more code than a native AEAD would need.

## Nonces, randomness, and where CSPRNG vs. plain `Math.random()` is used

| Purpose | Generator | CSPRNG? | Appropriate? |
|---|---|---|---|
| AES/HMAC key generation | `Crypto.getRandomBytesAsync(32)` | Yes | Yes — this is genuine secret key material |
| AES IV per encryption | `Crypto.getRandomBytesAsync(16)` | Yes | Yes |
| Apple Sign-In nonce | `Crypto.randomUUID()` (raw), SHA-256-hashed for Apple | Yes | Yes — this is a security-relevant, unguessable value |
| Journey ID / live-session share ID | `Crypto.randomUUID()` | Yes | Appropriate — unguessable identifiers, though not secrets |
| OTP code | `randomInt(100000, 1000000)` (Node `crypto.randomInt`) | Yes | Yes |
| SOS/alert idempotency keys | `` `${Date.now()}-${Math.random()...}` `` | **No** | Acceptable — these are dedup markers, never used for access control or as a secret, so CSPRNG strength isn't required here |

No use of `Math.random()` was found anywhere it would matter for security (i.e., as a token, key, or access-control value). The two non-CSPRNG uses are both pure at-most-once dedup markers.

## Hashing

- **OTP codes**: SHA-256, unsalted (`hashCode`, `api-server/src/lib/otp.ts:14-16`). No salt is used, and none is needed here: the input space is tiny (6 digits, 900,000 possibilities), so a salt's usual purpose (defeating rainbow tables across a large user base of similar-strength secrets) doesn't apply the same way it would to passwords — the actual protection against brute force is the combination of a short TTL, a hard attempt cap (`MAX_ATTEMPTS`), and per-email/per-IP rate limiting, all of which are present. This is a defensible, correct design for this specific use case, not a gap.
- **Apple Sign-In nonce**: SHA-256 over a CSPRNG-backed UUID, correctly used for replay-protection integrity, not as a secret-derivation function.
- **No password hashing exists anywhere** — expected, since there is no password-based auth in this app (Firebase handles Google/Apple/OTP-via-custom-token; there's no "set a password" flow to review).

## HMAC

Used in exactly one place — the encrypt-then-MAC construction protecting the Firebase session (above). Correctly keyed with a separate 256-bit key from the encryption key (not key-reuse between AES and HMAC), and correctly verified before decryption.

## Key management and rotation

- **No key rotation exists**: the AES/HMAC key pair is generated once (`getOrCreateKey`, `cryptoBox.ts:35-41`) and reused indefinitely; storage keys carry a static `v1` suffix with no rotation/versioning/expiry logic.
- **No key derivation from a user secret**: the key is a raw random value, not derived from a PIN/password (no PBKDF2/scrypt/Argon2 anywhere in the codebase) — its security is delegated entirely to the OS keystore's own access control, which is appropriate given there's no user-known secret to derive from in this app's auth model (Firebase, not a local password vault).
- **Recommendation** (not implemented in this pass — a design decision requiring product input, not a pure bug fix): introduce an explicit key-rotation story (e.g. a versioned key ID alongside the `v1` suffix, with re-encryption on next successful auth) before this encryption pattern is extended to protect additional data such as the SOS offline queue (see `05-Secure-Storage.md`). Not urgent for the current single use case, since Keychain/Keystore-backed keys are not exportable/exfiltratable in the first place — rotation here is about defense-in-depth for a long-lived key, not closing an active vulnerability.

## Crypto failure handling

Confirmed fail-closed throughout the one real crypto path: a decryption/MAC failure returns `null` (`encryptedAuthStorage.ts:36-44`), which the caller treats as "no session found," never as "trust this data anyway." No crypto errors are silently swallowed in a way that would downgrade to plaintext or skip verification.
