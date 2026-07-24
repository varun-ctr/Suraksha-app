import { test } from "node:test";
import assert from "node:assert/strict";

import { shouldRequireUnlock, DEFAULT_APP_LOCK_GRACE_MS } from "../appLockPolicy.ts";

test("never backgrounded this session (null) never requires a new unlock", () => {
  assert.equal(shouldRequireUnlock(null, 1_000_000), false);
});

test("well within the grace window does not require unlocking again", () => {
  const backgroundedAtMs = 1_000_000;
  assert.equal(shouldRequireUnlock(backgroundedAtMs, backgroundedAtMs + 5_000), false);
});

test("exactly at the grace boundary requires unlocking", () => {
  const backgroundedAtMs = 1_000_000;
  assert.equal(shouldRequireUnlock(backgroundedAtMs, backgroundedAtMs + DEFAULT_APP_LOCK_GRACE_MS), true);
});

test("well past the grace window requires unlocking", () => {
  const backgroundedAtMs = 1_000_000;
  assert.equal(shouldRequireUnlock(backgroundedAtMs, backgroundedAtMs + 3_600_000), true);
});

test("a custom grace window is respected", () => {
  const backgroundedAtMs = 1_000_000;
  assert.equal(shouldRequireUnlock(backgroundedAtMs, backgroundedAtMs + 1_000, 500), true);
  assert.equal(shouldRequireUnlock(backgroundedAtMs, backgroundedAtMs + 1_000, 5_000), false);
});
