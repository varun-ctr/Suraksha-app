/**
 * Pure encrypt-then-MAC primitives (AES-256-CBC + HMAC-SHA256) over
 * externally-supplied key/IV material. Deliberately free of any
 * randomness or key storage — those are native-dependent concerns that
 * live in cryptoBox.ts, which this module is unit-tested independently of
 * (see __tests__/aesCbcHmac.test.ts, runnable in plain Node).
 *
 * Construction: encrypt-then-MAC (the MAC covers the ciphertext+IV and is
 * verified BEFORE decryption is attempted), which avoids padding-oracle
 * exposure — the same reasoning that made this the standard construction
 * for CBC-mode ciphersuites before AEAD modes (e.g. AES-GCM) were
 * available. crypto-js does not implement GCM, hence this construction
 * rather than a single-primitive AEAD.
 */
// Explicit ".js" extensions: crypto-js is plain CommonJS with no "exports"
// map, so extensionless subpath resolution (which Metro's bundler resolver
// allows) isn't valid under plain Node ESM resolution — and this module is
// executed directly by `node --test` for unit tests (see __tests__/).
import CryptoJS from "crypto-js/core.js";
// AES pulls in cipher-core as a side effect, which is what actually
// populates CryptoJS.mode / CryptoJS.pad / CryptoJS.lib.CipherParams on
// the shared core object imported above — both imports resolve to the
// same module-cache singleton, so this ordering is required.
import AES from "crypto-js/aes.js";
import encBase64 from "crypto-js/enc-base64.js";
import encUtf8 from "crypto-js/enc-utf8.js";
import HmacSHA256 from "crypto-js/hmac-sha256.js";

const { CBC } = CryptoJS.mode;
const { Pkcs7 } = CryptoJS.pad;
const { CipherParams } = CryptoJS.lib;

/** Tags a blob produced by this module — lets storage callers distinguish
 *  it from pre-existing, unencrypted legacy values without ambiguity. */
export const ENCRYPTED_BLOB_PREFIX = "encv1:";

export function isEncryptedBlob(value: string): boolean {
  return value.startsWith(ENCRYPTED_BLOB_PREFIX);
}

/**
 * Encodes raw random bytes (e.g. from expo-crypto's CSPRNG) as base64,
 * without depending on `Buffer`/`btoa` being present in the JS runtime —
 * neither is guaranteed under Hermes. Used only for key/IV material.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    words[i >>> 2] |= bytes[i] << (24 - (i % 4) * 8);
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length).toString(encBase64);
}

function macOf(ivB64: string, ciphertextB64: string, macKeyB64: string): string {
  const macKey = encBase64.parse(macKeyB64);
  return HmacSHA256(`${ivB64}.${ciphertextB64}`, macKey).toString(encBase64);
}

/** Constant-time string comparison — avoids leaking MAC-match progress via timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Encrypts `plaintext` under `encKeyB64` using the caller-supplied
 * `ivB64` (must be a fresh cryptographically-random 16-byte IV per call —
 * generating it is the caller's responsibility, see cryptoBox.ts) and
 * authenticates the result with `macKeyB64`.
 */
export function encryptWithKeys(
  plaintext: string,
  ivB64: string,
  encKeyB64: string,
  macKeyB64: string,
): string {
  const iv = encBase64.parse(ivB64);
  const key = encBase64.parse(encKeyB64);
  const encrypted = AES.encrypt(plaintext, key, { iv, mode: CBC, padding: Pkcs7 });
  const ciphertextB64 = encrypted.ciphertext.toString(encBase64);
  const mac = macOf(ivB64, ciphertextB64, macKeyB64);
  return `${ENCRYPTED_BLOB_PREFIX}${ivB64}.${ciphertextB64}.${mac}`;
}

/**
 * Verifies and decrypts a blob produced by `encryptWithKeys`. Returns
 * `null` (never throws) on any failure — malformed blob, MAC mismatch
 * (wrong key, corruption, or tampering), or a decode error — so callers
 * can uniformly treat "can't decrypt" as "value unavailable" rather than
 * needing to distinguish failure modes.
 */
export function decryptWithKeys(
  blob: string,
  encKeyB64: string,
  macKeyB64: string,
): string | null {
  if (!isEncryptedBlob(blob)) return null;
  const parts = blob.slice(ENCRYPTED_BLOB_PREFIX.length).split(".");
  if (parts.length !== 3) return null;
  const [ivB64, ciphertextB64, macB64] = parts;
  if (!ivB64 || !ciphertextB64 || !macB64) return null;

  try {
    const expectedMac = macOf(ivB64, ciphertextB64, macKeyB64);
    if (!timingSafeEqual(expectedMac, macB64)) return null;

    const iv = encBase64.parse(ivB64);
    const key = encBase64.parse(encKeyB64);
    const ciphertext = encBase64.parse(ciphertextB64);
    const cipherParams = CipherParams.create({ ciphertext });
    const decrypted = AES.decrypt(cipherParams, key, { iv, mode: CBC, padding: Pkcs7 });
    return decrypted.toString(encUtf8);
  } catch {
    return null;
  }
}
