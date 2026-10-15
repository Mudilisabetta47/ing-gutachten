'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Alert, Notice } from '@/components/admin/ui';
import { createCalendarFeedAction, revokeCalendarFeedAction } from './actions';

type Status = { exists: boolean; showDetails: boolean; createdAt: string | null; lastUsedAt: string | null };
const fmt = (iso: string | null) => (iso ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(new Date(iso)) : '–');

/** Kalender-Synchronisierung: privater Abo-Link (ICS) für Google, Apple oder Outlook. Der Link wird nur direkt nach dem Erzeugen angezeigt. */
export function CalendarSyncSection({ status, available }: { status: Status; available: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [details, setDetails] = useState(status.showDetails);
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const create = () => start(async () => {
    setErr(null); setCopied(false);
    const r = await createCalendarFeedAction(details);
    if (!r.ok || !r.url) { setErr(r.error ?? 'Das hat nicht geklappt.'); return; }
    setUrl(r.url); router.refresh();
  });
  const revoke = () => start(async () => {
    setErr(null);
    const r = await revokeCalendarFeedAction();
    if (!r.ok) { setErr(r.error ?? 'Das hat nicht geklappt.'); return; }
    setUrl(null); router.refresh();
  });

  return (
    <section id="kalender" className="adm-card grid max-w-[520px] gap-4" aria-label="Kalender-Synchronisierung">
      <h2 className="font-display text-[1.1rem] font-semibold">Kalender-Synchronisierung</h2>
      {!available ? <Alert tone="warn" icon="alert">Für Ihre Rolle sind keine Termine freigegeben.</Alert> : (
        <>
          <p style={{ margin: 0 }}>Zeigen Sie Ihre ING-Termine im eigenen Kalender (Google, Apple, Outlook). Die Synchronisierung läuft in <strong>eine Richtung</strong>: ING → Ihr Kalender. Änderungen im fremden Kalender kommen nicht zurück.</p>
          <label className="adm-check" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={details} onChange={(e) => setDetails(e.target.checked)} />
            <span>Kundennamen, Einsatzort und Fahrzeug im Kalendereintrag anzeigen<br /><small>Aus (Standard): nur „Besichtigung (Fallnummer)“. Kalenderdienste speichern den Abo-Inhalt bei einem Drittanbieter – nur einschalten, wenn das für Sie vertretbar ist.</small></span>
          </label>
          {url ? (
            <div className="grid gap-3">
              <Notice tone="ok">Ihr privater Link – er wird nur jetzt angezeigt. Wer ihn kennt, sieht Ihre Termine; bei Verdacht widerrufen Sie ihn hier.</Notice>
              <input readOnly className="adm-input mono" value={url} aria-label="Abo-Link" onFocus={(e) => e.currentTarget.select()} />
              <div className="adm-actions">
                <button type="button" className="adm-btn" onClick={() => { void navigator.clipboard?.writeText(url).then(() => setCopied(true)); }}>{copied ? 'Kopiert ✓' : 'Link kopieren'}</button>
                <a className="adm-btn adm-btn-secondary" href={url.replace(/^https?:/, 'webcal:')}>In Apple Kalender / Outlook öffnen</a>
              </div>
              <ol style={{ margin: 0, paddingLeft: 18 }}>
                <li><strong>Google Kalender:</strong> Weitere Kalender (+) → „Per URL“ → Link einfügen. Aktualisierung kann mehrere Stunden dauern (bestimmt Google).</li>
                <li><strong>Apple (iPhone):</strong> Link antippen bzw. „In Apple Kalender öffnen“ → „Abonnieren“.</li>
                <li><strong>Outlook:</strong> Kalender hinzufügen → „Aus dem Internet abonnieren“ → Link einfügen.</li>
              </ol>
            </div>
          ) : status.exists ? (
            <p style={{ margin: 0 }}><span className="adm-badge adm-badge-ok">Aktiv</span> seit {fmt(status.createdAt)} · zuletzt abgerufen {fmt(status.lastUsedAt)}. Der Link wird aus Sicherheitsgründen nicht erneut angezeigt – bei Bedarf einen neuen erzeugen (der alte wird ungültig).</p>
          ) : <p style={{ margin: 0 }}><span className="adm-badge">Nicht aktiv</span></p>}
          {err && <Alert tone="danger" icon="alert">{err}</Alert>}
          <div className="adm-actions">
            <button type="button" className="adm-btn" disabled={pending} onClick={create}>{status.exists || url ? 'Neuen Link erzeugen' : 'Abo-Link erzeugen'}</button>
            {(status.exists || url) && <button type="button" className="adm-btn adm-btn-secondary" disabled={pending} onClick={revoke}>Widerrufen</button>}
          </div>
        </>
      )}
    </section>
  );
}
