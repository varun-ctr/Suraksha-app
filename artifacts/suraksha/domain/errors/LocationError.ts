import { AppError } from "./AppError";

/** GPS/location subsystem failure that isn't a plain permission denial — no fix available, provider disabled, timed out. */
export class LocationError extends AppError {
  readonly code = "LOCATION" as const;
  readonly reason?: string;

  constructor(message: string, options?: { reason?: string; cause?: unknown }) {
    super(message, options?.cause);
    this.reason = options?.reason;
  }
}
