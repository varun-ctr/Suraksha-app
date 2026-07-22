import { AppError } from "./AppError.ts";

/** A one-time code was rejected — expired, already used, wrong, or invalidated after too many attempts. */
export class OTPExpiredError extends AppError {
  readonly code = "OTP_EXPIRED" as const;
  readonly reason?: "expired" | "invalid_code" | "too_many_attempts";

  constructor(message: string, options?: { reason?: "expired" | "invalid_code" | "too_many_attempts"; cause?: unknown }) {
    super(message, options?.cause);
    this.reason = options?.reason;
  }
}
