import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import {
  encryptWithKeys,
  decryptWithKeys,
  isEncryptedBlob,
  bytesToBase64,
  ENCRYPTED_BLOB_PREFIX,
} from "../aesCbcHmac.ts";

function b64(bytes: Buffer): string {
  return bytes.toString("base64");
}

function freshKeys() {
  return { encKey: b64(randomBytes(32)), macKey: b64(randomBytes(32)), iv: b64(randomBytes(16)) };
}

test("encrypt then decrypt round-trips the original plaintext", () => {
  const { encKey, macKey, iv } = freshKeys();
  const plaintext = JSON.stringify({ uid: "abc123", refreshToken: "super-secret-token", nested: { a: 1 } });
  const blob = encryptWithKeys(plaintext, iv, encKey, macKey);
  assert.equal(decryptWithKeys(blob, encKey, macKey), plaintext);
});

test("round-trips unicode and empty strings", () => {
  const { encKey, macKey, iv } = freshKeys();
  for (const plaintext of ["", "hello", "🚨 emergency — safety app データ"]) {
    const blob = encryptWithKeys(plaintext, iv, encKey, macKey);
    assert.equal(decryptWithKeys(blob, encKey, macKey), plaintext);
  }
});

test("produced blob is tagged with the version prefix and is not the plaintext", () => {
  const { encKey, macKey, iv } = freshKeys();
  const plaintext = "a-refresh-token-value";
  const blob = encryptWithKeys(plaintext, iv, encKey, macKey);
  assert.ok(isEncryptedBlob(blob));
  assert.ok(blob.startsWith(ENCRYPTED_BLOB_PREFIX));
  assert.ok(!blob.includes(plaintext));
});

test("decryption fails closed (returns null) when the MAC key is wrong", () => {
  const { encKey, macKey, iv } = freshKeys();
  const wrongMacKey = b64(randomBytes(32));
  const blob = encryptWithKeys("secret", iv, encKey, macKey);
  assert.equal(decryptWithKeys(blob, encKey, wrongMacKey), null);
});

test("decryption never returns the original plaintext when the encryption key is wrong", () => {
  const { encKey, macKey, iv } = freshKeys();
  const wrongEncKey = b64(randomBytes(32));
  const plaintext = "secret-value";
  const blob = encryptWithKeys(plaintext, iv, encKey, macKey);
  const result = decryptWithKeys(blob, wrongEncKey, macKey);
  assert.notEqual(result, plaintext);
});

test("decryption fails closed when the ciphertext is tampered with", () => {
  const { encKey, macKey, iv } = freshKeys();
  const blob = encryptWithKeys("secret-value", iv, encKey, macKey);
  const [prefix, rest] = [blob.slice(0, ENCRYPTED_BLOB_PREFIX.length), blob.slice(ENCRYPTED_BLOB_PREFIX.length)];
  const [ivPart, ciphertextPart, macPart] = rest.split(".");
  // Flip the last character of the ciphertext (still valid base64 alphabet).
  const flipped = ciphertextPart.slice(0, -1) + (ciphertextPart.at(-1) === "A" ? "B" : "A");
  const tamperedBlob = `${prefix}${ivPart}.${flipped}.${macPart}`;
  assert.equal(decryptWithKeys(tamperedBlob, encKey, macKey), null);
});

test("decryption fails closed on malformed blobs instead of throwing", () => {
  const { encKey, macKey } = freshKeys();
  assert.equal(decryptWithKeys("not-an-encrypted-blob", encKey, macKey), null);
  assert.equal(decryptWithKeys(`${ENCRYPTED_BLOB_PREFIX}onlyonepart`, encKey, macKey), null);
  assert.equal(decryptWithKeys(`${ENCRYPTED_BLOB_PREFIX}a.b`, encKey, macKey), null);
  assert.equal(decryptWithKeys("", encKey, macKey), null);
});

test("isEncryptedBlob distinguishes tagged blobs from legacy plaintext", () => {
  assert.equal(isEncryptedBlob(`${ENCRYPTED_BLOB_PREFIX}x.y.z`), true);
  assert.equal(isEncryptedBlob('{"uid":"abc","stsTokenManager":{}}'), false);
  assert.equal(isEncryptedBlob(""), false);
});

test("each encryption uses the supplied IV, so equal plaintexts with different IVs produce different ciphertexts", () => {
  const { encKey, macKey } = freshKeys();
  const blobA = encryptWithKeys("same-plaintext", b64(randomBytes(16)), encKey, macKey);
  const blobB = encryptWithKeys("same-plaintext", b64(randomBytes(16)), encKey, macKey);
  assert.notEqual(blobA, blobB);
});

test("bytesToBase64 matches Node's own base64 encoding for the same bytes", () => {
  for (const len of [0, 1, 2, 3, 4, 15, 16, 17, 32]) {
    const bytes = randomBytes(len);
    assert.equal(bytesToBase64(new Uint8Array(bytes)), bytes.toString("base64"));
  }
});

test("keys produced via bytesToBase64 round-trip through encrypt/decrypt", () => {
  const encKey = bytesToBase64(new Uint8Array(randomBytes(32)));
  const macKey = bytesToBase64(new Uint8Array(randomBytes(32)));
  const iv = bytesToBase64(new Uint8Array(randomBytes(16)));
  const plaintext = "firebase-refresh-token-blob";
  const blob = encryptWithKeys(plaintext, iv, encKey, macKey);
  assert.equal(decryptWithKeys(blob, encKey, macKey), plaintext);
});
