/**
 * Base class for every typed application error. Each subclass sets a fixed
 * `code` literal so callers can discriminate on it (`if (error.code === "NETWORK")`)
 * without instanceof checks across module boundaries — useful since Hermes/Metro
 * fast refresh can occasionally produce duplicate class identities.
 */
export abstract class AppError extends Error {
  abstract readonly code: string;
  readonly cause?: unknown;

  protected constructor(message: string, cause?: unknown) {
    super(message);
    this.name = new.target.name;
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
