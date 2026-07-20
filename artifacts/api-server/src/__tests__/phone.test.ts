import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizePhone } from "../lib/phone.ts";

test("normalizePhone leaves already-E.164 numbers untouched", () => {
  assert.equal(normalizePhone("+919876543210"), "+919876543210");
  assert.equal(normalizePhone("  +14155552671 "), "+14155552671");
});

test("normalizePhone adds +91 to bare 10-digit Indian mobiles (6-9 leading)", () => {
  assert.equal(normalizePhone("9876543210"), "+919876543210");
  assert.equal(normalizePhone("98765 43210"), "+919876543210");
  assert.equal(normalizePhone("6000000000"), "+916000000000");
});

test("normalizePhone converts a 12-digit 91-prefixed number to +91…", () => {
  assert.equal(normalizePhone("919876543210"), "+919876543210");
});

test("normalizePhone passes unknown formats through unchanged", () => {
  // 10 digits not starting 6-9 -> not treated as an Indian mobile
  assert.equal(normalizePhone("1234567890"), "1234567890");
  // Too short
  assert.equal(normalizePhone("12345"), "12345");
});
