import type { Result } from "@/domain/result/Result";
import type { AppError } from "@/domain/errors";

export interface EmailOtpVerified {
  /** Firebase custom token minted by the backend once the code checks out — completes sign-in via signInWithCustomTokenFB. */
  customToken: string;
}

export interface EmailOtpRepository {
  requestCode(email: string): Promise<Result<void, AppError>>;
  verifyCode(email: string, code: string): Promise<Result<EmailOtpVerified, AppError>>;
}
