import 'server-only';
import { randomBytes } from 'node:crypto';
import { localDriver } from './local';
import { s3Driver } from './s3';
import type { StorageDriver } from './types';

export { StorageError } from './types';
export type { StorageDriver } from './types';

let cached: { sig: string; driver: StorageDriver | null } | null = null;

/**
 * Konfigurierter privater Speicher oder `null`, wenn keiner eingerichtet ist (dann bleibt alles wie in Phase 2:
 * Fotos nur im Mail-Anhang). Der lokale Treiber wird auf Vercel verweigert (dort ist das Dateisystem flüchtig).
 */
export function getStorage(env: NodeJS.ProcessEnv = process.env): StorageDriver | null {
  const kind = (env.STORAGE_DRIVER ?? '').toLowerCase();
  const sig = [kind, env.S3_BUCKET_PRIVATE, env.S3_ENDPOINT, env.STORAGE_LOCAL_DIR, env.VERCEL].join('|');
  if (cached && cached.sig === sig) return cached.driver;
  let driver: StorageDriver | null = null;
  if (kind === 'local') {
    if (env.VERCEL) console.error('[storage] STORAGE_DRIVER=local ist auf Vercel nicht erlaubt (flüchtiges Dateisystem).');
    else driver = localDriver();
  } else if (kind === 's3' && env.S3_BUCKET_PRIVATE && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY) {
    driver = s3Driver({ endpoint: env.S3_ENDPOINT, region: env.S3_REGION || 'auto', bucket: env.S3_BUCKET_PRIVATE, accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY });
  }
  cached = { sig, driver };
  return driver;
}

export const isStorageConfigured = () => getStorage() !== null;

/** Zufälliger Objektschlüssel, z. B. `p/2026/10/9fK3…` – enthält nichts über Inhalt, Kunde oder Fall. */
export function newStorageKey(prefix: 'p' | 'd' | 't' = 'p', now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${prefix}/${y}/${m}/${randomBytes(18).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, 'x')}`;
}
