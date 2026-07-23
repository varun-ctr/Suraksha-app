/**
 * Envelope encryption for values that must live in AsyncStorage (bulk,
 * unencrypted storage) but need at-rest confidentiality — currently:
 * Firebase Auth's persisted session (see repositories/firebase/authStorage.ts).
 *
 * The AES/HMAC keys themselves are small (32 bytes each, base64-encoded to
 * ~44 chars) and live in the OS keystore via expo-secure-store, which is
 * well under its 2048-byte item limit — unlike the Firebase session blob
 * itself, which can exceed that limit and so cannot be stored in
 * SecureStore directly. The bulk ciphertext stays in AsyncStorage; only
 * the key material gets the Keychain/Keystore's hardware-backed
 * protection and exclusion from unencrypted device backups.
 */
import * as Crypto from "expo-crypto";

import { secureGet, secureSet } from "@/core/storage/secureStore";
import { encryptWithKeys, decryptWithKeys, bytesToBase64 } from "@/core/storage/aesCbcHmac";
import { logger } from "@/core/logger/logger";

const ENC_KEY_STORAGE_KEY = "suraksha.crypto.enc.v1";
const MAC_KEY_STORAGE_KEY = "suraksha.crypto.mac.v1";
const KEY_BYTES = 32;
const IV_BYTES = 16;

interface Keys {
  encKey: string;
  macKey: string;
}

// Memoized so concurrent callers during app startup all await the exact
// same generation event, guaranteeing a single, consistent key pair is
// ever used for the lifetime of the process — see the module doc above.
let keysPromise: Promise<Keys> | null = null;

async function getOrCreateKey(storageKey: string): Promise<string> {
  const existing = await secureGet(storageKey);
  if (existing) return existing;
  const fresh = bytesToBase64(await Crypto.getRandomBytesAsync(KEY_BYTES));
  await secureSet(storageKey, fresh);
  return fresh;
}

async function loadOrCreateKeys(): Promise<Keys> {
  // TEMP-DEBUG(startup-audit): 8/9 — this runs the first time the encrypted
  // Firebase-session storage adapter is touched (on app boot, when Firebase
  // Auth reads its persisted session). If "keys ready" never logs, SecureStore
  // itself is hanging — see core/storage/secureStore.ts's getItemAsync call.
  console.log("[TEMP-DEBUG][STARTUP] 8/10 cryptoBox: loading/creating SecureStore-backed encryption keys");
  const [encKey, macKey] = await Promise.all([
    getOrCreateKey(ENC_KEY_STORAGE_KEY),
    getOrCreateKey(MAC_KEY_STORAGE_KEY),
  ]);
  console.log("[TEMP-DEBUG][STARTUP] cryptoBox: keys ready");
  return { encKey, macKey };
}

function getKeys(): Promise<Keys> {
  if (!keysPromise) keysPromise = loadOrCreateKeys();
  return keysPromise;
}

/** Encrypts `plaintext` for storage. Never throws — see module doc for the threat model. */
export async function encryptForStorage(plaintext: string): Promise<string> {
  const { encKey, macKey } = await getKeys();
  const iv = bytesToBase64(await Crypto.getRandomBytesAsync(IV_BYTES));
  return encryptWithKeys(plaintext, iv, encKey, macKey);
}

/**
 * Decrypts a blob produced by `encryptForStorage`. Returns `null` on any
 * failure (wrong/rotated keys, corruption, tampering) — callers should
 * treat that identically to "no value stored", never as a fatal error.
 */
export async function decryptFromStorage(blob: string): Promise<string | null> {
  try {
    const { encKey, macKey } = await getKeys();
    return decryptWithKeys(blob, encKey, macKey);
  } catch (e) {
    logger.warn("[cryptoBox] decryption failed unexpectedly", e);
    return null;
  }
}
