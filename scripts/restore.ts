/**
 * Wiederherstellung in eine LEERE Datenbank und einen LEEREN Speicher:
 *   npm run restore -- <Sicherungsordner> --db <Ziel-Datenbank-URL> --storage-dir <leerer Ordner>      (lokaler Speicher, z. B. Übung)
 *   npm run restore -- <Sicherungsordner> --db <Ziel-Datenbank-URL> --s3                               (Ziel-Bucket aus S3_* der Umgebung, muss leer sein)
 * Sicherungen:  Es wird nie in eine bestehende Datenbank geschrieben: Ziel muss leer sein und darf nicht die Quelle der Sicherung sein.
 * Danach: Prüfsummen aller Dateien, Zeilenzahlen gegenüber dem Manifest, alle Datei-Verweise der Datenbank vorhanden, Entschlüsselung aller Dateien
 * (mit STORAGE_ENCRYPTION_KEY), `db:check`-Ausgabe. Dauer wird gemessen und ausgegeben.
 */
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { decryptBytes, isEncrypted, keyRingFromEnv } from '../src/lib/storage-crypto';
import { getRawStorage } from '../src/server/storage';
import { localDriver } from '../src/server/storage/local';
import { s3Driver } from '../src/server/storage/s3';
import { backupKey, dbHostOf, dbNameOf, decryptFile, libpqUrl, referencedKeys, run, sha256Buf, tableCounts } from './_backup-lib';
import { verifyBackup } from './backup-verify';

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const has = (n: string) => process.argv.includes(n);

