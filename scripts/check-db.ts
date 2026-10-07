/**
 * Prüft eine Datenbank (nur lesend!) auf sicheren Betrieb – gedacht für Supabase/Produktion:
 *
 *   npm run db:check                       (nutzt DATABASE_URL aus .env)
 *   DATABASE_URL=… npm run db:check        (andere Datenbank)
 *
 * Gibt nichts Geheimes aus (nur Host-Name und Befunde). Exit-Code 1, wenn etwas nicht in Ordnung ist.
 */
import { Client } from 'pg';
import { pgConfig } from '../src/server/db-config';

async function main() {
  const cfg = pgConfig();
  const host = new URL((cfg.connectionString ?? '').replace(/^postgres(ql)?:/, 'http:')).hostname;
  const c = new Client(cfg);
  await c.connect();
  const problems: string[] = [];
  const ok = (m: string) => console.log(`✔ ${m}`);
  const bad = (m: string) => { problems.push(m); console.log(`✖ ${m}`); };
  try {
    const v = (await c.query('select current_setting(\'server_version\') as v, current_database() as db, current_user as u')).rows[0];
    ok(`Verbunden mit ${host} · Datenbank „${v.db}“ · PostgreSQL ${v.v}`);

    const ext = (await c.query("select extname from pg_extension where extname in ('pg_trgm','btree_gist')")).rows.map((r) => r.extname);
    for (const e of ['pg_trgm', 'btree_gist']) (ext.includes(e) ? ok : bad)(ext.includes(e) ? `Erweiterung ${e} aktiv` : `Erweiterung ${e} fehlt (Migrationen nicht vollständig?)`);

    const mig = (await c.query("select count(*) filter (where finished_at is not null)::int as done, count(*) filter (where finished_at is null and rolled_back_at is null)::int as open from _prisma_migrations")).rows[0];
    (mig.open === 0 ? ok : bad)(mig.open === 0 ? `${mig.done} Migrationen angewendet` : `${mig.open} Migration(en) unvollständig – bitte prüfen`);

    const roles = (await c.query("select rolname from pg_roles where rolname in ('anon','authenticated')")).rows.map((r) => r.rolname as string);
    if (roles.length === 0) {
      ok('Keine API-Rollen (anon/authenticated) – kein Supabase-API-Zugriff möglich');
    } else {
      const noRls = (await c.query("select tablename from pg_tables where schemaname='public' and not rowsecurity")).rows.map((r) => r.tablename);
      (noRls.length === 0 ? ok : bad)(noRls.length === 0 ? 'Row Level Security auf allen Tabellen aktiv' : `RLS FEHLT bei: ${noRls.join(', ')}  →  SELECT public.ing_harden_public();`);
      const tables = (await c.query("select tablename from pg_tables where schemaname='public'")).rows.map((r) => r.tablename as string);
      const open: string[] = [];
      for (const role of roles) for (const t of tables) {
        const r = await c.query("select has_table_privilege($1, format('public.%I', $2::text), 'select,insert,update,delete') as p", [role, t]);
        if (r.rows[0].p) open.push(`${role}→${t}`);
      }
      (open.length === 0 ? ok : bad)(open.length === 0 ? `Rollen ${roles.join('/')} haben keinerlei Tabellenrechte` : `API-Rollen haben Zugriff auf: ${open.slice(0, 6).join(', ')}${open.length > 6 ? ' …' : ''}  →  SELECT public.ing_harden_public();`);
    }

    const ssl = (await c.query('select ssl from pg_stat_ssl where pid = pg_backend_pid()')).rows[0]?.ssl;
    if (host === 'localhost' || host === '127.0.0.1') ok('Lokale Verbindung (TLS nicht nötig)');
    else (ssl ? ok : bad)(ssl ? 'Verbindung ist TLS-verschlüsselt' : 'Verbindung ist NICHT verschlüsselt (sslmode=require setzen)');

    const owner = (await c.query("select count(*)::int as n from users where role='OWNER' and deleted_at is null")).rows[0].n;
    (owner > 0 ? ok : console.log)(owner > 0 ? `${owner} Inhaber-Konto(en) vorhanden` : '• Noch kein Inhaber-Konto: npm run create-owner (siehe docs/BETRIEB.md)');
  } finally {
    await c.end();
  }
  if (problems.length) {
    console.log(`\n${problems.length} Befund(e) – bitte beheben.`);
    process.exit(1);
  }
  console.log('\nAlles in Ordnung.');
}

main().catch((e) => {
  console.error('Prüfung fehlgeschlagen:', e instanceof Error ? e.message.replace(/postgres(ql)?:\/\/[^\s]+/g, '[Verbindung]') : e);
  process.exit(1);
});
