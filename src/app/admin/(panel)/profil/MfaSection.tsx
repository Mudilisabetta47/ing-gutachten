'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Alert, Notice } from '@/components/admin/ui';
import { confirmMfaAction, disableMfaAction, regenerateRecoveryAction, startMfaAction, type MfaResult } from './actions';

type Status = { enabled: boolean; enabledAt: string | null; pending: boolean; recoveryLeft: number };

/** Zwei-Faktor-Anmeldung (TOTP): einrichten, Wiederherstellungscodes, abschalten. Das Geheimnis wird nur beim Einrichten einmal angezeigt. */
export function MfaSection({ status, available, enforced }: { status: Status; available: boolean; enforced: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'idle' | 'disable' | 'regen'>('idle');
  const [err, setErr] = useState<string | null>(null);

  const run = (fn: () => Promise<MfaResult>, ok: (r: MfaResult) => void) => start(async () => {
    setErr(null);
    const r = await fn();
    if (!r.ok) { setErr(r.error ?? 'Das hat nicht geklappt.'); return; }
    ok(r);
    router.refresh();
  });

  return (
    <section className="adm-card grid max-w-[520px] gap-4" aria-label="Zwei-Faktor-Anmeldung">
      <h2 className="font-display text-[1.1rem] font-semibold">Zwei-Faktor-Anmeldung</h2>
      {!available && <Alert tone="warn" icon="alert">Auf diesem Server ist die Zwei-Faktor-Anmeldung noch nicht eingerichtet (Schlüssel <code>MFA_ENCRYPTION_KEY</code> fehlt).</Alert>}
      {enforced && !status.enabled && <Alert tone="warn" icon="alert">Für Ihre Rolle ist die Zwei-Faktor-Anmeldung verpflichtend. Bis zur Einrichtung ist der übrige Bereich gesperrt.</Alert>}

      {codes ? (
        <div className="grid gap-3">
          <Notice tone="ok">Zwei-Faktor-Anmeldung ist aktiv. Bewahren Sie diese Wiederherstellungscodes sicher auf – sie werden nur jetzt angezeigt. Jeder Code funktioniert einmal.</Notice>
          <ul className="adm-list mono" style={{ columns: 2 }} aria-label="Wiederherstellungscodes">{codes.map((c) => <li key={c} style={{ border: 0, padding: '4px 0' }}>{c}</li>)}</ul>
          <div className="adm-actions">
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => void navigator.clipboard?.writeText(codes.join('\n'))}>Kopieren</button>
            <button type="button" className="adm-btn" onClick={() => setCodes(null)}>Ich habe sie gespeichert</button>
          </div>
        </div>
      ) : status.enabled ? (
        <div className="grid gap-3">
          <p style={{ margin: 0 }}><span className="adm-badge adm-badge-ok">Aktiv</span> seit {status.enabledAt ? new Date(status.enabledAt).toLocaleDateString('de-DE') : '–'} · {status.recoveryLeft} Wiederherstellungscodes übrig</p>
          {mode === 'idle' && (
            <div className="adm-actions">
              <button type="button" className="adm-btn adm-btn-secondary" onClick={() => { setMode('regen'); setCode(''); setErr(null); }}>Neue Wiederherstellungscodes</button>
              {!enforced && <button type="button" className="adm-btn adm-btn-ghost" onClick={() => { setMode('disable'); setCode(''); setPassword(''); setErr(null); }}>Abschalten</button>}
            </div>
          )}
          {mode !== 'idle' && (
            <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); run(() => (mode === 'disable' ? disableMfaAction(password, code) : regenerateRecoveryAction(code)), (r) => { setMode('idle'); if (r.codes) setCodes(r.codes); }); }}>
              {mode === 'disable' && <label className="adm-field"><span className="adm-label">Passwort</span><input className="adm-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>}
              <label className="adm-field"><span className="adm-label">Code aus der App (oder Wiederherstellungscode)</span><input className="adm-input" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} /></label>
              <div className="adm-actions"><button type="submit" className="adm-btn" disabled={pending}>{mode === 'disable' ? 'Abschalten' : 'Neue Codes erzeugen'}</button><button type="button" className="adm-btn adm-btn-ghost" onClick={() => setMode('idle')}>Abbrechen</button></div>
            </form>
          )}
        </div>
      ) : setup || status.pending ? (
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); run(() => confirmMfaAction(code), (r) => { setSetup(null); setCode(''); setCodes(r.codes ?? null); }); }}>
          {setup ? (
            <>
              <p style={{ margin: 0 }}>1. Öffnen Sie eine Authenticator-App (z. B. Google Authenticator, Microsoft Authenticator, 1Password, Aegis) und wählen Sie „Schlüssel manuell eingeben“. Konto: <b>{`ING Gutachten`}</b>, Zeitbasiert.</p>
              <p className="mono" style={{ margin: 0, fontSize: 18, letterSpacing: '.06em', wordBreak: 'break-all' }} aria-label="Geheimer Schlüssel">{setup.secret}</p>
              <p className="vi-hint" style={{ margin: 0 }}>Auf dem Smartphone: <a className="adm-link" href={setup.uri}>Direkt in der App öffnen</a>. Der Schlüssel wird nur jetzt angezeigt.</p>
            </>
          ) : <p style={{ margin: 0 }}>Die Einrichtung wurde begonnen. Starten Sie sie neu, um einen frischen Schlüssel anzuzeigen.</p>}
          <label className="adm-field"><span className="adm-label">2. Aktuellen 6-stelligen Code eingeben</span><input className="adm-input" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="123 456" /></label>
          <div className="adm-actions">
            {setup && <button type="submit" className="adm-btn" disabled={pending}>Bestätigen und aktivieren</button>}
            <button type="button" className="adm-btn adm-btn-ghost" disabled={pending} onClick={() => run(startMfaAction, (r) => setSetup({ secret: r.secret!, uri: r.uri! }))}>{setup ? 'Neuen Schlüssel erzeugen' : 'Neu starten'}</button>
          </div>
        </form>
      ) : (
        <div className="grid gap-3">
          <p style={{ margin: 0 }}>Schützt Ihr Konto zusätzlich zum Passwort mit einem Code aus einer Authenticator-App. Empfohlen für Inhaber und Administratoren.</p>
          <div><button type="button" className="adm-btn" disabled={pending || !available} onClick={() => run(startMfaAction, (r) => { setSetup({ secret: r.secret!, uri: r.uri! }); setCode(''); })}>Einrichten</button></div>
        </div>
      )}
      {err && <Notice tone="error">{err}</Notice>}
    </section>
  );
}
