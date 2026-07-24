import { test } from "node:test";
import assert from "node:assert/strict";

import {
  getTaskManager,
  getLocalAuthentication,
  __resetCapabilityCacheForTests,
} from "../nativeCapabilities.ts";

// Under the plain Node test runner (no Metro/Babel transform, no React
// Native runtime) requiring an RN-only native module fails for its own
// reasons — not necessarily the same "native module missing" path that
// bites in Expo Go. What matters, and what these tests exercise, is the
// one guarantee nativeCapabilities.ts exists to provide: no exception from
// requiring an unavailable native module ever escapes to the caller.

test("getTaskManager never throws, even when the native module can't be required", () => {
  __resetCapabilityCacheForTests();
  assert.doesNotThrow(() => getTaskManager());
});

test("getLocalAuthentication never throws, even when the native module can't be required", () => {
  __resetCapabilityCacheForTests();
  assert.doesNotThrow(() => getLocalAuthentication());
});

test("repeated calls return the same cached result instead of re-attempting the require every time", () => {
  __resetCapabilityCacheForTests();
  const first = getTaskManager();
  const second = getTaskManager();
  assert.equal(first, second);
});
