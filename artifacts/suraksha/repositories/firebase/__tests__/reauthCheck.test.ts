import { test } from "node:test";
import assert from "node:assert/strict";

import { isReauthRequired } from "../reauthCheck.ts";

test("recognizes auth/requires-recent-login", () => {
  assert.equal(isReauthRequired({ code: "auth/requires-recent-login" }), true);
});

test("recognizes auth/user-token-expired", () => {
  assert.equal(isReauthRequired({ code: "auth/user-token-expired" }), true);
});

test("does not flag unrelated Firebase errors", () => {
  assert.equal(isReauthRequired({ code: "auth/wrong-password" }), false);
  assert.equal(isReauthRequired({ code: "auth/network-request-failed" }), false);
});

test("handles non-Firebase errors and missing/malformed input safely", () => {
  assert.equal(isReauthRequired(new Error("plain error")), false);
  assert.equal(isReauthRequired(undefined), false);
  assert.equal(isReauthRequired(null), false);
  assert.equal(isReauthRequired("a string"), false);
  assert.equal(isReauthRequired({}), false);
});
