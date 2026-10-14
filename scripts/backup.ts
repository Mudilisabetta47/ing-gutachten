/**
 * Sicherung: Datenbank (pg_dump) + privater Dateispeicher + Prüfsummen-Manifest.
 *   npm run backup -- [--out <Ordner>] [--keep <Anzahl>]
 * Liest nur (Datenbank und Speicher bleiben unverändert) – läuft auch gegen Staging/Produktion.
 * Ziel: ein neuer Ordner <out>/ing-backup-<Zeitstempel>/ ; mit --keep werden ältere Sicherungen darüber hinaus gelöscht.
 * Datenbank: BACKUP_DATABASE_URL (direkte Verbindung, nicht der Pooler) – sonst DATABASE_URL. pg_dump muss mindestens so neu wie der Server sein.
 * In Staging/Produktion ist BACKUP_ENCRYPTION_KEY Pflicht (der Dump enthält Klartext-Kundendaten); die Dateien im Speicher sind dort bereits
 * mit STORAGE_ENCRYPTION_KEY verschlüsselt und werden unverändert (als Chiffretext) gesichert.
 */
import { mkdir, readdir, rm, rename, writeFile } from 'node:fs/promises';
import { statSync } from 'node:fs';
import path from 'node:path';
import { isLiveEnv, ingEnv } from '../src/lib/env';
import { getRawStorage } from '../src/server/storage';
import { backupKey, dbHostOf, dbNameOf, encryptFile, extensionsOf, libpqUrl, manifestMac, referencedKeys, run, sha256Buf, sha256File, tableCounts, type Manifest } from './_backup-lib';

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };

async function main() {
  const t0 = Date.now();
  const url = process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL || '';
  if (!url) throw new Error('DATABASE_URL (oder BACKUP_DATABASE_URL) fehlt.');
  const master = backupKey();
  if (!master && isLiveEnv()) throw new Error('BACKUP_ENCRYPTION_KEY fehlt – in Staging/Produktion werden keine unverschlüsselten Sicherungen erzeugt.');
  const outRoot = path.resolve(arg('--out') ?? process.env.BACKUP_DIR ?? 'backups');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const dir = path.join(outRoot, `ing-backup-${stamp}`);
  const tmp = `${dir}.partial`;
  await mkdir(path.join(tmp, 'objects'), { recursive: true, mode: 0o700 });

  // 1. Datenbank
  const dumpPlain = path.join(tmp, 'db.dump');
  const d = await run('pg_dump', ['--format=custom', '--schema=public', '--no-owner', '--no-privileges', '--file', dumpPlain, '--dbname', libpqUrl(url)]);
  if (d.code !== 0) throw new Error(`pg_dump fehlgeschlagen: ${d.err.trim().slice(0, 400)}`);
  const plainSha = await sha256File(dumpPlain);
  let dbFile = 'db.dump';
  if (master) { await encryptFile(dumpPlain, `${dumpPlain}.enc`, master); await rm(dumpPlain); dbFile = 'db.dump.enc'; }
  const dbPath = path.join(tmp, dbFile);

  // 2. Dateispeicher (Chiffretext, wie er im Bucket liegt)
  const raw = getRawStorage();
  const keys = await referencedKeys(url);
  const files: Manifest['objects']['files'] = {};
  const missing: string[] = [];
  let bytes = 0;
  if (keys.length && !raw) throw new Error(`Die Datenbank verweist auf ${keys.length} Dateien, aber kein Speicher ist konfiguriert (STORAGE_DRIVER …).`);
  for (const k of keys) {
    const blob = await raw!.get(k);
    if (!blob) { missing.push(k); continue; }
    const f = path.join(tmp, 'objects', k);
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(f, blob, { flag: 'wx', mode: 0o600 });
    files[k] = { sha256: sha256Buf(blob), bytes: blob.length };
    bytes += blob.length;
  }
  const encryptedStorage = Object.keys(files).length > 0 && (await Promise.all(Object.keys(files).slice(0, 5).map(async (k) => Buffer.from((await raw!.get(k))!.subarray(0, 5)).toString() === 'INGE1'))).every(Boolean);

  // 3. Manifest (Zeilenzahlen aus derselben Datenbank, direkt nach dem Dump)
  const manifest: Manifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    ingEnv: ingEnv(),
    source: { host: dbHostOf(url), database: dbNameOf(url) },
    db: { file: dbFile, sha256: await sha256File(dbPath), bytes: statSync(dbPath).size, encrypted: Boolean(master), plainSha256: plainSha },
    objects: { count: Object.keys(files).length, bytes, files, missing },
    tables: await tableCounts(url),
    encryptedStorage,
    extensions: await extensionsOf(url),
  };
  const json = JSON.stringify(manifest, null, 2);
  await writeFile(path.join(tmp, 'manifest.json'), json, { mode: 0o600 });
  if (master) await writeFile(path.join(tmp, 'manifest.hmac'), manifestMac(json, master), { mode: 0o600 });
  await rename(tmp, dir);

  // 4. Aufbewahrung
  const keep = Number(arg('--keep') ?? process.env.BACKUP_KEEP ?? 0);
  let pruned = 0;
  if (keep > 0) {
    const all = (await readdir(outRoot)).filter((n) => /^ing-backup-\d{8}T\d{6}Z$/.test(n)).sort();
    for (const old of all.slice(0, Math.max(0, all.length - keep))) { await rm(path.join(outRoot, old), { recursive: true, force: true }); pruned++; }
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Sicherung fertig: ${dir}`);
  console.log(`  Datenbank ${(manifest.db.bytes / 1024).toFixed(0)} KB${master ? ' (verschlüsselt)' : ' (UNVERSCHLÜSSELT – nur Entwicklung)'} · Tabellen ${Object.keys(manifest.tables).length} · Zeilen ${Object.values(manifest.tables).reduce((a, b) => a + b, 0)}`);
  console.log(`  Dateien ${manifest.objects.count} (${(bytes / 1024).toFixed(0)} KB${encryptedStorage ? ', im Speicher verschlüsselt' : ''}) · fehlend im Speicher ${missing.length}${pruned ? ` · alte Sicherungen entfernt ${pruned}` : ''} · ${secs} s`);
  if (missing.length) { console.error(`WARNUNG: ${missing.length} Dateien fehlen im Speicher (z. B. ${missing[0]}). Sicherung ist unvollständig.`); process.exitCode = 3; }
}
main().catch((e) => { console.error('Sicherung fehlgeschlagen:', e instanceof Error ? e.message : e); process.exit(1); });
