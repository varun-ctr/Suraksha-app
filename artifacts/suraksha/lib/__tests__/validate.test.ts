import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeIndianMobile,
  isValidIndianMobile,
  normalizePhone,
  isValidPhone,
  toWhatsAppNumber,
} from "../validate.ts";

test("normalizeIndianMobile strips +91 / 91 / leading-0 prefixes", () => {
  assert.equal(normalizeIndianMobile("+91 98765 43210"), "9876543210");
  assert.equal(normalizeIndianMobile("919876543210"), "9876543210");
  assert.equal(normalizeIndianMobile("09876543210"), "9876543210");
  assert.equal(normalizeIndianMobile("9876543210"), "9876543210");
});

test("normalizeIndianMobile rejects invalid Indian numbers", () => {
  // Must start 6-9
  assert.equal(normalizeIndianMobile("1234567890"), null);
  // Too short / too long
  assert.equal(normalizeIndianMobile("98765"), null);
  assert.equal(normalizeIndianMobile("98765432100"), null);
});

test("isValidIndianMobile mirrors normalizeIndianMobile", () => {
  assert.equal(isValidIndianMobile("+91 98765 43210"), true);
  assert.equal(isValidIndianMobile("1234567890"), false);
});

test("normalizePhone accepts international 7–15 digit numbers", () => {
  // US number falls through to the generic branch
  assert.equal(normalizePhone("+1 (415) 555-2671"), "14155552671");
  // Indian numbers are normalized to the bare 10-digit form
  assert.equal(normalizePhone("+91 98765 43210"), "9876543210");
  // Too short / too long -> null
  assert.equal(normalizePhone("123456"), null);
  assert.equal(normalizePhone("1234567890123456"), null);
});

test("isValidPhone mirrors normalizePhone", () => {
  assert.equal(isValidPhone("+1 (415) 555-2671"), true);
  assert.equal(isValidPhone("123456"), false);
});

test("toWhatsAppNumber prefixes 91 for Indian numbers, digits-only otherwise", () => {
  assert.equal(toWhatsAppNumber("98765 43210"), "919876543210");
  assert.equal(toWhatsAppNumber("+1 (415) 555-2671"), "14155552671");
  assert.equal(toWhatsAppNumber("12345"), null);
});
