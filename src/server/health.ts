import 'server-only';
import { db, isDbConfigured } from '@/server/db';
import { getStorage } from '@/server/storage';
import { getMailConfig } from '@/lib/mail';
import { mfaAvailable } from '@/server/auth/mfa';

export type HealthChecks = Record<string, { ok: boolean; info?: string }>;

/** Alle Betriebsprüfungen (Datenbank, offene Migrationen, Speicher-Probe, Mail, 2FA-Schlüssel). Keine Geheimnisse, keine personenbezogenen Daten. */
export async function runHealthChecks(): Promise<{ ok: boolean; checks: HealthChecks }> {
  const checks: HealthChecks = {};
  try {
    if (!isDbConfigured()) checks.database = { ok: false, info: 'nicht konfiguriert' };
    else {
      const t0 = Date.now();
      await db.$queryRaw`SELECT 1`;
      const open = await db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL`;
      checks.database = { ok: true, info: `${Date.now() - t0} ms` };
      checks.migrations = { ok: (open[0]?.n ?? 0) === 0, info: `${open[0]?.n ?? 0} offen` };
    }
  } catch { checks.database = { ok: false, info: 'nicht erreichbar' }; }
  try {
    const st = getStorage();
    if (!st) checks.storage = { ok: false, info: 'nicht eingerichtet' };
    else {
      const key = `h/${new Date().getUTCFullYear()}/00/health${Date.now().toString(36)}`;
      const probe = new Uint8Array([104, 101, 97, 108, 116, 104]);
      await st.put(key, probe, 'application/octet-stream');
      const back = await st.get(key);
      await st.delete(key);
      checks.storage = { ok: Boolean(back) && Buffer.from(back!).equals(Buffer.from(probe)), info: st.id };
    }
  } catch { checks.storage = { ok: false, info: 'Fehler beim Schreiben/Lesen' }; }
  let mail = false; try { mail = Boolean(getMailConfig()); } catch { mail = false; }
  checks.mail = { ok: mail, info: mail ? 'konfiguriert' : 'nicht konfiguriert' };
  checks.mfaKey = { ok: mfaAvailable() };

  const ok = Object.values(checks).every((c) => c.ok);
  return { ok, checks };
}
