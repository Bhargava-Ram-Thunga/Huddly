import { describe, it, expect } from 'vitest';
import { generateOAuthState, verifyOAuthState } from './state.js';

describe('OAuth State CSRF Protection (AES-256-GCM)', () => {
  const secretKey = 'super-secret-key-for-state-encryption-32ch';

  it('generates and verifies a valid encrypted state token for a provider', () => {
    const state = generateOAuthState('google', secretKey);
    expect(state).toBeTypeOf('string');
    expect(state.split('.')).toHaveLength(3);

    const result = verifyOAuthState(state, 'google', secretKey);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('is case-insensitive for provider names', () => {
    const state = generateOAuthState('Google', secretKey);
    const result = verifyOAuthState(state, 'GOOGLE', secretKey);
    expect(result.valid).toBe(true);
  });

  it('rejects state if expected provider mismatches', () => {
    const state = generateOAuthState('google', secretKey);
    const result = verifyOAuthState(state, 'github', secretKey);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Provider mismatch/);
  });

  it('rejects tampered ciphertext, IV, or auth tag', () => {
    const state = generateOAuthState('google', secretKey);
    const [iv, enc, tag] = state.split('.');

    // Tampered encrypted content
    const badEnc = `${enc?.slice(0, -4)}abcd`;
    expect(verifyOAuthState(`${iv}.${badEnc}.${tag}`, 'google', secretKey).valid).toBe(false);

    // Tampered auth tag
    const badTag = `${tag?.slice(0, -4)}1234`;
    expect(verifyOAuthState(`${iv}.${enc}.${badTag}`, 'google', secretKey).valid).toBe(false);
  });

  it('rejects expired state parameter', () => {
    const state = generateOAuthState('google', secretKey);
    const result = verifyOAuthState(state, 'google', secretKey, -1);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/State parameter expired/);
  });

  it('rejects malformed or empty state strings', () => {
    expect(verifyOAuthState('', 'google', secretKey).valid).toBe(false);
    expect(verifyOAuthState('no-dot-here', 'google', secretKey).valid).toBe(false);
    expect(verifyOAuthState('only.one.dot', 'google', secretKey).valid).toBe(false);
    expect(verifyOAuthState('too.many.dots.in.here', 'google', secretKey).valid).toBe(false);
  });
});
