import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { runHealthChecks } from '@/server/health';
import { ingEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const H = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

const tokenOk = (req: Request) => {
  const want = process.env.HEALTH_TOKEN ?? '';
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (want.length < 16 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
};

/**
 * Betriebsprüfung für Überwachungsdienste. Ohne Token: nur „ok“/„degraded“ (kein Detail, keine Daten).
 * Mit `Authorization: Bearer <HEALTH_TOKEN>`: Datenbank (+ offene Migrationen), Speicher (Schreib-/Lese-/Löschprobe mit Verschlüsselung),
 * Mail-Konfiguration, 2FA-Schlüssel, Umgebung. Keine Geheimnisse, keine personenbezogenen Daten.
 */
export async function GET(req: Request) {
  const { ok, checks } = await runHealthChecks();
  if (!tokenOk(req)) return NextResponse.json({ status: ok ? 'ok' : 'degraded' }, { status: ok ? 200 : 503, headers: H });
  return NextResponse.json({ status: ok ? 'ok' : 'degraded', env: ingEnv(), release: (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7) || null, time: new Date().toISOString(), checks }, { status: ok ? 200 : 503, headers: H });
}
