import { describe, it, expect } from 'vitest';
import { generateCodeVerifier, generateCodeChallenge, verifyCodeChallenge } from './pkce.js';

describe('PKCE Helpers (RFC 7636)', () => {
  it('generates a high-entropy URL-safe code verifier within allowed length bounds', () => {
    const verifier = generateCodeVerifier(64);
    expect(verifier).toBeTypeOf('string');
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    // URL-safe base64 characters only
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates consistent SHA-256 S256 code challenge for a known verifier', () => {
    // Known RFC 7636 vector or fixed value test
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = generateCodeChallenge(verifier);
    expect(challenge).toBeTypeOf('string');
    expect(challenge.length).toBeGreaterThan(0);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);

    // Verifying same challenge reproduces identically
    expect(generateCodeChallenge(verifier)).toBe(challenge);
  });

  it('correctly verifies a valid code verifier against its challenge', () => {
    const verifier = generateCodeVerifier(64);
    const challenge = generateCodeChallenge(verifier);
    expect(verifyCodeChallenge(verifier, challenge)).toBe(true);
  });

  it('rejects an incorrect code verifier against a challenge', () => {
    const verifier1 = generateCodeVerifier(64);
    const verifier2 = generateCodeVerifier(64);
    const challenge1 = generateCodeChallenge(verifier1);

    expect(verifyCodeChallenge(verifier2, challenge1)).toBe(false);
  });

  it('rejects tampered or mismatched length challenges', () => {
    const verifier = generateCodeVerifier(64);
    expect(verifyCodeChallenge(verifier, 'short_invalid_challenge')).toBe(false);
  });
});
