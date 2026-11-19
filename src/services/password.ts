/**
 * Password hashing service.
 *
 * Uses PBKDF2 (via the Web Crypto API) with a per-user random salt and a high
 * iteration count. Passwords are NEVER stored in plain text — only the
 * derived hash is persisted, and login re-derives the hash to compare.
 *
 * Stored format:  `pbkdf2$<iterations>$<saltBase64>$<hashBase64>`
 */

const ITERATIONS = 100_000;
const KEY_LENGTH = 32; // 256-bit
const SALT_LENGTH = 16; // 128-bit
const ALGORITHM = 'PBKDF2';
const DIGEST = 'SHA-256';

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function derive(password: string, salt: ArrayBuffer): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: ALGORITHM }, false, ['deriveBits'],
  );
  return crypto.subtle.deriveBits(
    { name: ALGORITHM, salt, iterations: ITERATIONS, hash: DIGEST },
    keyMaterial, KEY_LENGTH * 8,
  );
}

/** Hash a plain-text password for storage. Returns the `pbkdf2$...` string. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const hash = await derive(password, salt.buffer);
  return `pbkdf2$${ITERATIONS}$${bufToB64(salt.buffer as ArrayBuffer)}$${bufToB64(hash)}`;
}

/**
 * Verify a plain-text password against a stored `pbkdf2$...` hash.
 * Constant-time comparison to avoid timing leaks.
 */
export async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  const salt = b64ToBuf(parts[2]);
  const expected = parts[3];
  const hash = await derive(password, salt);
  const actual = bufToB64(hash);
  return constantTimeEqual(actual, expected);
}

/** Constant-time string comparison. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Basic email format check. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Minimum password strength check. */
export function isStrongPassword(password: string): boolean {
  return password.length >= 6;
}
