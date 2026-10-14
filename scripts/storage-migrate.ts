/**
 * Verschlüsselung des privaten Speichers einführen bzw. Schlüssel wechseln.
 *   npm run storage:migrate              Probelauf (zählt nur)
 *   npm run storage:migrate -- --apply   schreibt (jedes Objekt wird zurückgelesen und geprüft)
 * Voraussetzung: STORAGE_ENCRYPTION_KEY (neu) und – beim Wechsel – STORAGE_ENCRYPTION_KEY_PREVIOUS (alt); Speicher- und DB-Zugang wie im Betrieb.
 * Vorher eine Sicherung machen (npm run backup).
 */
import { keyRingFromEnv } from '../src/lib/storage-crypto';
import { getRawStorage } from '../src/server/storage';
import { migrateStorage } from '../src/server/storage/migrate';

async function main() {
  const ring = keyRingFromEnv();
  if (!ring) throw new Error('STORAGE_ENCRYPTION_KEY ist nicht gesetzt.');
  const raw = getRawStorage();
  if (!raw) throw new Error('Kein Speicher konfiguriert (STORAGE_DRIVER …).');
  const apply = process.argv.includes('--apply');
  const r = await migrateStorage(raw, ring, { apply });
  console.log(`${apply ? 'ANGEWENDET' : 'PROBELAUF'}: ${r.total} Objekte · unverschlüsselt ${r.plaintext} · alter Schlüssel ${r.rotated} · bereits aktuell ${r.current} · fehlend ${r.missing.length} · Fehler ${r.errors.length}`);
  for (const m of r.missing.slice(0, 10)) console.log('  fehlt:', m);
  for (const e of r.errors.slice(0, 10)) console.log('  Fehler:', e);
  if (r.errors.length || r.missing.length) process.exitCode = 1;
  if (!apply && (r.plaintext || r.rotated)) console.log('Zum Umsetzen: npm run storage:migrate -- --apply');
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
