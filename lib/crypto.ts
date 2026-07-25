import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.DOCS_ENCRYPTION_KEY;
  if (!raw) throw new Error('DOCS_ENCRYPTION_KEY não configurada no .env.local.');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('DOCS_ENCRYPTION_KEY precisa ser 32 bytes em base64 (ex: `openssl rand -base64 32`).');
  return key;
}

/** Formato: [12 bytes IV][16 bytes auth tag][conteúdo cifrado]. */
export function encryptBuffer(data: Buffer): Buffer {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

export function decryptBuffer(data: Buffer): Buffer {
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
