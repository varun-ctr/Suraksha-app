import { apiFetch } from "@/core/network/apiClient";
import type { Result } from "@/domain/result/Result";
import { ok, err } from "@/domain/result/Result";
import type { AppError } from "@/domain/errors";
import { NetworkError, AuthError } from "@/domain/errors";
import type { EmailOtpRepository, EmailOtpVerified } from "@/domain/repositories/EmailOtpRepository";
import { toAppError } from "@/repositories/api/emailOtpErrorMapper";

const UNREACHABLE_MESSAGE = "Couldn't reach the server. Please check your connection and try again.";

async function parseErrorBody(response: Response): Promise<AppError> {
  try {
    const body = (await response.json()) as { error?: string; message?: string };
    return toAppError(body.error, body.message ?? "Couldn't send the code. Please try again.");
  } catch {
    return new AuthError("Couldn't send the code. Please try again.");
  }
}

/** Requests a 6-digit sign-in code be emailed to the given address. */
async function requestCode(email: string): Promise<Result<void, AppError>> {
  const { response } = await apiFetch("/auth/email-otp/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  if (!response) return err(new NetworkError(UNREACHABLE_MESSAGE));
  if (response.ok) return ok(undefined);
  return err(await parseErrorBody(response));
}

/** Verifies a 6-digit code and, on success, returns a Firebase custom token to complete sign-in with. */
async function verifyCode(email: string, code: string): Promise<Result<EmailOtpVerified, AppError>> {
  const { response } = await apiFetch("/auth/email-otp/verify", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
  if (!response) return err(new NetworkError(UNREACHABLE_MESSAGE));

  try {
    const body = (await response.json()) as { customToken?: string; error?: string; message?: string };
    if (response.ok && body.customToken) return ok({ customToken: body.customToken });
    return err(toAppError(body.error, body.message ?? "That code is invalid or has expired."));
  } catch {
    return err(new AuthError("Something went wrong. Please try again."));
  }
}

export const emailOtpRepository: EmailOtpRepository = { requestCode, verifyCode };
