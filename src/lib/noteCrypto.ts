// Client-side encryption for password-protected notes.
// - Title + content are encrypted together with AES-GCM.
// - Key is derived from the user's note-password via PBKDF2-SHA256 (200k iters).
// - Server only ever sees ciphertext + a separate password verifier hash.
//
// Formats:
//   ENC:  "enc:v1:<saltB64>:<ivB64>:<ciphertextB64>"
//   HASH: "hash:v1:<saltB64>:<hashB64>"   (PBKDF2-SHA256, 200k, 32 bytes)

const ENC_PREFIX = 'enc:v1:';
const HASH_PREFIX = 'hash:v1:';
const PBKDF2_ITERS = 200_000;

// The Web Crypto API (`crypto.subtle`) is only available in "secure contexts":
// HTTPS, or http://localhost / 127.0.0.1. When the app is served over plain
// HTTP from a remote host (e.g. http://192.168.x.x:8080 in Docker), `crypto`
// exists but `crypto.subtle` is `undefined`, which gives the cryptic
// "Cannot read properties of undefined (reading 'importKey')" error.
function getSubtle(): SubtleCrypto {
  const subtle =
    typeof crypto !== 'undefined' ? (crypto as Crypto).subtle : undefined;
  if (!subtle) {
    const isSecure =
      typeof window !== 'undefined' ? window.isSecureContext : false;
    const host =
      typeof window !== 'undefined' ? window.location.hostname : 'unknown';
    throw new Error(
      `Versleuteling is niet beschikbaar in deze omgeving (host: ${host}, secure context: ${isSecure}). ` +
        `De Web Crypto API werkt alleen via HTTPS of via http://localhost. ` +
        `Open de app via https:// of via http://localhost om notities te kunnen vergrendelen.`,
    );
  }
  return subtle;
}

// ---------- base64 helpers ----------
function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToBuf(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const ab = new ArrayBuffer(bin.length);
  const out = new Uint8Array(ab);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- key derivation ----------
async function deriveKey(password: string, salt: BufferSource): Promise<CryptoKey> {
  const subtle = getSubtle();
  const baseKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function deriveBits(password: string, salt: BufferSource, bytes = 32): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    baseKey,
    bytes * 8,
  );
  return new Uint8Array(bits);
}

// ---------- public API: payload encrypt/decrypt ----------
// Payload now contains only the note content. The title is intentionally
// kept in plaintext so notes remain identifiable in lists/search.
export interface NotePayload {
  content: string;
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX);
}

export async function encryptPayload(payload: NotePayload, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv } as AesGcmParams, key, plaintext as BufferSource);
  return `${ENC_PREFIX}${bufToB64(salt)}:${bufToB64(iv)}:${bufToB64(ct)}`;
}

export async function decryptPayload(blob: string, password: string): Promise<NotePayload> {
  if (!isEncrypted(blob)) throw new Error('Not an encrypted payload');
  const rest = blob.slice(ENC_PREFIX.length);
  const [saltB64, ivB64, ctB64] = rest.split(':');
  if (!saltB64 || !ivB64 || !ctB64) throw new Error('Malformed ciphertext');
  const salt = b64ToBuf(saltB64);
  const iv = b64ToBuf(ivB64);
  const ct = b64ToBuf(ctB64);
  const key = await deriveKey(password, salt);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  } catch {
    throw new Error('Onjuist wachtwoord');
  }
  const text = new TextDecoder().decode(plain);
  return JSON.parse(text) as NotePayload;
}

// ---------- public API: password verifier hash ----------
export function isHashedPassword(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(HASH_PREFIX);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveBits(password, salt, 32);
  return `${HASH_PREFIX}${bufToB64(salt)}:${bufToB64(hash)}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  // Legacy plaintext password (pre-encryption migration): accept literal match.
  if (!isHashedPassword(stored)) return password === stored;
  const rest = stored.slice(HASH_PREFIX.length);
  const [saltB64, hashB64] = rest.split(':');
  if (!saltB64 || !hashB64) return false;
  const salt = b64ToBuf(saltB64);
  const expected = b64ToBuf(hashB64);
  const got = await deriveBits(password, salt, expected.length);
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ expected[i];
  return diff === 0;
}
