/**
 * Utility to convert phone numbers to a deterministic email for Supabase auth.
 * This allows phone+password authentication using Supabase's email+password flow.
 */

/** Normalize phone to digits only, ensuring 11 digits with country-agnostic format */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // If 10 digits (no 9th digit), add 9 after DDD
  if (digits.length === 10) {
    return digits.slice(0, 2) + "9" + digits.slice(2);
  }
  // If 13 digits (with +55), strip country code
  if (digits.length === 13 && digits.startsWith("55")) {
    return digits.slice(2);
  }
  // If 12 digits (55 + 10 digits), strip and add 9
  if (digits.length === 12 && digits.startsWith("55")) {
    const sem55 = digits.slice(2);
    return sem55.slice(0, 2) + "9" + sem55.slice(2);
  }
  return digits;
}

/** Convert a phone number to a deterministic email for auth */
export function phoneToEmail(phone: string): string {
  const normalized = normalizePhone(phone);
  return `${normalized}@phone.gasfacilpro.app`;
}

/** Check if an email is a phone-generated email */
export function isPhoneEmail(email: string): boolean {
  return email.endsWith("@phone.gasfacilpro.app");
}

/** Extract phone from a phone-generated email */
export function emailToPhone(email: string): string | null {
  if (!isPhoneEmail(email)) return null;
  return email.replace("@phone.gasfacilpro.app", "");
}

/** Format phone for display: (XX) XXXXX-XXXX */
export function formatPhoneDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return d;
}

/** Validate if phone has enough digits */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13;
}
