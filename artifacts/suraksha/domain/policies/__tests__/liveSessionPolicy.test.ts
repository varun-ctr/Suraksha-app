import { test } from "node:test";
import assert from "node:assert/strict";

import { computeExpiresAt, LIVE_SESSION_HEARTBEAT_TIMEOUT_MS } from "../liveSessionPolicy.ts";

test("computeExpiresAt returns a timestamp exactly one timeout window ahead", () => {
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  const expected = new Date(now + LIVE_SESSION_HEARTBEAT_TIMEOUT_MS).toISOString();
  assert.equal(computeExpiresAt(now), expected);
});

test("computeExpiresAt produces a parseable, strictly-future ISO string", () => {
  const now = Date.now();
  const iso = computeExpiresAt(now);
  assert.equal(Number.isNaN(Date.parse(iso)), false);
  assert.ok(Date.parse(iso) > now);
});
