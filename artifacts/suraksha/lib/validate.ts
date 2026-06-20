/**
 * Validation helpers. India-focused mobile-number checks so the app only stores
 * numbers it can actually call/text.
 */

/**
 * Normalises an Indian mobile number to its 10-digit form, or null if invalid.
 * Accepts inputs with +91 / 91 / leading-0 prefixes and spacing.
 */
export function normalizeIndianMobile(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10 && /^[6-9]/.test(d)) return d;
  return null;
}

export function isValidIndianMobile(raw: string): boolean {
  return normalizeIndianMobile(raw) !== null;
}

/** International form (with country code, no +) suitable for wa.me links. */
export function toWhatsAppNumber(raw: string): string | null {
  const local = normalizeIndianMobile(raw);
  if (local) return `91${local}`;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 10 ? digits : null;
}
