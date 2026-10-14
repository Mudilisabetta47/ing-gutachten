/**
 * Wiederherstellungsübung (vollständig, lokal, wegwerfbar):  npm run backup:drill
 *  1. Kopie der Entwicklungsdatenbank + des Dateispeichers als „Produktionsersatz“, Speicher mit frischem Zufallsschlüssel verschlüsseln
 *  2. Sicherung (verschlüsselt) → Prüfung → Manipulationstest
 *  3. Wiederherstellung in eine LEERE Datenbank und einen LEEREN Ordner, Prüfungen, db:check gegen das Ergebnis
 *  4. Schutzprüfungen (nicht-leeres Ziel, laufende DB als Ziel)
 *  5. alles wieder löschen; Zeiten werden ausgegeben (Grundlage für docs/BACKUP-WIEDERHERSTELLUNG.md)
 * Schlüssel entstehen nur im Speicher dieses Prozesses; es wird nichts außerhalb von lokalen Wegwerf-Datenbanken/-Ordnern geschrieben.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const dev = process.env.DATABASE_URL;
if (!dev || !/@?(localhost|127\.0\.0\.1)/.test(dev)) { console.error('Nur mit lokaler DATABASE_URL (node --env-file=.env …).'); process.exit(2); }
const withDb = (n) => dev.replace(/\/[^/?]+(\?.*)?$/, `/${n}$1`);
const plain = (u) => u.replace(/\?.*$/, '');
const stamp = Date.now();
const srcDb = `ing_drill_src_${stamp}`, dstDb = `ing_drill_dst_${stamp}`;
const tmp = mkdtempSync(path.join(os.tmpdir(), 'ing-drill-'));
const out = path.join(tmp, 'backups'), srcStore = path.join(tmp, 'src-storage'), dstStore = path.join(tmp, 'dst-storage');
const rand = () => randomBytes(32).toString('base64url');
const env = { ...process.env, ING_ENV: 'development', DATABASE_URL: withDb(srcDb), STORAGE_DRIVER: 'local', STORAGE_LOCAL_DIR: srcStore, STORAGE_ENCRYPTION_KEY: rand(), BACKUP_ENCRYPTION_KEY: rand() };
delete env.BACKUP_DATABASE_URL;
const results = [];
const step = (n, ok, extra = '') => { results.push(ok); console.log(`${ok ? '✔' : '✖'} ${n}${extra ? ' — ' + extra : ''}`); };
const tsx = (script, args, e = env) => spawnSync('npx', ['tsx', '--conditions=react-server', script, ...args], { cwd: root, env: e, encoding: 'utf8' });
const timed = (f) => { const t = Date.now(); const r = f(); return [r, ((Date.now() - t) / 1000).toFixed(1)]; };
const admin = new pg.Client({ connectionString: withDb('postgres') });

try {
  await admin.connect();
  await admin.query(`CREATE DATABASE ${srcDb}`); await admin.query(`CREATE DATABASE ${dstDb}`);
  // 1. Produktionsersatz
  const dumpFile = path.join(tmp, 'seed.dump');
  spawnSync('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--file', dumpFile, '--dbname', plain(dev)]);
  const rs = spawnSync('pg_restore', ['--no-owner', '--no-privileges', '--dbname', plain(withDb(srcDb)), dumpFile], { encoding: 'utf8' });
  const sc = new pg.Client({ connectionString: withDb(srcDb) }); await sc.connect();
  const nUsers = Number((await sc.query(`SELECT count(*) AS n FROM users`)).rows[0].n); await sc.end();
  step('Übungs-Quelle aus Entwicklungsdatenbank erzeugt', nUsers > 0, `${nUsers} Konten`);
  const devStore = path.join(root, '.data', 'private');
  if (existsSync(devStore)) cpSync(devStore, srcStore, { recursive: true }); else mkdirSync(srcStore, { recursive: true });
  const extraMb = Number(process.env.DRILL_EXTRA_MB ?? 0);
  if (extraMb > 0) { // Mengengerüst für Zeitmessung: künstliche Fotos (Zufallsbytes) mit gültigen Media-Zeilen
    const q = new pg.Client({ connectionString: withDb(srcDb) }); await q.connect();
    const n = Math.ceil((extraMb * 1048576) / 400_000);
    const { createHash } = await import('node:crypto');
    for (let i = 0; i < n; i++) {
      const bytes = randomBytes(400_000); const key = `p/2026/10/synth${String(i).padStart(6, '0')}${randomBytes(4).toString('hex')}`;
      mkdirSync(path.dirname(path.join(srcStore, key)), { recursive: true }); writeFileSync(path.join(srcStore, key), bytes);
      await q.query(`INSERT INTO media (id, storage_key, mime_type, size_bytes, sha256, created_at) VALUES ($1,$2,'image/jpeg',$3,$4,now())`, [`m_synth${i}`, key, bytes.length, createHash('sha256').update(bytes).digest('hex')]);
    }
    await q.end(); console.log(`  (${n} künstliche Fotos, ${extraMb} MB, ergänzt)`);
  }
  let r = tsx('scripts/storage-migrate.ts', ['--apply']);
  step('Dateispeicher der Quelle verschlüsselt', r.status === 0, (r.stdout || r.stderr).trim().split('\n')[0]);

  // 2. Sicherung
  let secs;
  [r, secs] = timed(() => tsx('scripts/backup.ts', ['--out', out, '--keep', '5']));
  console.log(r.stdout.trim()); if (r.status) console.log(r.stderr);
  step('Sicherung erstellt', r.status === 0, `${secs} s`);
  const backupDir = path.join(out, readdirSync(out).find((n) => n.startsWith('ing-backup-')));
  const manifest = JSON.parse(readFileSync(path.join(backupDir, 'manifest.json'), 'utf8'));
  step('Dump ist verschlüsselt (kein Klartext-Header „PGDMP“)', manifest.db.encrypted && readFileSync(path.join(backupDir, manifest.db.file)).subarray(0, 5).toString() !== 'PGDMP');
  r = tsx('scripts/backup-verify.ts', [backupDir]);
  step('Sicherung geprüft (Siegel, Prüfsummen)', r.status === 0, r.stdout.trim().split('\n')[0]);
  // Manipulation: eine Datei in einer Kopie verändern → Prüfung muss scheitern
  const bad = path.join(tmp, 'bad'); cpSync(backupDir, bad, { recursive: true });
  const someKey = Object.keys(manifest.objects.files)[0];
  if (someKey) { const f = path.join(bad, 'objects', someKey); const b = readFileSync(f); b[b.length - 20] ^= 0xff; writeFileSync(f, b); r = tsx('scripts/backup-verify.ts', [bad]); step('Manipulierte Datei wird erkannt', r.status === 1 && /Prüfsumme falsch/.test(r.stdout)); }
  const bad2 = path.join(tmp, 'bad2'); cpSync(backupDir, bad2, { recursive: true });
  writeFileSync(path.join(bad2, 'manifest.json'), readFileSync(path.join(bad2, 'manifest.json'), 'utf8').replace('"ingEnv": "development"', '"ingEnv": "production"'));
  r = tsx('scripts/backup-verify.ts', [bad2]); step('Manipuliertes Manifest wird erkannt (Siegel)', r.status === 1 && /Siegel/.test(r.stdout));
  r = tsx('scripts/backup-verify.ts', [backupDir], { ...env, BACKUP_ENCRYPTION_KEY: rand() }); step('Falscher Sicherungsschlüssel wird erkannt', r.status === 1);

  // 4a. Schutz
  r = tsx('scripts/restore.ts', [backupDir, '--db', env.DATABASE_URL, '--storage-dir', dstStore]); step('Wiederherstellung in die Quelle wird verweigert', r.status === 1 && /Quelle|laufende/.test(r.stderr));
  mkdirSync(dstStore, { recursive: true }); writeFileSync(path.join(dstStore, 'x'), 'x');
  r = tsx('scripts/restore.ts', [backupDir, '--db', withDb(dstDb), '--storage-dir', dstStore]); step('Nicht-leerer Ziel-Speicher wird verweigert', r.status === 1 && /nicht leer/.test(r.stderr));
  rmSync(path.join(dstStore, 'x'));

  // 3. Wiederherstellung
  [r, secs] = timed(() => tsx('scripts/restore.ts', [backupDir, '--db', withDb(dstDb), '--storage-dir', dstStore]));
  console.log(r.stdout.trim()); if (r.status) console.log(r.stderr);
  step('Vollständige Wiederherstellung in leere Datenbank und leeren Speicher', r.status === 0 && /vollständig und geprüft/.test(r.stdout), `${secs} s`);
  r = tsx('scripts/check-db.ts', [], { ...env, DATABASE_URL: withDb(dstDb), STORAGE_LOCAL_DIR: dstStore });
  step('Betriebsprüfung (db:check) gegen die wiederhergestellte Datenbank', r.status === 0, r.status ? (r.stdout + r.stderr).slice(-300) : '');
  r = tsx('scripts/_restore-smoke.ts', [], { ...env, DATABASE_URL: withDb(dstDb), STORAGE_LOCAL_DIR: dstStore });
  step('Stichproben über die Anwendungs-Dienste (Anmeldung, Foto, PDF)', r.status === 0, r.status ? (r.stdout + r.stderr).slice(-300) : r.stdout.trim().replace(/\n/g, ' · '));
  const c = new pg.Client({ connectionString: withDb(dstDb) }); await c.connect();
  let cols = 0, rls = 0, srcRls = -1;
  const sq = new pg.Client({ connectionString: withDb(srcDb) }); await sq.connect();
  srcRls = (await sq.query(`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public' AND rowsecurity`)).rows[0].n; await sq.end();
  try {
  cols = (await c.query(`SELECT count(*)::int AS n FROM users WHERE is_active`)).rows[0].n;
  rls = (await c.query(`SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='public' AND rowsecurity`)).rows[0].n;
  } finally { await c.end().catch(() => {}); }
  step('Konten und Zeilensicherheit (RLS) im Ergebnis vorhanden', cols > 0 && rls === srcRls, `${cols} aktive Konten, RLS auf ${rls} von ${srcRls} Tabellen wie in der Quelle`);
  r = tsx('scripts/restore.ts', [backupDir, '--db', withDb(dstDb), '--storage-dir', path.join(tmp, 'again')]); step('Zweites Zurückspielen in die nun gefüllte Datenbank wird verweigert', r.status === 1 && /nicht leer/.test(r.stderr));
  console.log(`\nMengengerüst: ${Object.values(manifest.tables).reduce((a, b) => a + b, 0)} Zeilen in ${Object.keys(manifest.tables).length} Tabellen, ${manifest.objects.count} Dateien (${(manifest.objects.bytes / 1048576).toFixed(1)} MB), Dump ${(manifest.db.bytes / 1048576).toFixed(2)} MB`);
} catch (e) { step('Unerwarteter Fehler', false, e.message); }
finally {
  for (const d of [srcDb, dstDb]) await admin.query(`DROP DATABASE IF EXISTS ${d} WITH (FORCE)`).catch(() => {});
  await admin.end().catch(() => {});
  rmSync(tmp, { recursive: true, force: true });
  console.log(`Übungsdaten gelöscht. ${results.filter(Boolean).length}/${results.length} bestanden`);
  process.exit(results.every(Boolean) ? 0 : 1);
}
