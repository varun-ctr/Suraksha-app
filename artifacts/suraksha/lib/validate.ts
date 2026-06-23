/**
 * Phone-number validation helpers.
 *
 * Primary target is Indian mobile numbers, but the app must also be able to
 * store international contacts. Anything between 7–15 digits (ITU-T E.164
 * range) is accepted as a fallback.
 */

/** Strips whitespace, dashes, parentheses and the optional leading +. */
function digits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Normalises an Indian mobile number to its bare 10-digit form.
 * Accepts +91/91 prefix and leading-0 prefix. Returns null for non-Indian.
 */
export function normalizeIndianMobile(raw: string): string | null {
  let d = digits(raw);
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10 && /^[6-9]/.test(d)) return d;
  return null;
}

export function isValidIndianMobile(raw: string): boolean {
  return normalizeIndianMobile(raw) !== null;
}

/**
 * Normalises any phone number that can plausibly be called or texted:
 *  - Indian mobile  → bare 10-digit form  (e.g. "9876543210")
 *  - International  → digit-only form      (e.g. "14155552671")
 *
 * Accepts 7–15 digits (ITU-T E.164 range). Returns null if too short/long.
 */
export function normalizePhone(raw: string): string | null {
  const indian = normalizeIndianMobile(raw);
  if (indian) return indian;
  const d = digits(raw);
  if (d.length >= 7 && d.length <= 15) return d;
  return null;
}

export function isValidPhone(raw: string): boolean {
  return normalizePhone(raw) !== null;
}

/** International form (no +) suitable for wa.me and tel: links. */
export function toWhatsAppNumber(raw: string): string | null {
  const indian = normalizeIndianMobile(raw);
  if (indian) return `91${indian}`;
  const d = digits(raw);
  return d.length >= 7 ? d : null;
}
