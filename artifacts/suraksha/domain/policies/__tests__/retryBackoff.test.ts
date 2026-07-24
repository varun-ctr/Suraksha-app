import { test } from "node:test";
import assert from "node:assert/strict";

import { computeBackoffDelayMs } from "../retryBackoff.ts";

test("doubles the delay each attempt", () => {
  assert.equal(computeBackoffDelayMs(0, 500, 10_000), 500);
  assert.equal(computeBackoffDelayMs(1, 500, 10_000), 1000);
  assert.equal(computeBackoffDelayMs(2, 500, 10_000), 2000);
  assert.equal(computeBackoffDelayMs(3, 500, 10_000), 4000);
});

test("caps the delay at maxDelayMs", () => {
  assert.equal(computeBackoffDelayMs(10, 500, 10_000), 10_000);
});

test("never exceeds maxDelayMs even for attempt 0 with a huge base", () => {
  assert.equal(computeBackoffDelayMs(0, 50_000, 10_000), 10_000);
});
