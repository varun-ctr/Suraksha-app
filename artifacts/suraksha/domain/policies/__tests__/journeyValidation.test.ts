import { test } from "node:test";
import assert from "node:assert/strict";

import {
  validateJourneyDuration,
  MIN_JOURNEY_DURATION_MINUTES,
  MAX_JOURNEY_DURATION_MINUTES,
} from "../journeyValidation.ts";

test("accepts every real UI preset (15, 30, 60 minutes)", () => {
  for (const preset of [15, 30, 60]) {
    const result = validateJourneyDuration(preset);
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.value, preset);
  }
});

test("rejects a negative duration", () => {
  const result = validateJourneyDuration(-15);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.field, "durationMinutes");
});

test("rejects zero", () => {
  const result = validateJourneyDuration(0);
  assert.equal(result.ok, false);
});

test("rejects a duration below the minimum", () => {
  const result = validateJourneyDuration(1);
  assert.equal(result.ok, false);
});

test("rejects an excessively long duration", () => {
  const result = validateJourneyDuration(10_000);
  assert.equal(result.ok, false);
});

test("accepts exactly the minimum and maximum boundary values", () => {
  assert.equal(validateJourneyDuration(MIN_JOURNEY_DURATION_MINUTES).ok, true);
  assert.equal(validateJourneyDuration(MAX_JOURNEY_DURATION_MINUTES).ok, true);
});

test("rejects NaN and non-finite input", () => {
  assert.equal(validateJourneyDuration(NaN).ok, false);
  assert.equal(validateJourneyDuration(Infinity).ok, false);
});
