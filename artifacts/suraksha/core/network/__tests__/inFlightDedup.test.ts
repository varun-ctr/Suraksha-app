import { test } from "node:test";
import assert from "node:assert/strict";

import { dedupeInFlight } from "../inFlightDedup.ts";

test("two concurrent calls for the same key share one factory invocation", async () => {
  const registry = new Map<string, Promise<number>>();
  let calls = 0;
  const factory = () => {
    calls++;
    return new Promise<number>((resolve) => setTimeout(() => resolve(42), 10));
  };

  const [a, b] = await Promise.all([
    dedupeInFlight(registry, "k", factory),
    dedupeInFlight(registry, "k", factory),
  ]);

  assert.equal(calls, 1);
  assert.equal(a, 42);
  assert.equal(b, 42);
});

test("a call after the first has settled starts a fresh factory invocation (no stale caching)", async () => {
  const registry = new Map<string, Promise<number>>();
  let calls = 0;
  const factory = () => Promise.resolve(++calls);

  const first = await dedupeInFlight(registry, "k", factory);
  const second = await dedupeInFlight(registry, "k", factory);

  assert.equal(first, 1);
  assert.equal(second, 2);
  assert.equal(calls, 2);
});

test("different keys never share a factory invocation", async () => {
  const registry = new Map<string, Promise<string>>();
  const calls: string[] = [];
  const factory = (key: string) => {
    calls.push(key);
    return Promise.resolve(key);
  };

  const [a, b] = await Promise.all([
    dedupeInFlight(registry, "one", () => factory("one")),
    dedupeInFlight(registry, "two", () => factory("two")),
  ]);

  assert.equal(a, "one");
  assert.equal(b, "two");
  assert.deepEqual(calls.sort(), ["one", "two"]);
});

test("a rejection releases the key immediately — does not permanently poison it", async () => {
  const registry = new Map<string, Promise<number>>();
  let attempt = 0;
  const factory = () => {
    attempt++;
    return attempt === 1 ? Promise.reject(new Error("boom")) : Promise.resolve(99);
  };

  await assert.rejects(() => dedupeInFlight(registry, "k", factory));
  const result = await dedupeInFlight(registry, "k", factory);

  assert.equal(result, 99);
  assert.equal(attempt, 2);
});

test("the registry is empty again once every in-flight call has settled", async () => {
  const registry = new Map<string, Promise<number>>();
  await dedupeInFlight(registry, "k", () => Promise.resolve(1));
  // Allow the internal cleanup microtask to run.
  await Promise.resolve();
  assert.equal(registry.size, 0);
});
