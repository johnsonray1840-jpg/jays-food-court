/**
 * Nigerian Phone Number Normalization and Validation
 * Standardizes any Nigerian phone input to E.164 format: +234XXXXXXXXXX
 */

export function normalizeNigerianPhone(input: string): string | null {
  if (!input) return null;

  // Remove spaces, hyphens, parentheses, and dots
  let cleaned = input.replace(/[\s\-\(\)\.]/g, '');

  // Handle +234 or 234 prefix
  if (cleaned.startsWith('+234')) {
    cleaned = cleaned.substring(4);
  } else if (cleaned.startsWith('234')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // A valid Nigerian subscriber number has 10 digits after the country code/leading 0
  // Starting with 70, 80, 81, 90, 91
  const ngPhoneRegex = /^[789][01]\d{8}$/;

  if (!ngPhoneRegex.test(cleaned)) {
    return null;
  }

  return `+234${cleaned}`;
}

/**
 * Checks whether an input string is a valid Nigerian phone number.
 */
export function isValidNigerianPhone(input: string): boolean {
  return normalizeNigerianPhone(input) !== null;
}

/**
 * Returns a display format for UI, e.g. "0801 234 5678"
 */
export function formatPhoneDisplay(normalized: string): string {
  if (!normalized) return '';
  if (normalized.startsWith('+234') && normalized.length === 14) {
    const local = '0' + normalized.substring(4);
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }
  return normalized;
}
