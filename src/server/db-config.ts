import type { PoolConfig } from 'pg';

/**
 * Verbindungsoptionen für PostgreSQL – gemeinsam genutzt von der App (`db.ts`) und den Skripten.
 * Kein `server-only`, damit auch `tsx`-Skripte es importieren können. Enthält keine Geheimnisse.
 *
 *  - DATABASE_URL        Pflicht
 *  - DATABASE_CA_CERT    optional: PEM des Zertifikats der Datenbank (z. B. Supabase-CA) → TLS mit vollständiger Prüfung
 *  - DATABASE_POOL_MAX   optional: maximale Verbindungen je Instanz (Serverless: klein halten, Standard 10, Vercel: 3–5)
 */
export function pgConfig(env: NodeJS.ProcessEnv = process.env): PoolConfig {
  const raw = env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL ist nicht gesetzt.');
  const max = Number.parseInt(env.DATABASE_POOL_MAX ?? '', 10);
  const cfg: PoolConfig = { connectionString: raw, connectionTimeoutMillis: 5000, ...(max > 0 ? { max } : {}) };
  const ca = env.DATABASE_CA_CERT?.trim();
  if (ca) {
    // Die Verbindungszeichenfolge würde `ssl` überschreiben – deshalb sslmode daraus entfernen und TLS explizit setzen.
    const u = new URL(raw.replace(/^postgres(ql)?:/, 'http:'));
    u.searchParams.delete('sslmode');
    const scheme = raw.startsWith('postgresql:') ? 'postgresql:' : 'postgres:';
    cfg.connectionString = u.toString().replace(/^http:/, scheme);
    cfg.ssl = { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true };
  }
  return cfg;
}
