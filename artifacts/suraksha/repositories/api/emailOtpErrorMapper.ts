/**
 * Pure mapping from the backend's machine-readable `error` code (see
 * api-server's src/routes/email-otp.ts) to a typed AppError. Kept separate
 * from emailOtpRepository.ts (which pulls in apiFetch -> firebaseClient ->
 * native modules at import time) so this logic is unit-testable in plain
 * Node — see __tests__/emailOtpErrorMapper.test.ts.
 *
 * Relative (not "@/…") import: this module is executed directly by plain
 * Node (`node --test`) for unit tests, which has no path-alias resolution.
 */
import type { AppError } from "../../domain/errors/AppError.ts";
import { ValidationError } from "../../domain/errors/ValidationError.ts";
import { AuthError } from "../../domain/errors/AuthError.ts";
import { OTPExpiredError } from "../../domain/errors/OTPExpiredError.ts";

export function toAppError(code: string | undefined, message: string): AppError {
  switch (code) {
    case "invalid_email":
    case "invalid_request":
      return new ValidationError(message);
    case "invalid_or_expired":
      return new OTPExpiredError(message, { reason: "expired" });
    case "invalid_code":
      return new OTPExpiredError(message, { reason: "invalid_code" });
    case "too_many_attempts":
      return new OTPExpiredError(message, { reason: "too_many_attempts" });
    case "rate_limited":
      return new AuthError(message, { reason: "rate_limited" });
    default:
      return new AuthError(message);
  }
}
