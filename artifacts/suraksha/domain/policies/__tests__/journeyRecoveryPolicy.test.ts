import { test } from "node:test";
import assert from "node:assert/strict";

import { computeJourneyStatus, type JourneyTiming } from "../journeyRecoveryPolicy.ts";

const timing: JourneyTiming = { startedAtMs: 1_000_000, durationSec: 900, overdueGraceSec: 60 };

test("well within the planned duration is active, with correct seconds remaining", () => {
  const status = computeJourneyStatus(timing, timing.startedAtMs + 100_000);
  assert.deepEqual(status, { phase: "active", elapsedSec: 100, secondsRemaining: 800 });
});

test("exactly at the duration boundary transitions to overdue, not active", () => {
  const status = computeJourneyStatus(timing, timing.startedAtMs + timing.durationSec * 1000);
  assert.equal(status.phase, "overdue");
  if (status.phase === "overdue") {
    assert.equal(status.overdueElapsedSec, 0);
    assert.equal(status.graceSecondsRemaining, 60);
  }
});

test("partway through the grace period is overdue with the correct remaining countdown", () => {
  const nowMs = timing.startedAtMs + (timing.durationSec + 30) * 1000;
  const status = computeJourneyStatus(timing, nowMs);
  assert.equal(status.phase, "overdue");
  if (status.phase === "overdue") {
    assert.equal(status.overdueElapsedSec, 30);
    assert.equal(status.graceSecondsRemaining, 30);
  }
});

test("exactly at the grace-period boundary is expired, not overdue", () => {
  const nowMs = timing.startedAtMs + (timing.durationSec + timing.overdueGraceSec) * 1000;
  const status = computeJourneyStatus(timing, nowMs);
  assert.equal(status.phase, "expired");
});

test("long past the grace period (e.g. app was backgrounded/killed for hours) is still just expired, not a crash or a negative countdown", () => {
  const nowMs = timing.startedAtMs + (timing.durationSec + timing.overdueGraceSec + 3600) * 1000;
  const status = computeJourneyStatus(timing, nowMs);
  assert.equal(status.phase, "expired");
  if (status.phase === "expired") {
    assert.equal(status.overdueElapsedSec, timing.overdueGraceSec + 3600);
  }
});

test("a timestamp before startedAtMs (clock skew) clamps to zero elapsed rather than going negative", () => {
  const status = computeJourneyStatus(timing, timing.startedAtMs - 5000);
  assert.deepEqual(status, { phase: "active", elapsedSec: 0, secondsRemaining: timing.durationSec });
});
