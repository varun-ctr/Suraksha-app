import { AppError } from "./AppError.ts";

/** A network request failed — unreachable host, timeout, or a non-2xx response. */
export class NetworkError extends AppError {
  readonly code = "NETWORK" as const;
  readonly status?: number;
  readonly url?: string;

  constructor(message: string, options?: { status?: number; url?: string; cause?: unknown }) {
    super(message, options?.cause);
    this.status = options?.status;
    this.url = options?.url;
  }
}
