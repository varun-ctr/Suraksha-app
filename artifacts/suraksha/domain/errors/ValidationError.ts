import { AppError } from "./AppError.ts";

/** Input failed a validation rule — invalid phone number, missing required field, malformed config. */
export class ValidationError extends AppError {
  readonly code = "VALIDATION" as const;
  readonly field?: string;

  constructor(message: string, options?: { field?: string; cause?: unknown }) {
    super(message, options?.cause);
    this.field = options?.field;
  }
}
