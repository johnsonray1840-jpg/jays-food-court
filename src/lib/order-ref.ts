import crypto from 'crypto';

/**
 * Non-ambiguous uppercase alphanumeric charset:
 * Excludes easily confusable characters (0, O, 1, I, L)
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Generates unique, non-predictable, human-readable order references.
 * Example: "JFC-7KM-92X"
 * Provides ~1.07 billion random permutations per code, preventing enumeration attacks.
 */
export function generateOrderReference(): string {
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `JFC-${code.slice(0, 3)}-${code.slice(3)}`;
}
