// Phone normalisation for Twilio, which requires E.164 format (+CountryCode…).
// Indian mobile numbers stored without a country code (10 digits, starting
// 6-9) get the +91 prefix added. Extracted into its own module (no side
// effects, no network) so it can be unit-tested without importing the SOS
// route, which pulls in Supabase/Firebase clients at load time.
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) return trimmed;          // already E.164
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return trimmed;                                        // unknown format — pass as-is
}
