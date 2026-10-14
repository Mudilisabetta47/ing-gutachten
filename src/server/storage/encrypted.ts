import 'server-only';
import { decryptBytes, encryptBytes, isEncrypted, type KeyRing } from '@/lib/storage-crypto';
import { StorageError, type StorageDriver } from './types';

/**
 * Umhüllt einen Speichertreiber mit Verschlüsselung (AES-256-GCM, siehe lib/storage-crypto).
 * Signierte Direkt-URLs gibt es dann nicht mehr (der Anbieter könnte nur Chiffretext liefern) – der Server entschlüsselt und liefert selbst aus.
 * `allowPlaintext`: nur für die Übergangszeit nach dem Einschalten, solange alte Objekte noch unverschlüsselt sind (nie in Staging/Produktion).
 */
export function encryptedDriver(inner: StorageDriver, ring: KeyRing, opts: { allowPlaintext: boolean }): StorageDriver {
  return {
    id: inner.id,
    async put(key, bytes, mimeType) {
      await inner.put(key, encryptBytes(ring, key, bytes), 'application/octet-stream');
    },
    async overwrite(key, bytes) {
      await inner.overwrite(key, encryptBytes(ring, key, bytes), 'application/octet-stream');
    },
    async get(key) {
      const raw = await inner.get(key);
      if (!raw) return null;
      if (!isEncrypted(raw)) {
        if (opts.allowPlaintext) return raw;
        throw new StorageError('Das Objekt ist nicht verschlüsselt (unerwartet).');
      }
      return decryptBytes(ring, key, raw).bytes;
    },
    delete: (key) => inner.delete(key),
    exists: (key) => inner.exists(key),
    async signedUrl() {
      return null;
    },
  };
}
