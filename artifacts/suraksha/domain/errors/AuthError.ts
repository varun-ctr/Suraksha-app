import { AppError } from "./AppError";

/** Sign-in, sign-up, or session failures — expired token, bad credentials, provider errors. */
export class AuthError extends AppError {
  readonly code = "AUTH" as const;
  readonly reason?: string;

  constructor(message: string, options?: { reason?: string; cause?: unknown }) {
    super(message, options?.cause);
    this.reason = options?.reason;
  }
}
