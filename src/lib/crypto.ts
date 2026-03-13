// Simple AES-256-GCM encryption using Node.js crypto
import crypto from 'crypto';

function getKey(): Buffer {
  const ENCRYPTION_KEY = process.env.SECRET_ENCRYPTION_KEY;
  if (!ENCRYPTION_KEY) throw new Error('SECRET_ENCRYPTION_KEY environment variable is required');
  return crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
}

export function encrypt(plaintext: string): string {
  const KEY = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decrypt(ciphertext: string): string {
  const KEY = getKey();
  const data = Buffer.from(ciphertext, 'base64');
  const iv = data.slice(0, 16);
  const tag = data.slice(16, 32);
  const encrypted = data.slice(32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
