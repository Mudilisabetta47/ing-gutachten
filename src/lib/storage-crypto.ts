/**
 * Verschlüsselung der Dateien im privaten Speicher (Anwendungsebene, AES-256-GCM).
 * Auch wer Zugriff auf den Bucket oder eine Sicherung des Buckets hat, sieht nur Chiffretext.
 *
 * Format:  "INGE1" | Schlüssel-Kennung (1 Byte) | IV (12) | Chiffretext | GCM-Tag (16)
 *  - Datenschlüssel je Objekt: HKDF-SHA256(Hauptschlüssel, info = "ing-storage-v1:" + Objektschlüssel)
 *  - Objektschlüssel zusätzlich als AAD → ein Objekt lässt sich nicht unter anderem Namen unterschieben
 *  - Schlüsselwechsel: STORAGE_ENCRYPTION_KEY_PREVIOUS wird zum Lesen weiter akzeptiert; `npm run storage:rotate` schreibt neu
 */
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto';

const MAGIC = Buffer.from('INGE1');
const HEAD = MAGIC.length + 1 + 12;
const TAG = 16;

export type KeyRing = { current: Buffer; previous?: Buffer };
export const MIN_KEY_LENGTH = 32;

export const masterKey = (secret: string) => createHash('sha256').update(`ing-storage-master:${secret}`).digest();
export const keyId = (master: Buffer) => createHash('sha256').update(master).digest()[0];
const dataKey = (master: Buffer, objectKey: string) => Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), `ing-storage-v1:${objectKey}`, 32));

export function keyRingFromEnv(env: NodeJS.ProcessEnv = process.env): KeyRing | null {
  const cur = env.STORAGE_ENCRYPTION_KEY ?? '';
  if (!cur) return null;
  if (cur.length < MIN_KEY_LENGTH) throw new Error(`STORAGE_ENCRYPTION_KEY ist zu kurz (mindestens ${MIN_KEY_LENGTH} Zeichen).`);
  const prev = env.STORAGE_ENCRYPTION_KEY_PREVIOUS ?? '';
  return { current: masterKey(cur), ...(prev ? { previous: masterKey(prev) } : {}) };
}

export const isEncrypted = (blob: Uint8Array) => blob.length >= HEAD + TAG && Buffer.from(blob.subarray(0, MAGIC.length)).equals(MAGIC);

export function encryptBytes(ring: KeyRing, objectKey: string, plain: Uint8Array): Uint8Array {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', dataKey(ring.current, objectKey), iv);
  c.setAAD(Buffer.from(objectKey));
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return new Uint8Array(Buffer.concat([MAGIC, Buffer.from([keyId(ring.current)]), iv, ct, c.getAuthTag()]));
}

/** Entschlüsselt; wirft bei falschem Schlüssel, veränderten Daten oder falschem Objektschlüssel. */
export function decryptBytes(ring: KeyRing, objectKey: string, blob: Uint8Array): { bytes: Uint8Array; usedPrevious: boolean } {
  if (!isEncrypted(blob)) throw new Error('Objekt ist nicht verschlüsselt.');
  const b = Buffer.from(blob);
  const id = b[MAGIC.length];
  const iv = b.subarray(MAGIC.length + 1, HEAD);
  const ct = b.subarray(HEAD, b.length - TAG);
  const tag = b.subarray(b.length - TAG);
  const candidates = [ring.current, ...(ring.previous ? [ring.previous] : [])].filter((k) => keyId(k) === id);
  let lastErr: unknown = new Error('Kein passender Schlüssel.');
  for (const k of candidates.length ? candidates : [ring.current, ...(ring.previous ? [ring.previous] : [])]) {
    try {
      const d = createDecipheriv('aes-256-gcm', dataKey(k, objectKey), iv);
      d.setAAD(Buffer.from(objectKey));
      d.setAuthTag(tag);
      return { bytes: new Uint8Array(Buffer.concat([d.update(ct), d.final()])), usedPrevious: ring.previous !== undefined && k === ring.previous };
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}
