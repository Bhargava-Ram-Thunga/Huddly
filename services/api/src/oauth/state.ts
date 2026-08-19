import crypto from 'node:crypto';
import { config } from '@huddly/config';

export interface OAuthStatePayload {
  provider: string;
  nonce: string;
  timestamp: number;
}

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
const GCM_IV_LENGTH = 12;

function getStateEncryptionKey(customSecret?: string): Buffer {
  const source = customSecret || config.JWT_SECRET || 'default-fallback-secret-for-oauth';
  return crypto.scryptSync(source, 'huddly-oauth-state-salt', 32);
}

/**
 * Generate an authenticated AES-256-GCM encrypted state token to prevent CSRF attacks
 */
export function generateOAuthState(provider: string, customSecret?: string): string {
  const payload: OAuthStatePayload = {
    provider: provider.toLowerCase(),
    nonce: crypto.randomBytes(16).toString('hex'),
    timestamp: Date.now(),
  };

  const key = getStateEncryptionKey(customSecret);
  const iv = crypto.randomBytes(GCM_IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const payloadJson = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(payloadJson, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64url')}.${encrypted.toString('base64url')}.${authTag.toString('base64url')}`;
}

/**
 * Validate and decrypt an OAuth state parameter against expected provider, integrity tag, and expiration
 */
export function verifyOAuthState(
  stateToken: string,
  expectedProvider: string,
  customSecret?: string,
  maxAgeMs = STATE_MAX_AGE_MS,
): { valid: boolean; error?: string } {
  if (!stateToken || typeof stateToken !== 'string') {
    return { valid: false, error: 'State parameter missing' };
  }

  const parts = stateToken.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return { valid: false, error: 'Malformed state parameter' };
  }

  const [ivB64, encryptedB64, authTagB64] = parts;
  let payload: OAuthStatePayload;

  try {
    const key = getStateEncryptionKey(customSecret);
    const iv = Buffer.from(ivB64, 'base64url');
    const encrypted = Buffer.from(encryptedB64, 'base64url');
    const authTag = Buffer.from(authTagB64, 'base64url');

    if (iv.length !== GCM_IV_LENGTH || authTag.length !== 16) {
      return { valid: false, error: 'Invalid state token formatting' };
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    payload = JSON.parse(decrypted.toString('utf8')) as OAuthStatePayload;
  } catch {
    return { valid: false, error: 'State verification or decryption failed' };
  }

  if (payload.provider?.toLowerCase() !== expectedProvider.toLowerCase()) {
    return {
      valid: false,
      error: `Provider mismatch (expected ${expectedProvider}, got ${payload.provider})`,
    };
  }

  if (
    typeof payload.timestamp !== 'number' ||
    Date.now() - payload.timestamp > maxAgeMs ||
    payload.timestamp > Date.now() + 60000
  ) {
    return { valid: false, error: 'State parameter expired' };
  }

  return { valid: true };
}
