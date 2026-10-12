import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { env } from './env';

const key = () => createHash('sha256').update(env('ENCRYPTION_KEY')).digest();

/** AES-256-GCM. Output: base64(iv | tag | ciphertext). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}

export function decrypt(blob: string): string {
  const buf = Buffer.from(blob, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'; // no l/o/0/1 — easy to read aloud

export function randomId(len: number): string {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export const newProjectId = () => `cl_${randomId(8)}`;
export const newApiKey = () => `clk_${randomId(32)}`;
