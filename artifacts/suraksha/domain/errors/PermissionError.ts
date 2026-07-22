import { AppError } from "./AppError";

/** The user denied (or the OS revoked) a required permission — location, notifications, contacts, camera. */
export class PermissionError extends AppError {
  readonly code = "PERMISSION" as const;
  readonly permission?: string;

  constructor(message: string, options?: { permission?: string; cause?: unknown }) {
    super(message, options?.cause);
    this.permission = options?.permission;
  }
}
