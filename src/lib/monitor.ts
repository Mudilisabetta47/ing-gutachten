/**
 * Entscheidungslogik der Verfügbarkeitsüberwachung (rein, ohne Datenbank/Mail – gut testbar).
 * Ziel: Eine E-Mail beim Wechsel zu „gestört“, eine Erinnerung nach `remindAfterMs`, eine Entwarnung bei Erholung – kein Dauerfeuer.
 */
export type MonitorState = { status: 'ok' | 'degraded'; since: string; lastMailAt: string | null; failing: string[] };
export type MonitorAction = 'none' | 'alert' | 'reminder' | 'recovered';

export const REMIND_AFTER_MS = 6 * 3600_000;

export function decideMonitor(prev: MonitorState | null, ok: boolean, failing: string[], now: Date, remindAfterMs = REMIND_AFTER_MS): { action: MonitorAction; state: MonitorState } {
  const at = now.toISOString();
  if (ok) {
    if (prev && prev.status === 'degraded') return { action: 'recovered', state: { status: 'ok', since: at, lastMailAt: at, failing: [] } };
    return { action: 'none', state: { status: 'ok', since: prev?.status === 'ok' ? prev.since : at, lastMailAt: prev?.lastMailAt ?? null, failing: [] } };
  }
  if (!prev || prev.status === 'ok') return { action: 'alert', state: { status: 'degraded', since: at, lastMailAt: at, failing } };
  const last = prev.lastMailAt ? Date.parse(prev.lastMailAt) : 0;
  const changed = failing.join(',') !== prev.failing.join(',');
  if (changed || now.getTime() - last >= remindAfterMs) return { action: changed ? 'alert' : 'reminder', state: { ...prev, lastMailAt: at, failing } };
  return { action: 'none', state: { ...prev, failing } };
}

export function monitorMailText(action: MonitorAction, env: string, failing: string[], since: string): { subject: string; text: string } {
  const where = `ING Studio (${env})`;
  if (action === 'recovered') return { subject: `✅ ${where}: wieder in Ordnung`, text: `Alle Prüfungen sind wieder in Ordnung.\nStörung seit: ${since}` };
  const what = failing.length ? failing.join(', ') : 'unbekannt';
  return {
    subject: `${action === 'reminder' ? '🔴 (Erinnerung)' : '🔴'} ${where}: gestört – ${what}`,
    text: `Betroffene Prüfungen: ${what}\nStörung seit: ${since}\nDetails: /api/health mit HEALTH_TOKEN (Authorization: Bearer …).\nDiese Meldung enthält keine Kunden- oder Zugangsdaten.`,
  };
}
