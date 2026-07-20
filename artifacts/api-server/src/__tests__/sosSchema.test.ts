import { test } from "node:test";
import assert from "node:assert/strict";

// Import via the subpath export (src/sos.ts imports only `zod`), so Node's
// --experimental-strip-types loader doesn't have to follow the main entry's
// extensionless internal re-exports (which it can't resolve).
import {
  SendSosAlertBody,
  sendSosAlertContactsMax,
  sendSosAlertMessageMax,
} from "@workspace/api-zod/sos";

const validContact = { id: "c1", name: "Mom", phone: "+919876543210" };

test("SendSosAlertBody accepts a well-formed alert", () => {
  const parsed = SendSosAlertBody.safeParse({
    contacts: [validContact],
    message: "I need help",
    idempotencyKey: "abc-123",
  });
  assert.equal(parsed.success, true);
});

test("name is optional; idempotencyKey is optional", () => {
  const parsed = SendSosAlertBody.safeParse({
    contacts: [{ id: "c1", phone: "9876543210" }],
    message: "help",
  });
  assert.equal(parsed.success, true);
});

test("rejects an empty contacts array", () => {
  const parsed = SendSosAlertBody.safeParse({ contacts: [], message: "help" });
  assert.equal(parsed.success, false);
});

test("rejects more than the contact cap", () => {
  const contacts = Array.from({ length: sendSosAlertContactsMax + 1 }, (_, i) => ({
    id: `c${i}`,
    phone: "9876543210",
  }));
  const parsed = SendSosAlertBody.safeParse({ contacts, message: "help" });
  assert.equal(parsed.success, false);
});

test("rejects an empty message and an over-long message", () => {
  assert.equal(SendSosAlertBody.safeParse({ contacts: [validContact], message: "" }).success, false);
  const long = "x".repeat(sendSosAlertMessageMax + 1);
  assert.equal(SendSosAlertBody.safeParse({ contacts: [validContact], message: long }).success, false);
});

test("rejects a contact missing id or phone", () => {
  assert.equal(
    SendSosAlertBody.safeParse({ contacts: [{ phone: "9876543210" }], message: "help" }).success,
    false,
  );
  assert.equal(
    SendSosAlertBody.safeParse({ contacts: [{ id: "c1" }], message: "help" }).success,
    false,
  );
});
