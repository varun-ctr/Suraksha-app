import { test } from "node:test";
import assert from "node:assert/strict";

import { toAppError } from "../emailOtpErrorMapper.ts";
import { ValidationError } from "../../../domain/errors/ValidationError.ts";
import { AuthError } from "../../../domain/errors/AuthError.ts";
import { OTPExpiredError } from "../../../domain/errors/OTPExpiredError.ts";

test("maps invalid_email and invalid_request to ValidationError", () => {
  assert.ok(toAppError("invalid_email", "bad email") instanceof ValidationError);
  assert.ok(toAppError("invalid_request", "bad request") instanceof ValidationError);
});

test("maps invalid_or_expired to OTPExpiredError with reason 'expired'", () => {
  const e = toAppError("invalid_or_expired", "That code is invalid or has expired.");
  assert.ok(e instanceof OTPExpiredError);
  assert.equal((e as OTPExpiredError).reason, "expired");
});

test("maps invalid_code to OTPExpiredError with reason 'invalid_code'", () => {
  const e = toAppError("invalid_code", "Incorrect code. Please try again.");
  assert.ok(e instanceof OTPExpiredError);
  assert.equal((e as OTPExpiredError).reason, "invalid_code");
});

test("maps too_many_attempts to OTPExpiredError with reason 'too_many_attempts'", () => {
  const e = toAppError("too_many_attempts", "Too many incorrect attempts. Request a new code.");
  assert.ok(e instanceof OTPExpiredError);
  assert.equal((e as OTPExpiredError).reason, "too_many_attempts");
});

test("maps rate_limited to AuthError with a matching reason", () => {
  const e = toAppError("rate_limited", "Too many requests. Please wait and try again.");
  assert.ok(e instanceof AuthError);
  assert.equal((e as AuthError).reason, "rate_limited");
});

test("falls back to a plain AuthError for unknown or missing codes", () => {
  assert.ok(toAppError(undefined, "Something went wrong.") instanceof AuthError);
  assert.ok(toAppError("not_configured", "Email sign-in is not configured on the server.") instanceof AuthError);
});

test("preserves the server-provided message verbatim on every branch", () => {
  const message = "a very specific message from the backend";
  for (const code of [undefined, "invalid_email", "invalid_or_expired", "invalid_code", "too_many_attempts", "rate_limited"]) {
    assert.equal(toAppError(code, message).message, message);
  }
});
