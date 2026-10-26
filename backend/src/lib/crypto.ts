import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Invariant 8: Upstream secrets are encrypted at rest with AES-256-GCM,
 * never logged, never returned by any API after submission.
 */
export function encryptSecret(plaintext: string): { encrypted: string; keyVersion: string } {
  const key = Buffer.from(env.CREDENTIAL_ENCRYPTION_KEY, 'hex');
  if (key.length !== 32) {
    throw new Error('CREDENTIAL_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  // Format: iv:encrypted:tag
  const payload = `${iv.toString('hex')}:${encrypted}:${tag}`;
  return {
    encrypted: payload,
    keyVersion: env.CREDENTIAL_ENCRYPTION_KEY_VERSION,
  };
}

export function decryptSecret(encryptedPayload: string): string {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format');
  }

  const [ivHex, ciphertextHex, tagHex] = parts;
  const key = Buffer.from(env.CREDENTIAL_ENCRYPTION_KEY, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * PRD 7.1: High-entropy agent credentials (at least 256 bits = 32 bytes),
 * shown once at creation, stored only as a hash plus a short lookup prefix.
 */
export function generateAgentToken(): { token: string; prefix: string; tokenHash: string } {
  // 32 random bytes = 256 bits entropy
  const entropy = crypto.randomBytes(32).toString('hex');
  const prefix = `tt_live_${entropy.substring(0, 8)}`;
  const token = `tt_live_${entropy}`;
  const tokenHash = hashAgentToken(token);

  return { token, prefix, tokenHash };
}

export function hashAgentToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}
