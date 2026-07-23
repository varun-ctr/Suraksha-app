import { test } from "node:test";
import assert from "node:assert/strict";

import { shouldClearLocalCache } from "../localCacheOwnership.ts";

test("fresh install / never persisted: nothing to clear regardless of current uid", () => {
  assert.equal(shouldClearLocalCache(null, null), false);
  assert.equal(shouldClearLocalCache(null, "anon-1"), false);
});

test("same owner (including the anonymous-upgrade case, which preserves uid): no clear", () => {
  assert.equal(shouldClearLocalCache("uid-A", "uid-A"), false);
});

test("normal in-session sign-out: real user to a different (anonymous) uid triggers a clear", () => {
  assert.equal(shouldClearLocalCache("uid-A", "anon-C"), true);
});

test("crash recovery: cached data from a previous run's now-deleted/signed-out owner is cleared on the next launch", () => {
  // Simulates: app killed after Firebase deleteUser()/signOut() succeeded
  // but before this device's local cache was cleared; next launch loads
  // the stale ownerUid from disk and a fresh anonymous session forms.
  assert.equal(shouldClearLocalCache("deleted-user-A", "fresh-anon-C"), true);
});

test("signing out to no session at all (currentUid null) still triggers a clear", () => {
  assert.equal(shouldClearLocalCache("uid-A", null), true);
});
