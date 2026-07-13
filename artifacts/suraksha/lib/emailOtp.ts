import { apiFetch } from "@/lib/apiClient";

export interface EmailOtpResult {
  ok: boolean;
  error: string | null;
}

/** Requests a 6-digit sign-in code be emailed to the given address. */
export async function requestEmailOtp(email: string): Promise<EmailOtpResult> {
  const { response } = await apiFetch("/auth/email-otp/request", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  if (!response) return { ok: false, error: "Couldn't reach the server. Please check your connection and try again." };
  if (response.ok) return { ok: true, error: null };
  try {
    const body = (await response.json()) as { message?: string };
    return { ok: false, error: body.message ?? "Couldn't send the code. Please try again." };
  } catch {
    return { ok: false, error: "Couldn't send the code. Please try again." };
  }
}

export interface EmailOtpVerifyResult {
  ok: boolean;
  customToken: string | null;
  error: string | null;
}

/** Verifies a 6-digit code and, on success, returns a Firebase custom token to complete sign-in with. */
export async function verifyEmailOtp(email: string, code: string): Promise<EmailOtpVerifyResult> {
  const { response } = await apiFetch("/auth/email-otp/verify", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
  if (!response) return { ok: false, customToken: null, error: "Couldn't reach the server. Please check your connection and try again." };
  try {
    const body = (await response.json()) as { customToken?: string; message?: string };
    if (response.ok && body.customToken) return { ok: true, customToken: body.customToken, error: null };
    return { ok: false, customToken: null, error: body.message ?? "That code is invalid or has expired." };
  } catch {
    return { ok: false, customToken: null, error: "Something went wrong. Please try again." };
  }
}