async function main() {
  const t0 = Date.now();
  const dir = process.argv[2] && !process.argv[2].startsWith('--') ? path.resolve(process.argv[2]) : '';
  const target = arg('--db');
  if (!dir || !target) { console.error('Aufruf: npm run restore -- <Sicherungsordner> --db <Ziel-URL> (--storage-dir <Ordner> | --s3)'); process.exit(2); }
  if (target === process.env.DATABASE_URL || target === process.env.BACKUP_DATABASE_URL) throw new Error('Ziel ist die laufende Datenbank. Abbruch – immer in eine NEUE, leere Datenbank zurückspielen.');

  const v = await verifyBackup(dir);
  if (!v.ok) { for (const p of v.problems) console.error(' -', p); throw new Error('Sicherung ist fehlerhaft – nichts wurde zurückgespielt.'); }
  const m = v.manifest;
  if (dbNameOf(target) === m.source.database && dbHostOf(target) === m.source.host) throw new Error('Ziel entspricht der Quelle der Sicherung. Abbruch.');
  console.log(`✔ Sicherung geprüft (${m.createdAt}, Quelle ${m.source.database}@${m.ingEnv})`);

  // Ziel muss leer sein
  const c = new pg.Client({ connectionString: target });
  await c.connect();
  const existing = Number((await c.query(`SELECT count(*) AS n FROM information_schema.tables WHERE table_schema='public'`)).rows[0].n);
  await c.end();
  if (existing > 0) throw new Error(`Die Ziel-Datenbank ist nicht leer (${existing} Tabellen). Abbruch.`);

  // Ziel-Speicher
  let dst;
  if (arg('--storage-dir')) {
    const sd = path.resolve(arg('--storage-dir')!);
    if ((await readdir(sd).catch(() => [])).length) throw new Error(`Der Ziel-Speicherordner ${sd} ist nicht leer. Abbruch.`);
    dst = localDriver(sd);
  } else if (has('--s3')) {
    const e = process.env;
    if (!e.S3_BUCKET_PRIVATE || !e.S3_ACCESS_KEY_ID || !e.S3_SECRET_ACCESS_KEY) throw new Error('S3_* sind nicht gesetzt.');
    dst = s3Driver({ endpoint: e.S3_ENDPOINT, region: e.S3_REGION || 'auto', bucket: e.S3_BUCKET_PRIVATE, accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY });
    const first = Object.keys(m.objects.files)[0];
    if (first && (await dst.exists(first))) throw new Error('Der Ziel-Bucket enthält bereits Objekte aus der Sicherung. Abbruch (leeren Bucket verwenden).');
  } else throw new Error('Ziel-Speicher fehlt: --storage-dir <Ordner> oder --s3.');

  // Datenbank
  const work = path.join(os.tmpdir(), `ing-restore-${process.pid}`);
  await mkdir(work, { recursive: true, mode: 0o700 });
  try {
    const dump = path.join(work, 'db.dump');
    if (m.db.encrypted) await decryptFile(path.join(dir, m.db.file), dump, backupKey()!); else await copyFile(path.join(dir, m.db.file), dump);
    // Erweiterungen der Quelle anlegen (liegen nicht im Schema-Dump); Schema „public“ existiert im Ziel bereits → aus der Liste nehmen.
    const ec = new pg.Client({ connectionString: target });
    await ec.connect();
    for (const x of m.extensions ?? []) {
      if (!/^[a-z0-9_]+$/.test(x.name) || !/^[a-z0-9_]+$/.test(x.schema)) throw new Error('Ungültiger Erweiterungsname im Manifest.');
      await ec.query(`CREATE EXTENSION IF NOT EXISTS "${x.name}" WITH SCHEMA "${x.schema}"`).catch(() => ec.query(`CREATE EXTENSION IF NOT EXISTS "${x.name}"`));
    }
    await ec.end();
    const list = await run('pg_restore', ['--list', dump], process.env, true);
    if (list.code !== 0) throw new Error(`pg_restore --list fehlgeschlagen: ${list.err.trim().slice(0, 300)}`);
    const listFile = path.join(work, 'restore.list');
    await writeFile(listFile, list.out.split('\n').filter((l) => !/ SCHEMA - public /.test(l) && !/ EXTENSION - /.test(l)).join('\n'));
    const r = await run('pg_restore', ['--no-owner', '--no-privileges', '--exit-on-error', '--use-list', listFile, '--dbname', libpqUrl(target), dump]);
    if (r.code !== 0) throw new Error(`pg_restore fehlgeschlagen: ${r.err.trim().slice(0, 600)}`);
  } finally { await rm(work, { recursive: true, force: true }); }
  // Zugriffshärtung (RLS, Rechte der Supabase-Rollen) erneut anwenden – wegen --no-privileges auf der sicheren Seite; idempotent.
  const hc = new pg.Client({ connectionString: target });
  await hc.connect();
  try { if ((await hc.query(`SELECT 1 FROM pg_proc WHERE proname='ing_harden_public'`)).rowCount) await hc.query('SELECT public.ing_harden_public()'); } finally { await hc.end(); }
  const tDb = Date.now();
  console.log(`✔ Datenbank zurückgespielt (${((tDb - t0) / 1000).toFixed(1)} s)`);

  // Dateien
  for (const k of Object.keys(m.objects.files)) await dst.put(k, new Uint8Array(await readFile(path.join(dir, 'objects', k))), 'application/octet-stream');
  console.log(`✔ ${m.objects.count} Dateien zurückgespielt (${((Date.now() - tDb) / 1000).toFixed(1)} s)`);

  // Prüfungen
  const problems: string[] = [];
  const counts = await tableCounts(target);
  for (const [t, n] of Object.entries(m.tables)) if (counts[t] !== n) problems.push(`Tabelle ${t}: ${counts[t] ?? 'fehlt'} statt ${n} Zeilen`);
  for (const t of Object.keys(counts)) if (!(t in m.tables)) problems.push(`Unerwartete Tabelle ${t}`);
  const refs = await referencedKeys(target);
  let decrypted = 0, noKey = 0;
  const ring = keyRingFromEnv();
  for (const k of refs) {
    const b = await dst.get(k);
    if (!b) { problems.push(`Datei fehlt im Ziel-Speicher: ${k}`); continue; }
    if (sha256Buf(b) !== m.objects.files[k]?.sha256) problems.push(`Datei weicht ab: ${k}`);
    if (isEncrypted(b)) { if (ring) { try { decryptBytes(ring, k, b); decrypted++; } catch { problems.push(`Entschlüsselung fehlgeschlagen: ${k}`); } } else noKey++; }
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  Tabellen ${Object.keys(counts).length}, Zeilen ${Object.values(counts).reduce((a, b) => a + b, 0)} · Verweise ${refs.length} · entschlüsselt ${decrypted}${noKey ? ` · ohne Schlüssel nicht geprüft ${noKey}` : ''}`);
  if (problems.length) { console.log(`✖ Wiederherstellung unvollständig:`); for (const p of problems.slice(0, 20)) console.log('  -', p); process.exit(1); }
  console.log(`✔ Wiederherstellung vollständig und geprüft. Gesamtdauer ${secs} s`);
  console.log('Nächste Schritte: DATABASE_URL auf das Ziel zeigen lassen → npm run db:check → Stichproben (Anmeldung, Fall mit Fotos, Gutachten-PDF, Rechnung).');
}
main().catch((e) => { console.error('Wiederherstellung fehlgeschlagen:', e instanceof Error ? e.message : e); process.exit(1); });
