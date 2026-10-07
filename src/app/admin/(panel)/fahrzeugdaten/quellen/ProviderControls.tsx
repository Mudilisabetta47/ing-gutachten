'use client';

import { useActionState, useState } from 'react';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { Field } from '@/components/admin/ui';
import { FormError, SubmitRow, useFormFeedback } from '@/components/admin/forms';
import { importTestRecordAction, testConnectionAction, testLookupAction, updateProviderAction, type TestOutcome } from '../actions';
import { LICENSE_LABELS } from '@/lib/vehicle-data';
import type { FormState } from '@/server/admin/form';

type Cfg = { key: string; licenseStatus: string; enabled: boolean; autoLookup: boolean; massImport: boolean; rateLimitPerMin: number; urlTemplate: string; notes: string; paused: boolean };

/** Schalter „Externe Datenquelle“: Freigabe, automatische Abfragen, Massenimport – erst nach ausdrücklicher Lizenz-Freigabe. */
export function ProviderSettings({ cfg }: { cfg: Cfg }) {
  const [state, run, pending] = useActionState<FormState, FormData>(updateProviderAction, {});
  useFormFeedback(state);
  const [license, setLicense] = useState(cfg.licenseStatus);
  const approved = license === 'APPROVED' || license === 'LICENSED';
  const f = state.fields ?? {};
  return (
    <form action={run} className="adm-panel" style={{ display: 'grid', gap: 14 }} noValidate>
      <input type="hidden" name="key" value={cfg.key} />
      <input type="hidden" name="__switches" value="1" />
      <div className="adm-form-grid">
        <Field label="Lizenzstatus" hint="Erst nach rechtlicher Prüfung auf „Freigegeben“ oder „Lizenziert“ setzen.">
          <select name="licenseStatus" value={license} onChange={(e) => setLicense(e.target.value)} className="adm-input">
            {Object.entries(LICENSE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Anfragen pro Minute (max.)" error={f.rateLimitPerMin}><input name="rateLimitPerMin" type="number" min={1} max={120} defaultValue={cfg.rateLimitPerMin} className="adm-input" /></Field>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <label className="adm-check"><input type="checkbox" name="enabled" defaultChecked={cfg.enabled} /> Anbieter aktiv (Verbindungstests und Einzelabrufe)</label>
        <label className="adm-check" style={{ opacity: approved ? 1 : .5 }}><input type="checkbox" name="autoLookup" defaultChecked={cfg.autoLookup && approved} disabled={!approved} /> Automatische Abfragen bei der Fahrzeugidentifikation (nur wenn die eigene Datenbank nichts hat)</label>
        <label className="adm-check" style={{ opacity: approved ? 1 : .5 }}><input type="checkbox" name="massImport" defaultChecked={cfg.massImport && approved} disabled={!approved} /> Massenimport erlauben (gedrosselt, pausierbar)</label>
        {!approved && <p className="vi-hint">Automatische Abfragen und Massenimport sind ausgeschaltet, bis der Lizenzstatus ausdrücklich freigegeben ist.</p>}
      </div>
      <Field label="Abruf-Adresse (URL-Vorlage)" error={f.urlTemplate} hint="https, nur freigegebene Hosts. Platzhalter {hsn} und {tsn}. Die Seitenstruktur des Anbieters wird nicht erraten – ohne Vorlage ist kein Abruf möglich.">
        <input name="urlTemplate" defaultValue={cfg.urlTemplate} className="adm-input mono" placeholder="https://www.hsn-tsn.de/…/{hsn}/{tsn}" autoComplete="off" spellCheck={false} />
      </Field>
      <Field label="Interne Notizen (Lizenz, Prüfung, Ansprechpartner)"><textarea name="notes" defaultValue={cfg.notes} rows={2} className="adm-input" /></Field>
      <FormError state={state} />
      <SubmitRow pending={pending} label="Speichern" secondary={cfg.paused ? <PauseResume keyName={cfg.key} /> : undefined} />
    </form>
  );
}

function PauseResume({ keyName }: { keyName: string }) {
  const [state, run, pending] = useActionState<FormState, FormData>(updateProviderAction, {});
  useFormFeedback(state);
  return <form action={run}><input type="hidden" name="key" value={keyName} /><input type="hidden" name="resume" value="1" /><button type="submit" className="adm-btn adm-btn-secondary" disabled={pending}>Pause aufheben</button></form>;
}

/** Verbindung testen → Testabfrage (speichert nichts) → Testdatensatz importieren (speichert genau diesen einen). */
export function ProviderTester({ providerKey }: { providerKey: string }) {
  const [hsn, setHsn] = useState('0603');
  const [tsn, setTsn] = useState('ADT');
  const [busy, setBusy] = useState<string | null>(null);
  const [out, setOut] = useState<TestOutcome | null>(null);
  const go = async (k: string, fn: () => Promise<TestOutcome>) => { setBusy(k); setOut(null); setOut(await fn()); setBusy(null); };
  const tone = out?.status === 'ok' ? 'ok' : out?.status === 'not_found' || out?.status === 'not_configured' ? 'warn' : 'danger';
  return (
    <div className="adm-panel" style={{ display: 'grid', gap: 12 }}>
      <b style={{ fontSize: 13 }}>Verbindung testen</b>
      <div className="adm-actions">
        <button type="button" className="adm-btn" disabled={busy !== null} onClick={() => go('conn', () => testConnectionAction(providerKey))}>{busy === 'conn' ? 'Prüft …' : 'VERBINDUNG TESTEN'}</button>
      </div>
      <div className="adm-form-grid" style={{ maxWidth: 360 }}>
        <label className="adm-field"><span className="adm-label">HSN</span><input className="adm-input mono" value={hsn} maxLength={4} onChange={(e) => setHsn(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''))} /></label>
        <label className="adm-field"><span className="adm-label">TSN</span><input className="adm-input mono" value={tsn} maxLength={4} onChange={(e) => setTsn(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''))} /></label>
      </div>
      <div className="adm-actions">
        <button type="button" className="adm-btn adm-btn-secondary" disabled={busy !== null} onClick={() => go('look', () => testLookupAction(providerKey, hsn, tsn))}>{busy === 'look' ? 'Fragt ab …' : 'TESTABFRAGE (OHNE SPEICHERN)'}</button>
        <button type="button" className="adm-btn adm-btn-secondary" disabled={busy !== null || out?.status !== 'ok' || !out.records?.length} title="Erst eine erfolgreiche Testabfrage durchführen" onClick={() => go('imp', () => importTestRecordAction(providerKey, hsn, tsn))}>{busy === 'imp' ? 'Importiert …' : 'TESTDATENSATZ IMPORTIEREN'}</button>
      </div>
      {out && (
        <div className={`adm-alert adm-alert-${tone === 'ok' ? '' : tone}`} role="status" style={tone === 'ok' ? { borderColor: 'rgb(var(--a-success) / .4)' } : undefined}>
          <AdminIcon name={out.status === 'ok' ? 'check' : 'alert'} />
          <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
            <b>{out.status === 'ok' ? 'Anbieter erreichbar' : out.status === 'not_found' ? 'Kein Treffer' : out.status === 'not_configured' ? 'Nicht konfiguriert' : 'Nicht erfolgreich'}</b>
            <span>{out.message}</span>
            {(out.durationMs != null || out.httpStatus) && <span className="t-3" style={{ fontSize: 12 }}>Antwortzeit: {out.durationMs != null ? `${out.durationMs} ms` : '–'}{out.httpStatus ? ` · HTTP ${out.httpStatus}` : ''}</span>}
            {out.records?.map((r) => (
              <div key={`${r.hsn}${r.tsn}${r.title}`} className="vi-mini"><span className="mono">{r.hsn}/{r.tsn}</span><b>{r.title}</b><span>{r.power ?? 'Leistung: nicht verfügbar'}</span><span>{r.displacement ?? 'Hubraum: nicht verfügbar'}</span><span>{r.fuel ?? 'Kraftstoff: nicht verfügbar'}</span></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
