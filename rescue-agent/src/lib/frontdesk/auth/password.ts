import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/** promisify() picks scrypt's 3-argument overload, which drops the cost
 *  parameters. Wrapped by hand so N/r/p are actually applied. */
function scryptAsync(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, derivedKey) =>
      error ? reject(error) : resolve(derivedKey),
    );
  });
}

/**
 * PASSWORD HASHING
 *
 * scrypt from node:crypto — no third-party dependency, and the right choice
 * here for the opposite reason to the API keys.
 *
 * API keys are 256-bit random tokens, so a fast digest is correct: brute force
 * is not the threat. A PASSWORD is human-chosen and low-entropy, so the threat
 * IS offline brute force after a database leak, and the hash must be
 * deliberately expensive. Using SHA-256 here — or scrypt there — would be the
 * wrong tool in each case.
 *
 * Stored format: `scrypt$N$r$p$salt$hash` (all base64url). The parameters are
 * stored with the hash so they can be raised later without invalidating
 * existing passwords.
 */

const N = 16_384; // CPU/memory cost
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const SALT_BYTES = 16;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) {
    throw new Error('Password must be at least 12 characters');
  }
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(password, salt, KEY_LENGTH, { N, r: R, p: P });
  return [
    'scrypt',
    N,
    R,
    P,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

/**
 * Verify a password against a stored hash.
 *
 * Returns false rather than throwing on any malformed input, so a corrupt row
 * denies access instead of producing a 500 that leaks which accounts exist.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

    const n = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
    // Refuse absurd parameters from a tampered row rather than trying them.
    if (n < 1024 || n > 1_048_576 || r < 1 || r > 32 || p < 1 || p > 16) return false;

    const salt = Buffer.from(parts[4], 'base64url');
    const expected = Buffer.from(parts[5], 'base64url');
    if (salt.length === 0 || expected.length === 0) return false;

    const derived = await scryptAsync(password, salt, expected.length, { N: n, r, p });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** Minimum bar for a password that protects a restaurant's customer data. */
export function passwordProblem(password: string): string | null {
  if (password.length < 12) return 'Password must be at least 12 characters';
  if (/^\d+$/.test(password)) return 'Password must not be only digits';
  if (/^(.)\1+$/.test(password)) return 'Password must not be a single repeated character';
  return null;
}
