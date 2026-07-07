import { test } from "node:test";
import assert from "node:assert/strict";

import { findOfflineAnswer } from "../../constants/emergencyKnowledge.ts";

test("findOfflineAnswer matches helplines by keyword", () => {
  const answer = findOfflineAnswer("what is the police helpline number", "en");
  assert.ok(answer);
  assert.equal(answer?.title, "Emergency Helplines");
});

test("findOfflineAnswer returns the Hindi variant when lang is hi", () => {
  const answer = findOfflineAnswer("मुझे हेल्पलाइन नंबर चाहिए", "hi");
  assert.ok(answer);
  assert.equal(answer?.title, "आपातकालीन हेल्पलाइन");
});

test("findOfflineAnswer picks the entry with the most keyword hits", () => {
  const answer = findOfflineAnswer("first aid for bleeding and burns", "en");
  assert.ok(answer);
  assert.match(answer?.title ?? "", /First Aid/);
});

test("findOfflineAnswer returns null for unrelated or empty queries", () => {
  assert.equal(findOfflineAnswer("what's the weather like today", "en"), null);
  assert.equal(findOfflineAnswer("   ", "en"), null);
});
