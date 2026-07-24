import { test } from "node:test";
import assert from "node:assert/strict";

import { scrubSentryEvent } from "../sentryScrubber.ts";

test("redacts an email address anywhere in the event", () => {
  const scrubbed = scrubSentryEvent({ message: "failed for jane.doe@example.com" });
  assert.equal(scrubbed?.message, "failed for [REDACTED_EMAIL]");
});

test("redacts a Bearer token", () => {
  const scrubbed = scrubSentryEvent({ message: "auth failed: Bearer abc123.def456-ghi" });
  assert.equal(scrubbed?.message, "auth failed: Bearer [REDACTED]");
});

test("redacts GPS-precision decimal coordinates", () => {
  const scrubbed = scrubSentryEvent({ extra: { note: "at 12.9715987, 77.5945627" } });
  assert.deepEqual(scrubbed?.extra, { note: "at [REDACTED_COORD], [REDACTED_COORD]" });
});

test("does not redact ordinary low-precision decimals (false-positive guard)", () => {
  const scrubbed = scrubSentryEvent({ message: "retry after 4.5 seconds, v2.1 released" });
  assert.equal(scrubbed?.message, "retry after 4.5 seconds, v2.1 released");
});

test("redacts a phone number", () => {
  const scrubbed = scrubSentryEvent({ message: "contact +91 98765 43210 unreachable" });
  assert.equal(scrubbed?.message, "contact [REDACTED_PHONE] unreachable");
});

test("removes user and Authorization/Cookie headers entirely", () => {
  const scrubbed = scrubSentryEvent({
    user: { id: "uid-123", email: "jane@example.com" },
    request: { headers: { Authorization: "Bearer secret", Cookie: "session=1", "X-Other": "keep-me" } },
  });
  assert.equal(scrubbed?.user, undefined);
  const headers = (scrubbed?.request as { headers: Record<string, string> }).headers;
  assert.equal(headers.Authorization, undefined);
  assert.equal(headers.Cookie, undefined);
  assert.equal(headers["X-Other"], "keep-me");
});

test("scrubs nested arrays and objects, not just top-level strings", () => {
  const scrubbed = scrubSentryEvent({
    breadcrumbs: [{ message: "user jane@example.com hit an error" }, { message: "clean breadcrumb" }],
  });
  const breadcrumbs = scrubbed?.breadcrumbs as { message: string }[];
  assert.equal(breadcrumbs[0].message, "user [REDACTED_EMAIL] hit an error");
  assert.equal(breadcrumbs[1].message, "clean breadcrumb");
});

test("leaves non-PII fields (numbers, booleans, closed-enum strings) untouched", () => {
  const scrubbed = scrubSentryEvent({ level: "warning", count: 3, ok: true });
  assert.deepEqual(scrubbed, { level: "warning", count: 3, ok: true });
});
