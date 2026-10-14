/**
 * TOTP (RFC 6238) ohne Fremdpaket: HMAC-SHA1, 30-Sekunden-Schritte, 6 Ziffern – kompatibel mit gängigen Authenticator-Apps.
 * Reine Funktionen (nur Node-Crypto), damit sie sich gegen die Testwerte der RFC prüfen lassen.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const STEP_SECONDS = 30;
export const DIGITS = 6;

export function base32Encode(buf: Uint8Array): string {
  let bits = 0, value = 0, out = '';
  for (const b of buf) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error('Ungültiges Zeichen im Schlüssel');
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export const newSecret = (bytes = 20) => base32Encode(randomBytes(bytes));

export function hotp(secret: Buffer, counter: number, digits = DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', secret).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  const code = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(code % 10 ** digits).padStart(digits, '0');
}

export const stepOf = (nowMs: number) => Math.floor(nowMs / 1000 / STEP_SECONDS);
export const totp = (secretBase32: string, nowMs: number, digits = DIGITS) => hotp(base32Decode(secretBase32), stepOf(nowMs), digits);

/**
 * Prüft einen Code im Fenster ±1 Schritt (Uhrabweichung). Liefert den passenden Schritt oder null.
 * `lastStep`: ein bereits benutzter Schritt (oder älter) wird abgelehnt – derselbe Code gilt nur einmal.
 */
export function verifyTotp(secretBase32: string, codeRaw: string, nowMs: number, lastStep: number | null = null, window = 1): number | null {
  const code = codeRaw.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretBase32);
  const cur = stepOf(nowMs);
  let hit: number | null = null;
  for (let d = -window; d <= window; d++) {
    const step = cur + d;
    const expected = Buffer.from(hotp(secret, step));
    // alle Schritte prüfen (konstante Laufzeit), erst danach entscheiden
    if (timingSafeEqual(expected, Buffer.from(code)) && hit === null && (lastStep === null || step > lastStep)) hit = step;
  }
  return hit;
}

export function otpauthUri(account: string, secretBase32: string, issuer = 'ING Gutachten'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

/** „ABCD EFGH …“ – lesbarer zum Abtippen. */
export const groupSecret = (s: string) => s.replace(/(.{4})/g, '$1 ').trim();

/** Wiederherstellungscode: 10 Zeichen ohne verwechselbare Zeichen, als „xxxxx-xxxxx“. */
export function newRecoveryCode(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const b = randomBytes(10);
  const raw = [...b].map((x) => chars[x % chars.length]).join('');
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}
export const normalizeRecovery = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '');
