import 'server-only';
import { createHash } from 'node:crypto';
import { db } from '@/server/db';
import { decryptBytes, encryptBytes, isEncrypted, type KeyRing } from '@/lib/storage-crypto';
import type { StorageDriver } from './types';

export type MigrateReport = { total: number; plaintext: number; rotated: number; current: number; missing: string[]; errors: string[]; applied: boolean };

/**
 * Wartung des privaten Speichers:
 *  - unverschlüsselte Objekte verschlüsseln (nach dem Einschalten der Verschlüsselung)
 *  - mit dem alten Schlüssel (STORAGE_ENCRYPTION_KEY_PREVIOUS) verschlüsselte Objekte mit dem aktuellen neu verschlüsseln
 * Ohne `apply` wird nur gezählt (Probelauf). Jedes geschriebene Objekt wird sofort zurückgelesen und verglichen.
 */
export async function migrateStorage(raw: StorageDriver, ring: KeyRing, opts: { apply: boolean }): Promise<MigrateReport> {
  const rows = await db.media.findMany({ select: { storageKey: true, thumbKey: true } });
  const keys = [...new Set(rows.flatMap((r) => [r.storageKey, r.thumbKey]).filter((k): k is string => Boolean(k)))];
  const rep: MigrateReport = { total: keys.length, plaintext: 0, rotated: 0, current: 0, missing: [], errors: [], applied: opts.apply };
  for (const key of keys) {
    try {
      const blob = await raw.get(key);
      if (!blob) { rep.missing.push(key); continue; }
      let plain: Uint8Array;
      if (!isEncrypted(blob)) { plain = blob; rep.plaintext++; }
      else {
        const d = decryptBytes(ring, key, blob);
        if (!d.usedPrevious) { rep.current++; continue; }
        plain = d.bytes; rep.rotated++;
      }
      if (!opts.apply) continue;
      const enc = encryptBytes(ring, key, plain);
      await raw.overwrite(key, enc, 'application/octet-stream');
      const back = await raw.get(key);
      const ok = back && isEncrypted(back) && createHash('sha256').update(decryptBytes(ring, key, back).bytes).digest('hex') === createHash('sha256').update(plain).digest('hex');
      if (!ok) rep.errors.push(`${key}: Rückprüfung fehlgeschlagen`);
    } catch (e) {
      rep.errors.push(`${key}: ${e instanceof Error ? e.message : 'Fehler'}`);
    }
  }
  return rep;
}
