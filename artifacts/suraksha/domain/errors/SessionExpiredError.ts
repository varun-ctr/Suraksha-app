import { AppError } from "./AppError.ts";

/** The persisted session is no longer valid — revoked, expired, or undecryptable at rest. */
export class SessionExpiredError extends AppError {
  readonly code = "SESSION_EXPIRED" as const;
  readonly reason?: string;

  constructor(message: string, options?: { reason?: string; cause?: unknown }) {
    super(message, options?.cause);
    this.reason = options?.reason;
  }
}
