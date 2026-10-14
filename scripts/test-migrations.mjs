/**
 * Datenbankmigrationen in einer ISOLIERTEN, wegwerfbaren Datenbank prüfen – nie gegen echte Daten:
 *   npm run db:migtest
 *  1. alle Migrationen auf eine leere Datenbank anwenden
 *  2. Status „aktuell“, nochmaliges Anwenden ändert nichts
 *  3. kein Abweichen zwischen Migrationen und schema.prisma (Drift)
 *  4. Betriebsprüfung (db:check) besteht
 *  5. Aktualisierungspfad: Datenbank im Stand „vor den letzten N Migrationen“ mit Beispieldaten füllen, Rest anwenden, Daten bleiben erhalten
 * Es wird eine Datenbank „ing_migtest_<Zeit>“ auf demselben (lokalen!) Server angelegt und danach gelöscht.
 * Für einen anderen Server: MIGTEST_ADMIN_URL=postgresql://…/postgres (Wartungsdatenbank) – dort nur Wegwerf-/Staging-Instanzen.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const adminUrl = process.env.MIGTEST_ADMIN_URL ?? (process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/\/[^/?]+(\?.*)?$/, '/postgres') : '');
if (!adminUrl) { console.error('DATABASE_URL (lokal) oder MIGTEST_ADMIN_URL fehlt. Beispiel: node --env-file=.env scripts/test-migrations.mjs'); process.exit(2); }
const host = new URL(adminUrl.replace(/^postgres(ql)?:/, 'http:')).hostname;
if (!['localhost', '127.0.0.1', '::1'].includes(host) && !process.env.MIGTEST_ADMIN_URL) { console.error('Nur gegen lokale Datenbankserver (oder ausdrücklich MIGTEST_ADMIN_URL).'); process.exit(2); }
const withDb = (name) => adminUrl.replace(/\/postgres(\?.*)?$/, `/${name}$1`);

const stamp = Date.now();
const dbs = [`ing_migtest_${stamp}`, `ing_migtest_${stamp}_up`];
const results = [];
const step = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? '✔' : '✖'} ${name}${extra ? ' — ' + extra : ''}`); };
const run = (args, env, cwd = root) => spawnSync('npx', args, { cwd, env: { ...process.env, ...env }, encoding: 'utf8' });
const admin = new pg.Client({ connectionString: adminUrl });

async function main() {
  await admin.connect();
  for (const d of dbs) { if (!/^ing_migtest_\d+(_up)?$/.test(d)) throw new Error('Unerlaubter Datenbankname'); await admin.query(`CREATE DATABASE ${d}`); }
  const all = readdirSync(path.join(root, 'prisma', 'migrations')).filter((d) => /^\d{14}_/.test(d)).sort();

  /* 1–4: leere Datenbank */
  const url = withDb(dbs[0]);
  const t0 = Date.now();
  let r = run(['prisma', 'migrate', 'deploy'], { DATABASE_URL: url });
  step(`${all.length} Migrationen auf leere Datenbank angewendet`, r.status === 0, `${((Date.now() - t0) / 1000).toFixed(1)} s${r.status ? '\n' + (r.stderr || r.stdout).slice(-600) : ''}`);
  r = run(['prisma', 'migrate', 'status'], { DATABASE_URL: url });
  step('Migrationsstatus: Datenbank ist aktuell', r.status === 0 && /up to date/i.test(r.stdout + r.stderr));
  r = run(['prisma', 'migrate', 'deploy'], { DATABASE_URL: url });
  step('Erneutes Anwenden ändert nichts (idempotent)', r.status === 0 && /No pending migrations/i.test(r.stdout + r.stderr));
  r = run(['prisma', 'migrate', 'diff', '--from-config-datasource', '--to-schema', 'prisma/schema.prisma', '--exit-code'], { DATABASE_URL: url });
  step('Kein Drift zwischen Migrationen und schema.prisma', r.status === 0, r.status ? (r.stdout || r.stderr).slice(0, 500) : '');
  r = run(['tsx', 'scripts/check-db.ts'], { DATABASE_URL: url });
  step('Betriebsprüfung (db:check) besteht auf der frisch migrierten Datenbank', r.status === 0, r.status ? (r.stdout + r.stderr).slice(-500) : '');

  /* 5: Aktualisierungspfad mit Daten */
  const keepLast = Number(process.env.MIGTEST_UPGRADE_LAST ?? 4);
  const old = all.slice(0, all.length - keepLast);
  const tmp = path.join(root, '.migtest');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(path.join(tmp, 'migrations'), { recursive: true });
  for (const d of old) cpSync(path.join(root, 'prisma', 'migrations', d), path.join(tmp, 'migrations', d), { recursive: true });
  cpSync(path.join(root, 'prisma', 'migrations', 'migration_lock.toml'), path.join(tmp, 'migrations', 'migration_lock.toml'));
  writeFileSync(path.join(tmp, 'prisma.config.ts'), `import { defineConfig } from 'prisma/config';\nexport default defineConfig({ schema: ${JSON.stringify(path.join(root, 'prisma', 'schema.prisma'))}, migrations: { path: ${JSON.stringify(path.join(tmp, 'migrations'))} }, datasource: { url: process.env.DATABASE_URL ?? '' } });\n`);
  const upUrl = withDb(dbs[1]);
  r = run(['prisma', 'migrate', 'deploy', '--config', path.join(tmp, 'prisma.config.ts')], { DATABASE_URL: upUrl });
  step(`Alter Stand hergestellt (${old.length} von ${all.length} Migrationen)`, r.status === 0, r.status ? (r.stderr || r.stdout).slice(-400) : '');
  const c = new pg.Client({ connectionString: upUrl });
  await c.connect();
  try {
    await c.query(`INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, failed_logins, must_change_password, created_at, updated_at) VALUES ('u_mig1','alt@example.test','$argon2id$platzhalter','Alt','Konto','OFFICE',true,0,false,now(),now())`);
    await c.query(`INSERT INTO customers (id, type, first_name, last_name, country, created_at, updated_at) VALUES ('c_mig1','PRIVATE','Erika','Alt','DE',now(),now())`);
    await c.query(`INSERT INTO notes (id, kind, body, author_id, customer_id, created_at) VALUES ('n_mig1','NOTE','Notiz aus dem alten Stand','u_mig1','c_mig1',now())`);
    step('Beispieldaten im alten Stand angelegt (Benutzer, Kunde, Notiz)', true);
  } catch (e) { step('Beispieldaten im alten Stand angelegt', false, String(e.message).slice(0, 300)); }
  r = run(['prisma', 'migrate', 'deploy'], { DATABASE_URL: upUrl });
  step(`Restliche ${keepLast} Migrationen auf die befüllte Datenbank angewendet`, r.status === 0, r.status ? (r.stderr || r.stdout).slice(-400) : '');
  try {
    const u = (await c.query(`SELECT email, mfa_enabled_at, mfa_secret FROM users WHERE id='u_mig1'`)).rows[0];
    const n = (await c.query(`SELECT body, pinned, external, mention_ids FROM notes WHERE id='n_mig1'`)).rows[0];
    step('Vorhandene Daten blieben erhalten, neue Spalten haben sichere Standardwerte', u?.email === 'alt@example.test' && u.mfa_enabled_at === null && n?.body === 'Notiz aus dem alten Stand' && n.pinned === false && n.external === false && Array.isArray(n.mention_ids) && n.mention_ids.length === 0);
  } catch (e) { step('Vorhandene Daten blieben erhalten', false, String(e.message).slice(0, 300)); }
  await c.end();
  r = run(['tsx', 'scripts/check-db.ts'], { DATABASE_URL: upUrl });
  step('Betriebsprüfung besteht auch nach dem Aktualisieren', r.status === 0, r.status ? (r.stdout + r.stderr).slice(-400) : '');
  rmSync(tmp, { recursive: true, force: true });
}

main()
  .catch((e) => { step('Unerwarteter Fehler', false, e.message); })
  .finally(async () => {
    for (const d of dbs) await admin.query(`DROP DATABASE IF EXISTS ${d} WITH (FORCE)`).catch(() => undefined);
    await admin.end().catch(() => undefined);
    console.log(`\nWegwerf-Datenbanken gelöscht. ${results.filter(Boolean).length}/${results.length} bestanden`);
    process.exit(results.every(Boolean) ? 0 : 1);
  });
