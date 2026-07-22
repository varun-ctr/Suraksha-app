import { AppError } from "./AppError";

/** A data-layer operation failed for a reason not better described by NetworkError — a bad query, an unexpected row shape, a constraint violation. */
export class RepositoryError extends AppError {
  readonly code = "REPOSITORY" as const;
  readonly operation?: string;

  constructor(message: string, options?: { operation?: string; cause?: unknown }) {
    super(message, options?.cause);
    this.operation = options?.operation;
  }
}
