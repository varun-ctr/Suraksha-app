import { test } from "node:test";
import assert from "node:assert/strict";

import { AppError } from "../AppError.ts";
import { NetworkError } from "../NetworkError.ts";
import { AuthError } from "../AuthError.ts";
import { ValidationError } from "../ValidationError.ts";
import { RepositoryError } from "../RepositoryError.ts";
import { PermissionError } from "../PermissionError.ts";
import { LocationError } from "../LocationError.ts";
import { SessionExpiredError } from "../SessionExpiredError.ts";
import { OTPExpiredError } from "../OTPExpiredError.ts";

const CLASSES = [
  { Ctor: NetworkError, code: "NETWORK" },
  { Ctor: AuthError, code: "AUTH" },
  { Ctor: ValidationError, code: "VALIDATION" },
  { Ctor: RepositoryError, code: "REPOSITORY" },
  { Ctor: PermissionError, code: "PERMISSION" },
  { Ctor: LocationError, code: "LOCATION" },
  { Ctor: SessionExpiredError, code: "SESSION_EXPIRED" },
  { Ctor: OTPExpiredError, code: "OTP_EXPIRED" },
] as const;

for (const { Ctor, code } of CLASSES) {
  test(`${Ctor.name} is an Error with the expected code, name, and message`, () => {
    const e = new Ctor("something went wrong");
    assert.ok(e instanceof Error);
    assert.ok(e instanceof AppError);
    assert.ok(e instanceof Ctor);
    assert.equal(e.code, code);
    assert.equal(e.name, Ctor.name);
    assert.equal(e.message, "something went wrong");
  });
}

test("AppError subclasses preserve an optional cause for debugging", () => {
  const original = new Error("network socket reset");
  const wrapped = new NetworkError("Connection failed. Please check your internet and try again.", { cause: original });
  assert.equal(wrapped.cause, original);
});

test("AuthError carries an optional machine-readable reason alongside the user-facing message", () => {
  const e = new AuthError("Too many attempts. Please wait a moment and try again.", { reason: "rate_limited" });
  assert.equal(e.reason, "rate_limited");
});

test("OTPExpiredError distinguishes expired vs invalid-code vs too-many-attempts via reason", () => {
  assert.equal(new OTPExpiredError("x", { reason: "expired" }).reason, "expired");
  assert.equal(new OTPExpiredError("x", { reason: "invalid_code" }).reason, "invalid_code");
  assert.equal(new OTPExpiredError("x", { reason: "too_many_attempts" }).reason, "too_many_attempts");
});

test("distinct AppError subclasses are not mistaken for one another", () => {
  const authError: AppError = new AuthError("bad credentials");
  assert.ok(!(authError instanceof NetworkError));
  assert.ok(!(authError instanceof OTPExpiredError));
});
