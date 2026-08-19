import argon2 from 'argon2';
import crypto from 'crypto';

/**
 * OWASP Recommended Argon2id Hashing Parameters
 * - Algorithm: Argon2id (v13)
 * - Memory Cost: 64 MiB (65536 KiB)
 * - Time Cost: 3 iterations
 * - Parallelism: 4 threads
 */
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

// Pre-computed dummy Argon2id hash for constant-time email enumeration mitigation
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXJhbmRvbXNhbHQ$qUfC3y5fK5Gq5b8Gz1wW6a0mN2j9X8y4V6b8Z0wW4a8';

/**
 * Hashes a plaintext password using Argon2id.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

/**
 * Verifies a plaintext password against an Argon2id hash.
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Executes a dummy Argon2id verification to mitigate timing attacks when a user is not found.
 */
export async function dummyVerify(dummyPassword = 'dummy-password-check'): Promise<void> {
  try {
    await argon2.verify(DUMMY_HASH, dummyPassword);
  } catch {
    // Intentionally ignored
  }
}

/**
 * Generates an opaque cryptographically secure refresh token and its SHA-256 database hash.
 */
export function generateRefreshToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

/**
 * Computes SHA-256 hash of an opaque refresh token.
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Normalizes an email address to lowercase and trimmed string.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
