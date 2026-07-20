import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CODE_TTL_MS,
  hashCode,
  generateCode,
  isValidEmail,
  isValidCodeFormat,
  isExpired,
} from "../lib/otp.ts";

test("hashCode is deterministic, hex, and not the plaintext", () => {
  const h = hashCode("123456");
  assert.equal(h, hashCode("123456"));
  assert.notEqual(h, "123456");
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.notEqual(hashCode("123456"), hashCode("123457"));
});

test("generateCode returns a 6-digit numeric string in range", () => {
  for (let i = 0; i < 200; i++) {
    const code = generateCode();
    assert.match(code, /^\d{6}$/);
    const n = Number(code);
    assert.ok(n >= 100000 && n <= 999999, `out of range: ${code}`);
  }
});

test("isValidEmail accepts normal addresses and rejects malformed ones", () => {
  assert.equal(isValidEmail("a@b.co"), true);
  assert.equal(isValidEmail("user.name@example.com"), true);
  assert.equal(isValidEmail("no-at-sign"), false);
  assert.equal(isValidEmail("no@dot"), false);
  assert.equal(isValidEmail("spaces @example.com"), false);
  assert.equal(isValidEmail(""), false);
});

test("isValidCodeFormat requires exactly 6 digits", () => {
  assert.equal(isValidCodeFormat("123456"), true);
  assert.equal(isValidCodeFormat("12345"), false);
  assert.equal(isValidCodeFormat("1234567"), false);
  assert.equal(isValidCodeFormat("12a456"), false);
});

test("isExpired compares the ISO expiry against now", () => {
  const now = Date.now();
  const future = new Date(now + CODE_TTL_MS).toISOString();
  const past = new Date(now - 1000).toISOString();
  assert.equal(isExpired(future, now), false);
  assert.equal(isExpired(past, now), true);
  // Boundary: strictly-less-than, so exactly-now is not yet expired
  assert.equal(isExpired(new Date(now).toISOString(), now), false);
});
