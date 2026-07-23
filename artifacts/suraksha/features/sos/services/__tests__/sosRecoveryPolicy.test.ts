import { test } from "node:test";
import assert from "node:assert/strict";

import { isPendingActivationStale, MAX_RECOVERABLE_AGE_MS } from "../sosRecoveryPolicy.ts";

test("a pending activation within the recoverable window is not stale", () => {
  const triggeredAt = 1_000_000;
  assert.equal(isPendingActivationStale(triggeredAt, triggeredAt), false);
  assert.equal(isPendingActivationStale(triggeredAt, triggeredAt + MAX_RECOVERABLE_AGE_MS - 1), false);
});

test("a pending activation exactly at the cutoff is not yet stale", () => {
  const triggeredAt = 1_000_000;
  assert.equal(isPendingActivationStale(triggeredAt, triggeredAt + MAX_RECOVERABLE_AGE_MS), false);
});

test("a pending activation past the cutoff is stale", () => {
  const triggeredAt = 1_000_000;
  assert.equal(isPendingActivationStale(triggeredAt, triggeredAt + MAX_RECOVERABLE_AGE_MS + 1), true);
  assert.equal(isPendingActivationStale(triggeredAt, triggeredAt + 24 * 60 * 60 * 1000), true);
});
