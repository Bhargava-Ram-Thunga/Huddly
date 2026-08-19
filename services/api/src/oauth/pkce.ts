import crypto from 'node:crypto';

/**
 * Generate cryptographically random code verifier for PKCE (RFC 7636)
 * High-entropy cryptographic string between 43 and 128 characters using unreserved characters.
 */
export function generateCodeVerifier(length = 64): string {
  const byteLength = Math.ceil((length * 3) / 4);
  return crypto
    .randomBytes(byteLength)
    .toString('base64url')
    .slice(0, Math.max(43, Math.min(128, length)));
}

/**
 * Generate code challenge from code verifier using S256 (SHA-256 base64url)
 */
export function generateCodeChallenge(codeVerifier: string): string {
  return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}

/**
 * Verify code verifier matches the code challenge using SHA-256 base64url
 */
export function verifyCodeChallenge(codeVerifier: string, expectedChallenge: string): boolean {
  const actualChallenge = generateCodeChallenge(codeVerifier);
  if (actualChallenge.length !== expectedChallenge.length) {
    return false;
  }
  return crypto.timingSafeEqual(
    Buffer.from(actualChallenge, 'utf8'),
    Buffer.from(expectedChallenge, 'utf8'),
  );
}
