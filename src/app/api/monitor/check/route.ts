import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { db, isDbConfigured } from '@/server/db';
import { runHealthChecks } from '@/server/health';
import { decideMonitor, monitorMailText, type MonitorState } from '@/lib/monitor';
import { alertMailer, alertRecipients } from '@/lib/mail/alert';
import { ingEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const H = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
const KEY = 'monitor.state';
let memory: MonitorState | null = null; // Rückfall, wenn die Datenbank selbst ausfällt

const secretOk = (req: Request) => {
  const want = process.env.MONITOR_SECRET ?? '';
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (want.length < 16 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
};

async function loadState(): Promise<MonitorState | null> {
  try {
    if (!isDbConfigured()) return memory;
    const row = await db.systemSetting.findUnique({ where: { key: KEY } });
    const v = row?.value as Partial<MonitorState> | undefined;
    return v && (v.status === 'ok' || v.status === 'degraded') && typeof v.since === 'string' ? { status: v.status, since: v.since, lastMailAt: v.lastMailAt ?? null, failing: Array.isArray(v.failing) ? v.failing.map(String) : [] } : null;
  } catch { return memory; }
}
async function saveState(s: MonitorState) {
  memory = s;
  try { if (isDbConfigured()) await db.systemSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: s }, update: { value: s } }); } catch { /* DB gestört – Zustand bleibt im Speicher */ }
}

/**
 * Verfügbarkeitsüberwachung für einen externen Aufrufer (Uptime-/Cron-Dienst, mit Bypass-Header bei geschütztem Staging):
 *   GET /api/monitor/check  mit  Authorization: Bearer <MONITOR_SECRET>
 * Führt alle Betriebsprüfungen aus und schickt bei einem Statuswechsel eine E-Mail an ALERT_EMAIL_TO (Störung, Erinnerung nach 6 h, Entwarnung).
 * Antwort 200 = in Ordnung, 503 = gestört (damit auch der aufrufende Dienst selbst meldet). Ohne gültiges Geheimnis: 401, keine Details.
 */
export async function GET(req: Request) {
  if (!secretOk(req)) return NextResponse.json({ error: 'auth' }, { status: 401, headers: H });
  const { ok, checks } = await runHealthChecks();
  const failing = Object.entries(checks).filter(([, c]) => !c.ok).map(([k]) => k).sort();
  const prev = await loadState();
  const { action, state } = decideMonitor(prev, ok, failing, new Date());
  let mailed = false;
  if (action !== 'none' && alertRecipients().length) {
    const m = monitorMailText(action, ingEnv(), failing, action === 'recovered' ? (prev?.since ?? state.since) : state.since);
    mailed = await alertMailer()(m.subject, m.text);
    if (!mailed) state.lastMailAt = prev?.lastMailAt ?? null; // nicht als versendet verbuchen → nächster Lauf versucht es erneut
  }
  await saveState(state);
  return NextResponse.json({ status: ok ? 'ok' : 'degraded', failing, action, mailed, recipients: alertRecipients().length }, { status: ok ? 200 : 503, headers: H });
}
