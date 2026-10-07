'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AdminIcon } from './AdminIcon';
import { useToast } from './Toast';
import { applyRecordAction, createManualRecordAction, type DataActionResult } from '@/app/admin/(panel)/fahrzeuge/actions';
import type { RecordDto } from '@/server/vehicledata/catalog';
import type { IdentifyResult, VinResult } from '@/server/vehicledata/identify';
import {
  approvalStatus, compareRegistration, COMPARE_LABELS, FUEL_LABELS, fmtCc, fmtPower, normalizeFuel, normalizeHsn, normalizeTsn, parseHsnTsn, sourceLabel, validateVin,
  VERIFICATION_LABELS, type ApprovalKey, type FuelKey,
} from '@/lib/vehicle-data';

type Mode = 'hsn' | 'vin' | 'schein' | 'manuell';
type Target = { id: string; label: string } | null;

const NA = <span className="na">Nicht verfügbar</span>;
const BADGE: Record<string, string> = { VERIFIED: 'ok', PARTIAL: 'info', UNVERIFIED: 'muted', OUTDATED: 'warn', CONFLICT: 'danger' };

export const StatusBadge = ({ status }: { status: string }) => <span className={`adm-badge adm-badge-${BADGE[status] ?? 'muted'}`}>{VERIFICATION_LABELS[status as keyof typeof VERIFICATION_LABELS] ?? status}</span>;

/** Felder eines Datensatzes als Formularwerte (für die Übernahme in Fahrzeugformulare). */
export function recordToVehicleValues(r: RecordDto): Record<string, string> {
  return {
    manufacturer: r.manufacturer ?? '', model: r.model ?? '', variant: r.variant ?? '', fuelType: r.fuelType ?? '',
    hsn: r.hsn, tsn: r.tsn, hsnTsnId: r.id,
    powerKw: r.powerKw?.toString() ?? '', powerHp: r.powerHp?.toString() ?? '', displacementCc: r.displacementCc?.toString() ?? '',
    engineName: r.engineName ?? '', bodyStyle: r.bodyStyle ?? '', driveType: r.driveType ?? '', transmission: r.transmission ?? '', vehicleClass: r.vehicleClass ?? '',
  };
}

async function api<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/admin/fahrzeugdaten/identify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), credentials: 'same-origin' });
  if (!res.ok) throw new Error(res.status === 403 ? 'forbidden' : res.status === 401 ? 'auth' : 'server');
  return res.json() as Promise<T>;
}

const Fact = ({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) => (
  <div className="vi-fact"><dt>{label}</dt><dd className={mono ? 'mono' : undefined}>{children ?? NA}</dd></div>
);

/* ------------------------------------------------------------ Ergebniskarte */

function RecordCard({ r, alsoIn, external, cached, actions, flag = 'FAHRZEUG GEFUNDEN' }: { r: RecordDto; alsoIn?: string[]; external?: IdentifyResult['external']; cached?: boolean; actions: ReactNode; flag?: string }) {
  const [more, setMore] = useState(false);
  const period = r.productionFrom || r.productionTo ? `${r.productionFrom?.slice(0, 7) ?? '…'} – ${r.productionTo?.slice(0, 7) ?? 'heute'}` : null;
  return (
    <section className="vi-result" aria-label="Fahrzeug gefunden">
      <header className="vi-result-head">
        <span className={`vi-flag ${r.openConflicts?.length ? 'vi-flag-warn' : 'vi-flag-ok'}`}>{flag}</span>
        <StatusBadge status={r.verificationStatus} />
        {r.stale && <span className="adm-badge adm-badge-warn">Länger nicht geprüft</span>}
        {cached && <span className="t-3" style={{ fontSize: 12, marginLeft: 'auto' }}>aus der eigenen Datenbank</span>}
      </header>
      <div className="vi-make">
        <div className="mk">{r.manufacturer ?? r.vehicleNameRaw?.split(' ')[0] ?? 'Hersteller unbekannt'}</div>
        <div className="md">{r.model ? `${r.model}${r.generation ? ` ${r.generation}` : ''}${r.bodyStyle ? ` ${r.bodyStyle}` : ''}` : r.vehicleNameRaw ?? 'Modell nicht verfügbar'}</div>
        {(r.engineName || r.variant) && <div className="en">{[r.engineName, r.variant].filter(Boolean).join(' · ')}</div>}
      </div>
      <dl className="vi-facts">
        <Fact label="HSN" mono>{r.hsn}</Fact>
        <Fact label="TSN" mono>{r.tsn}</Fact>
        <Fact label="Leistung">{fmtPower(r.powerKw, r.powerHp)}</Fact>
        <Fact label="Hubraum">{fmtCc(r.displacementCc)}</Fact>
        <Fact label="Kraftstoff">{r.fuelType ? FUEL_LABELS[r.fuelType as FuelKey] : null}</Fact>
        <Fact label="Datenquelle">{sourceLabel(r.source)}{alsoIn?.length ? <span className="t-3" style={{ fontWeight: 400 }}> · auch {[...new Set(alsoIn)].map(sourceLabel).join(', ')}</span> : null}</Fact>
      </dl>
      {r.openConflicts?.map((c) => (
        <div key={c.id} className="adm-alert adm-alert-warn vi-warn" role="alert">
          <AdminIcon name="alert" />
          <div>
            <h4>Warnung</h4>
            <div>{c.fields.map((f) => COMPARE_LABELS[f]).join(', ')} unterscheidet sich zwischen zwei Datenquellen. Bitte Fahrzeugdaten überprüfen.</div>
            <div className="vi-cmp">
              {c.fields.map((f) => (
                <span key={f} style={{ display: 'contents' }}>
                  <b>{COMPARE_LABELS[f]}</b>
                  <span>Quelle A ({sourceLabel(r.source)}): {c.own[f] ?? 'Nicht verfügbar'}</span>
                  <span>Quelle B ({sourceLabel(c.incomingSource)}): {c.incoming[f] ?? 'Nicht verfügbar'}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
      {external && external.state !== 'not_asked' && external.state !== 'ok' && (
        <div className="vi-ext" style={{ paddingTop: 12 }}>
          <span className={`vi-dot ${external.state === 'unavailable' || external.state === 'paused' ? 'vi-dot-warn' : ''}`} />
          {external.state === 'unavailable' ? 'Externe Fahrzeugdaten derzeit nicht erreichbar – Ergebnis aus der eigenen Datenbank.' : external.state === 'paused' ? 'Externer Anbieter pausiert – Ergebnis aus der eigenen Datenbank.' : null}
        </div>
      )}
      {more && (
        <dl className="vi-facts" style={{ marginTop: 0 }}>
          <Fact label="Generation">{r.generation}</Fact>
          <Fact label="Variante">{r.variant}</Fact>
          <Fact label="Karosserie">{r.bodyStyle}</Fact>
          <Fact label="Motor">{r.engineName}</Fact>
          <Fact label="Motorkennbuchstabe">{r.engineCode}</Fact>
          <Fact label="Antrieb">{r.driveType}</Fact>
          <Fact label="Getriebe">{r.transmission}</Fact>
          <Fact label="Drehmoment">{r.torqueNm ? `${r.torqueNm} Nm` : null}</Fact>
          <Fact label="Bauzeitraum">{period}</Fact>
          <Fact label="Fahrzeugklasse">{r.vehicleClass}</Fact>
          <Fact label="Typgenehmigung">{r.typeApproval}</Fact>
          <Fact label="Zuletzt geprüft">{r.lastCheckedAt ? new Date(r.lastCheckedAt).toLocaleDateString('de-DE') : null}</Fact>
          <Fact label="Bezeichnung (Original)">{r.vehicleNameRaw}</Fact>
          <Fact label="Quelle">{r.sourceUrl ? <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="adm-link" style={{ wordBreak: 'break-all' }}>{r.sourceUrl}</a> : null}</Fact>
        </dl>
      )}
      <div className="vi-actions">
        {actions}
        <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setMore((m) => !m)} aria-expanded={more}>{more ? 'WENIGER' : 'DETAILS'}</button>
      </div>
    </section>
  );
}

function Variants({ records, onPick, onVin }: { records: RecordDto[]; onPick: (r: RecordDto) => void; onVin: () => void }) {
  return (
    <section className="vi-result" aria-label="Mehrere Fahrzeuge gefunden">
      <header className="vi-result-head"><span className="vi-flag vi-flag-warn">MEHRERE FAHRZEUGE GEFUNDEN</span><span className="t-2" style={{ fontSize: 13 }}>Bitte passende Variante auswählen.</span></header>
      <div className="vi-table-wrap">
        <table className="vi-table">
          <thead><tr><th>Modell</th><th>Motor</th><th>Leistung</th><th>Hubraum</th><th>Kraftstoff</th><th>Baujahr / Bauzeitraum</th><th>Karosserie</th><th>Antrieb</th><th>Getriebe</th><th /></tr></thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td><b>{r.manufacturer}</b> {r.model ?? r.vehicleNameRaw}{r.variant ? ` ${r.variant}` : ''}<div className="mono t-3" style={{ fontSize: 11.5 }}>{r.hsn}/{r.tsn}</div></td>
                <td>{r.engineName ?? NA}</td>
                <td className="nowrap">{fmtPower(r.powerKw, r.powerHp) ?? NA}</td>
                <td className="nowrap">{fmtCc(r.displacementCc) ?? NA}</td>
                <td>{r.fuelType ? FUEL_LABELS[r.fuelType as FuelKey] : NA}</td>
                <td className="nowrap">{r.productionFrom || r.productionTo ? `${r.productionFrom?.slice(0, 4) ?? '…'}–${r.productionTo?.slice(0, 4) ?? 'heute'}` : NA}</td>
                <td>{r.bodyStyle ?? NA}</td><td>{r.driveType ?? NA}</td><td>{r.transmission ?? NA}</td>
                <td><button type="button" className="adm-btn" onClick={() => onPick(r)}>AUSWÄHLEN</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="vi-actions" style={{ borderTop: '1px solid rgb(var(--a-border) / var(--a-b-subtle))' }}>
        <span className="t-2" style={{ fontSize: 13, alignSelf: 'center' }}>Für eine genauere Identifikation FIN eingeben.</span>
        <button type="button" className="adm-btn adm-btn-secondary" onClick={onVin}>FIN VERWENDEN</button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Ziel wählen (Seitenmodus ohne festes Fahrzeug) */

type Hit = { id: string; label: string; sub: string };
function TargetPicker({ rec, onDone }: { rec: RecordDto; onDone: (r: DataActionResult) => void }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<{ vehicles: Hit[]; customers: Hit[] }>({ vehicles: [], customers: [] });
  useEffect(() => {
    if (q.trim().length < 2) { setHits({ vehicles: [], customers: [] }); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q.trim())}`, { credentials: 'same-origin' });
        if (res.ok) { const d = await res.json(); setHits({ vehicles: d.vehicles ?? [], customers: d.customers ?? [] }); }
      } catch { /* Suche bleibt leer */ }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="vi-picker">
      <b style={{ fontSize: 13 }}>Für welches Fahrzeug oder welchen Kunden?</b>
      <input className="adm-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kennzeichen, FIN oder Kundenname" aria-label="Fahrzeug oder Kunde suchen" autoFocus />
      {hits.vehicles.length > 0 && (
        <div><div className="t-3" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', margin: '4px 0' }}>Bestehendes Fahrzeug aktualisieren</div>
          <ul>{hits.vehicles.map((v) => <li key={v.id}><button type="button" onClick={async () => onDone(await applyRecordAction(v.id, rec.id))}><span>{v.label}</span><span className="t-3">{v.sub}</span></button></li>)}</ul></div>
      )}
      {hits.customers.length > 0 && (
        <div><div className="t-3" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', margin: '4px 0' }}>Neues Fahrzeug bei Kunde anlegen</div>
          <ul>{hits.customers.map((c) => <li key={c.id}><Link href={`/admin/kunden/${c.id}/fahrzeug-neu/?datensatz=${rec.id}`} className="adm-btn adm-btn-ghost" style={{ justifyContent: 'space-between', width: '100%' }}><span>{c.label}</span><span className="t-3">{c.sub}</span></Link></li>)}</ul></div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ Hauptkomponente */

export type VehicleIdentifyProps = {
  variant?: 'page' | 'embedded';
  /** Seitenmodus mit festem Fahrzeug: „Übernehmen“ schreibt direkt dorthin */
  target?: Target;
  /** eingebettet: Rückgabe an das umgebende Formular */
  onApply?: (r: RecordDto) => void;
  canWriteData?: boolean;
  initial?: { hsn?: string; tsn?: string };
};

export function VehicleIdentify({ variant = 'page', target = null, onApply, canWriteData = true, initial }: VehicleIdentifyProps) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('hsn');
  const [hsn, setHsn] = useState(initial?.hsn ?? '');
  const [tsn, setTsn] = useState(initial?.tsn ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [vin, setVin] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<IdentifyResult | null>(null);
  const [vinRes, setVinRes] = useState<VinResult | null>(null);
  const [picked, setPicked] = useState<RecordDto | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [applied, setApplied] = useState<{ message: string; detail?: string[] } | null>(null);
  const [catalog, setCatalog] = useState<{ q: string; rows: RecordDto[]; total: number } | null>(null);
  const [qCat, setQCat] = useState('');
  const hsnRef = useRef<HTMLInputElement>(null);
  const tsnRef = useRef<HTMLInputElement>(null);
  const compact = variant === 'embedded';

  const hsnCheck = hsn ? normalizeHsn(hsn) : null;
  const tsnCheck = tsn ? normalizeTsn(tsn) : null;
  const hsnBad = hsn.length > 0 && (hsnCheck?.error ? (hsn.length >= 4 || /[^0-9A-Z]/.test(hsn) || submitted) : false);
  const tsnBad = tsn.length > 0 && (tsnCheck?.error ? (tsn.length >= 3 || /[^0-9A-Z]/.test(tsn) || submitted) : false);

  const reset = () => { setRes(null); setPicked(null); setApplied(null); setErr(null); setChoosing(false); };

  const run = useCallback(async (h: string, t: string) => {
    setSubmitted(true); setErr(null); setApplied(null);
    const hh = normalizeHsn(h), tt = normalizeTsn(t);
    if (!hh.value || !tt.value) { setRes(null); setPicked(null); return; }
    setLoading(true);
    try {
      const out = await api<IdentifyResult>({ mode: 'hsn', hsn: h, tsn: t });
      setRes(out);
      setPicked(out.status === 'found' ? out.records[0] : null);
      setVinRes(null);
    } catch (e) {
      setRes(null);
      setErr((e as Error).message === 'forbidden' ? 'Dafür fehlt die Berechtigung.' : (e as Error).message === 'auth' ? 'Bitte erneut anmelden.' : 'Die Suche ist gerade nicht möglich. Bitte erneut versuchen.');
    } finally { setLoading(false); }
  }, []);

  // Direktaufruf mit ?hsn&tsn: einmal beim Öffnen suchen
  useEffect(() => { if (initial?.hsn && initial?.tsn) void run(initial.hsn, initial.tsn); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onHsn = (v: string) => {
    const pair = parseHsnTsn(v);
    if (pair && /[\s/\-]/.test(v)) { setHsn(pair.hsn); setTsn(pair.tsn); tsnRef.current?.focus(); return; }
    // Eingaben werden nicht stillschweigend verändert: Leerzeichen raus, Großbuchstaben – ungültige Zeichen bleiben sichtbar und werden markiert
    const c = v.toUpperCase().replace(/\s+/g, '').slice(0, 8);
    setHsn(c);
    if (c.length === 4 && /^[0-9A-Z]{4}$/.test(c)) tsnRef.current?.focus();
  };
  const onTsn = (v: string) => setTsn(v.toUpperCase().replace(/\s+/g, '').slice(0, 8));

  const apply = async (rec: RecordDto) => {
    if (onApply) { onApply(rec); setApplied({ message: `${rec.manufacturer ?? ''} ${rec.model ?? ''} übernommen – bitte die Angaben unten prüfen.` }); return; }
    if (target) {
      const out = await applyRecordAction(target.id, rec.id);
      if (out.ok) { toast(out.message ?? 'Übernommen.', 'ok'); setApplied({ message: out.message ?? 'Fahrzeug übernommen.', detail: out.detail }); } else toast(out.error ?? 'Das hat nicht geklappt.', 'error');
      return;
    }
    setChoosing(true);
  };

  const searchCatalog = async (q: string) => {
    if (q.trim().length < 2) return;
    setLoading(true);
    try { const out = await api<{ rows: RecordDto[]; total: number }>({ mode: 'search', q }); setCatalog({ q, rows: out.rows, total: out.total }); }
    catch { setErr('Die Suche ist gerade nicht möglich.'); } finally { setLoading(false); }
  };

  const doVin = async () => {
    setLoading(true); setErr(null);
    try { setVinRes(await api<VinResult>({ mode: 'vin', vin })); } catch { setErr('Die Prüfung ist gerade nicht möglich.'); } finally { setLoading(false); }
  };

  const pickActions = (rec: RecordDto) => (
    <>
      {canWriteData && <button type="button" className="adm-btn" onClick={() => apply(rec)}>FAHRZEUG ÜBERNEHMEN</button>}
      <button type="button" className="adm-btn adm-btn-secondary" onClick={() => { setMode('vin'); }}>FIN ERGÄNZEN</button>
      <button type="button" className="adm-btn adm-btn-ghost" onClick={() => { reset(); setHsn(''); setTsn(''); setSubmitted(false); hsnRef.current?.focus(); }}>ANDERES FAHRZEUG</button>
    </>
  );

  const modes: [Mode, string][] = [['hsn', 'HSN / TSN'], ['vin', 'FIN / VIN'], ['schein', 'FAHRZEUGSCHEIN'], ['manuell', 'MANUELL']];

  const body = (
    <div className={`vi ${compact ? 'vi-compact' : ''}`}>
      <div className="vi-modes" role="group" aria-label="Identifikationsart">
        {modes.map(([k, l]) => <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>)}
      </div>

      {mode === 'hsn' && (
        <div className="adm-card vi-search" role="search" onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') { e.preventDefault(); void run(hsn, tsn); } }}>
          <div className="vi-codes">
            <div className="vi-code-field">
              <label htmlFor={`vi-hsn-${variant}`}>HSN</label>
              <input id={`vi-hsn-${variant}`} ref={hsnRef} className="vi-code" value={hsn} onChange={(e) => onHsn(e.target.value)} inputMode="numeric" autoComplete="off" spellCheck={false} placeholder="0588" aria-invalid={hsnBad} aria-describedby={`vi-hsn-e-${variant}`} maxLength={12} autoFocus={!compact} />
              <div id={`vi-hsn-e-${variant}`} className="vi-code-err" aria-live="polite">{hsnBad ? hsnCheck?.error : ''}</div>
            </div>
            <div className="vi-code-field">
              <label htmlFor={`vi-tsn-${variant}`}>TSN</label>
              <input id={`vi-tsn-${variant}`} ref={tsnRef} className="vi-code" value={tsn} onChange={(e) => onTsn(e.target.value)} autoComplete="off" spellCheck={false} autoCapitalize="characters" placeholder="ABC" aria-invalid={tsnBad} aria-describedby={`vi-tsn-e-${variant}`} maxLength={12} />
              <div id={`vi-tsn-e-${variant}`} className="vi-code-err" aria-live="polite">{tsnBad ? tsnCheck?.error : tsnCheck?.hint ?? ''}</div>
            </div>
            <button type="button" className="adm-btn vi-go" disabled={loading} aria-busy={loading} onClick={() => void run(hsn, tsn)}>{loading ? 'SUCHT …' : 'FAHRZEUG SUCHEN'}</button>
          </div>
          <p className="vi-hint">Die HSN (Feld 2.1) hat 4 Zeichen, die TSN (Feld 2.2) 3 Zeichen. Eingaben wie „0588/ABC“ werden automatisch getrennt.</p>
        </div>
      )}

      {mode === 'vin' && (
        <div className="adm-card vi-search">
          <div onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') { e.preventDefault(); if (vin.length >= 17) void doVin(); } }} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 14, alignItems: 'end' }}>
            <div className="vi-code-field">
              <label htmlFor={`vi-vin-${variant}`}>FIN / VIN (17 Zeichen)</label>
              <input id={`vi-vin-${variant}`} className="vi-code" style={{ fontSize: compact ? 16 : 20, letterSpacing: '.12em' }} value={vin} onChange={(e) => setVin(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 17))} placeholder="WAUZZZ…" autoComplete="off" spellCheck={false} aria-invalid={vin.length > 0 && Boolean(validateVin(vin).error) && vin.length >= 17} />
              <div className="vi-code-err">{vin.length >= 17 ? validateVin(vin).error ?? '' : vin.length > 0 ? `${vin.length}/17 Zeichen` : ''}</div>
            </div>
            <button type="button" className="adm-btn vi-go" disabled={loading || vin.length < 17} onClick={() => void doVin()}>FIN PRÜFEN</button>
          </div>
          {vinRes && (
            vinRes.status === 'invalid'
              ? <div className="adm-alert adm-alert-danger"><AdminIcon name="alert" />{vinRes.error}</div>
              : (
                <div className="vi-result" style={{ boxShadow: 'none' }}>
                  <header className="vi-result-head"><span className="vi-flag vi-flag-ok">FIN FORMAL GÜLTIG</span><span className="mono">{vinRes.vin}</span><span className="t-3" style={{ fontSize: 12 }}>Hersteller-Kennung (WMI): {vinRes.wmi}</span></header>
                  <div style={{ padding: '14px 20px', display: 'grid', gap: 10 }}>
                    <div className="adm-alert"><AdminIcon name="info" />{vinRes.provider.message}</div>
                    {vinRes.known.length > 0 ? (
                      <div><b style={{ fontSize: 13 }}>Bereits bekannt</b>
                        <ul className="adm-list" style={{ marginTop: 6 }}>{vinRes.known.map((k) => (
                          <li key={k.id}><span className="main"><Link href={`/admin/fahrzeuge/${k.id}/`} className="adm-link">{k.manufacturer} {k.model}{k.variant ? ` ${k.variant}` : ''}</Link><span className="secondary">{k.licensePlate ?? 'ohne Kennzeichen'}{k.hsn ? ` · ${k.hsn}/${k.tsn}` : ''}</span></span></li>
                        ))}</ul></div>
                    ) : <p className="vi-hint">Zu dieser FIN gibt es keine Fahrzeuge in Ihrem Bestand. Bitte HSN/TSN oder die manuelle Auswahl nutzen.</p>}
                    <div className="vi-actions" style={{ padding: 0 }}><button type="button" className="adm-btn adm-btn-secondary" onClick={() => setMode('hsn')}>HSN / TSN EINGEBEN</button><button type="button" className="adm-btn adm-btn-secondary" onClick={() => setMode('manuell')}>MANUELL AUSWÄHLEN</button></div>
                  </div>
                </div>
              )
          )}
        </div>
      )}

      {mode === 'schein' && <RegistrationCheck compact={compact} onFound={(rec) => { setPicked(rec); setMode('hsn'); setRes({ status: 'found', hsn: rec.hsn, tsn: rec.tsn, errors: {}, hints: [], records: [rec], alsoIn: [], external: { state: 'not_asked' }, cached: true }); }} />}

      {mode === 'manuell' && (
        <ManualBlock
          prefill={{ hsn, tsn }} canWrite={canWriteData}
          catalog={catalog} qCat={qCat} setQCat={setQCat} onSearch={searchCatalog} loading={loading}
          onChoose={(rec) => { setMode('hsn'); setHsn(rec.hsn); setTsn(rec.tsn); setRes({ status: 'found', hsn: rec.hsn, tsn: rec.tsn, errors: {}, hints: [], records: [rec], alsoIn: [], external: { state: 'not_asked' }, cached: true }); setPicked(rec); }}
          onCreated={async (h, t) => { setMode('hsn'); setHsn(h); setTsn(t); await run(h, t); }}
        />
      )}

      {err && <div className="adm-alert adm-alert-danger" role="alert"><AdminIcon name="alert" />{err}</div>}
      {loading && !res && mode === 'hsn' && <div className="vi-skel" aria-hidden />}

      {mode === 'hsn' && res && res.status === 'invalid' && (
        <div className="adm-alert adm-alert-danger" role="alert"><AdminIcon name="alert" /><div>{[res.errors.hsn, res.errors.tsn].filter(Boolean).join(' ')}</div></div>
      )}

      {mode === 'hsn' && res?.status === 'multiple' && !picked && <Variants records={res.records} onPick={(r) => setPicked(r)} onVin={() => setMode('vin')} />}

      {mode === 'hsn' && picked && (
        <>
          <RecordCard r={picked} alsoIn={res?.alsoIn} external={res?.external} cached={res?.cached} actions={pickActions(picked)} />
          {res?.status === 'multiple' && <button type="button" className="adm-btn adm-btn-ghost" style={{ width: 'fit-content' }} onClick={() => setPicked(null)}>← Andere Variante wählen</button>}
          {choosing && <div className="vi-result"><TargetPicker rec={picked} onDone={(o) => { setChoosing(false); if (o.ok) { toast(o.message ?? 'Übernommen.', 'ok'); setApplied({ message: o.message ?? 'Übernommen.', detail: o.detail }); } else toast(o.error ?? 'Das hat nicht geklappt.', 'error'); }} /></div>}
          {applied && (
            <div className="adm-alert adm-alert-ok" role="status"><AdminIcon name="check" /><div>{applied.message}{applied.detail?.length ? <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{applied.detail.map((d) => <li key={d}>{d}</li>)}</ul> : null}{target && <div style={{ marginTop: 6 }}><Link href={`/admin/fahrzeuge/${target.id}/`} className="adm-link">Zur Fahrzeugakte</Link></div>}</div></div>
          )}
        </>
      )}

      {mode === 'hsn' && res?.status === 'not_found' && (
        <section className="vi-result" aria-label="Fahrzeug nicht gefunden">
          <header className="vi-result-head"><span className="vi-flag vi-flag-bad">FAHRZEUG NICHT GEFUNDEN</span></header>
          <dl className="vi-facts" style={{ marginTop: 0, borderTop: 0 }}><Fact label="HSN" mono>{res.hsn}</Fact><Fact label="TSN" mono>{res.tsn}</Fact></dl>
          <div className="vi-ext" style={{ paddingTop: 12 }}>
            <span className={`vi-dot ${res.external.state === 'unavailable' || res.external.state === 'paused' ? 'vi-dot-warn' : ''}`} />
            {res.external.state === 'unavailable' ? 'Externe Fahrzeugdaten derzeit nicht erreichbar.'
              : res.external.state === 'paused' ? 'Der externe Anbieter ist derzeit pausiert.'
              : res.external.state === 'not_found' ? 'Auch der externe Anbieter kennt diese HSN/TSN nicht.'
              : 'Es wurde die eigene Fahrzeugdatenbank durchsucht (kein externer Anbieter freigegeben).'}
          </div>
          <div className="vi-opts">
            <button type="button" className="adm-btn" onClick={() => setMode('vin')}>FIN SUCHEN</button>
            <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setMode('manuell')}>MANUELL AUSWÄHLEN</button>
            {canWriteData && <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setMode('manuell')}>FAHRZEUG MANUELL ANLEGEN</button>}
          </div>
        </section>
      )}
    </div>
  );
  return compact ? body : body;
}

/* ------------------------------------------------------------ Fahrzeugschein */

function RegistrationCheck({ compact, onFound }: { compact: boolean; onFound: (r: RecordDto) => void }) {
  const [f, setF] = useState<Record<string, string>>({ hsn: '', tsn: '', manufacturer: '', powerKw: '', displacementCc: '', fuel: '', vin: '', vehicleClass: '', seats: '', firstRegistration: '', approvalKind: '' });
  const [out, setOut] = useState<{ rec: RecordDto | null; many: number; none: boolean; rows: ReturnType<typeof compareRegistration> } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((cur) => ({ ...cur, [k]: v }));
  const check = async () => {
    const h = normalizeHsn(f.hsn), t = normalizeTsn(f.tsn);
    if (!h.value || !t.value) { setOut(null); return; }
    setBusy(true);
    try {
      const res = await api<IdentifyResult>({ mode: 'hsn', hsn: h.value, tsn: t.value });
      const rec = res.records.length === 1 ? res.records[0] : null;
      const num = (s: string) => (s.trim() ? Number(s.replace(/\./g, '').replace(',', '.')) : null);
      const rows = compareRegistration({ manufacturer: f.manufacturer || null, powerKw: num(f.powerKw), displacementCc: num(f.displacementCc), fuelType: normalizeFuel(f.fuel) }, rec ?? {});
      setOut({ rec, many: res.records.length, none: res.records.length === 0, rows });
    } finally { setBusy(false); }
  };
  const st = out ? approvalStatus((f.approvalKind || null) as ApprovalKey | null, out.rows) : null;
  const inp = (k: string, label: string, ph?: string, extra: Record<string, unknown> = {}) => (
    <label className="adm-field"><span className="adm-label">{label}</span><input className="adm-input" value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder={ph} autoComplete="off" {...extra} /></label>
  );
  return (
    <div className="adm-card vi-search">
      <p className="vi-hint">Angaben aus der Zulassungsbescheinigung Teil I eintragen. Ein automatisches Auslesen per Foto (OCR) ist noch nicht angebunden – die Felder werden manuell erfasst und mit der Datenbank abgeglichen.</p>
      <div className="vi-form" style={{ padding: 0 }}>
        {inp('hsn', 'HSN (2.1)', '0588', { maxLength: 8 })}{inp('tsn', 'TSN (2.2)', 'ABC', { maxLength: 8 })}
        {inp('manufacturer', 'Hersteller (D.1)')}
        {inp('powerKw', 'Leistung in kW (P.2)', '140', { inputMode: 'numeric' })}
        {inp('displacementCc', 'Hubraum in cm³ (P.1)', '1968', { inputMode: 'numeric' })}
        <label className="adm-field"><span className="adm-label">Kraftstoff (P.3)</span>
          <select className="adm-input" value={f.fuel} onChange={(e) => set('fuel', e.target.value)}><option value="">–</option>{Object.values(FUEL_LABELS).map((l) => <option key={l}>{l}</option>)}</select></label>
        {!compact && <>{inp('vin', 'FIN (E)', 'WAUZZZ…', { maxLength: 20 })}{inp('firstRegistration', 'Erstzulassung (B)', 'TT.MM.JJJJ')}{inp('seats', 'Sitzplätze (S.1)', '5', { inputMode: 'numeric' })}{inp('vehicleClass', 'Fahrzeugklasse (J)', 'M1')}</>}
        <label className="adm-field"><span className="adm-label">Genehmigung</span>
          <select className="adm-input" value={f.approvalKind} onChange={(e) => set('approvalKind', e.target.value)}>
            <option value="">Nicht bekannt</option><option value="EC_TYPE_APPROVAL">EG-Typgenehmigung</option><option value="ABE">ABE</option><option value="INDIVIDUAL">Einzelgenehmigung</option>
          </select></label>
      </div>
      <div className="vi-actions" style={{ padding: 0 }}><button type="button" className="adm-btn vi-go" style={{ height: 44 }} onClick={check} disabled={busy}>{busy ? 'PRÜFT …' : 'MIT DATENBANK ABGLEICHEN'}</button></div>
      {out && (
        <div className="vi-result" style={{ boxShadow: 'none' }}>
          <header className="vi-result-head">
            <span className={`vi-flag ${out.rows.some((r) => r.state === 'deviation') ? 'vi-flag-warn' : out.rec ? 'vi-flag-ok' : 'vi-flag-bad'}`}>
              {out.rows.some((r) => r.state === 'deviation') ? '⚠ ABWEICHUNG' : out.rec && out.rows.some((r) => r.state === 'ok') ? '✓ KONFORM' : out.none ? 'KEIN DATENSATZ' : out.many > 1 ? 'MEHRERE VARIANTEN' : 'NICHT BEURTEILBAR'}
            </span>
            {out.rec && <span className="t-2" style={{ fontSize: 13 }}>{out.rec.manufacturer} {out.rec.model} · {out.rec.hsn}/{out.rec.tsn}</span>}
          </header>
          <table className="vi-prov"><thead><tr><th>Feld</th><th>Fahrzeugschein</th><th>Datenbank</th><th /></tr></thead><tbody>
            {out.rows.map((r) => <tr key={r.field}><td>{r.label}</td><td>{r.registration ?? NA}</td><td>{r.database ?? NA}</td><td>{r.state === 'ok' ? <span className="adm-badge adm-badge-ok">✓ konform</span> : r.state === 'deviation' ? <span className="adm-badge adm-badge-warn">⚠ Abweichung</span> : <span className="adm-badge adm-badge-muted">offen</span>}</td></tr>)}
          </tbody></table>
          {st && <div className={`adm-alert ${st.state === 'deviation' ? 'adm-alert-warn' : ''}`} style={{ margin: 14 }}><AdminIcon name={st.state === 'deviation' ? 'alert' : 'info'} />{st.text}{st.state === 'deviation' ? ' Der Gutachter muss prüfen.' : ''}</div>}
          {out.none && <p className="vi-hint" style={{ padding: '0 20px 16px' }}>Zu dieser HSN/TSN gibt es keinen Datensatz. Es wird nichts behauptet – bitte manuell anlegen oder FIN verwenden.</p>}
          {out.rec && <div className="vi-actions"><button type="button" className="adm-btn" onClick={() => onFound(out.rec!)}>DATENSATZ ÖFFNEN</button></div>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ Manuell */

function ManualBlock({ prefill, canWrite, catalog, qCat, setQCat, onSearch, loading, onChoose, onCreated }: {
  prefill: { hsn: string; tsn: string }; canWrite: boolean; catalog: { q: string; rows: RecordDto[]; total: number } | null; qCat: string; setQCat: (v: string) => void;
  onSearch: (q: string) => void; loading: boolean; onChoose: (r: RecordDto) => void; onCreated: (hsn: string, tsn: string) => void | Promise<void>;
}) {
  const toast = useToast();
  const [f, setF] = useState<Record<string, string>>({ hsn: prefill.hsn, tsn: prefill.tsn, manufacturer: '', model: '', variant: '', fuelType: '', powerKw: '', powerHp: '', displacementCc: '' });
  const [errs, setErrs] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((c) => ({ ...c, [k]: v }));
  const create = async () => {
    setBusy(true); setErrs(null);
    const out = await createManualRecordAction(f);
    setBusy(false);
    if (!out.ok) { setErrs(out.error ?? 'Das hat nicht geklappt.'); return; }
    toast(out.message ?? 'Angelegt.', 'ok');
    await onCreated(normalizeHsn(f.hsn).value ?? f.hsn, normalizeTsn(f.tsn).value ?? f.tsn);
  };
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="adm-card vi-search">
        <b style={{ fontSize: 13 }}>Aus der Fahrzeugdatenbank auswählen</b>
        <div onKeyDown={(e) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') { e.preventDefault(); onSearch(qCat); } }} style={{ display: 'flex', gap: 10 }}>
          <input className="adm-input" style={{ flex: 1 }} value={qCat} onChange={(e) => setQCat(e.target.value)} placeholder="z. B. Audi A5, A5 190 PS, 2.0 TDI, 1968 Diesel, 0588" aria-label="Fahrzeugdatenbank durchsuchen" />
          <button type="button" className="adm-btn" disabled={loading || qCat.trim().length < 2} onClick={() => onSearch(qCat)}>SUCHEN</button>
        </div>
        {catalog && (catalog.rows.length === 0 ? <p className="vi-hint">Keine Treffer für „{catalog.q}“.</p> : (
          <div className="vi-table-wrap"><table className="vi-table"><thead><tr><th>Fahrzeug</th><th>HSN/TSN</th><th>Leistung</th><th>Hubraum</th><th>Kraftstoff</th><th>Status</th><th /></tr></thead><tbody>
            {catalog.rows.map((r) => <tr key={r.id}><td><b>{r.manufacturer}</b> {r.model ?? r.vehicleNameRaw}{r.variant ? ` ${r.variant}` : ''}<div className="t-3" style={{ fontSize: 12 }}>{r.engineName}</div></td><td className="mono">{r.hsn}/{r.tsn}</td><td className="nowrap">{fmtPower(r.powerKw, r.powerHp) ?? NA}</td><td className="nowrap">{fmtCc(r.displacementCc) ?? NA}</td><td>{r.fuelType ? FUEL_LABELS[r.fuelType as FuelKey] : NA}</td><td><StatusBadge status={r.verificationStatus} /></td><td><button type="button" className="adm-btn" onClick={() => onChoose(r)}>AUSWÄHLEN</button></td></tr>)}
          </tbody></table>{catalog.total > catalog.rows.length && <p className="vi-hint" style={{ padding: 10 }}>{catalog.total} Treffer – bitte die Suche verfeinern.</p>}</div>
        ))}
      </div>
      {canWrite && (
        <div className="adm-card vi-search">
          <b style={{ fontSize: 13 }}>Fahrzeug manuell anlegen</b>
          <p className="vi-hint">Nur eintragen, was bekannt ist – leere Felder bleiben „Nicht verfügbar“. Der Datensatz gilt als <b>nicht verifiziert</b>, bis er geprüft wurde.</p>
          <div className="vi-form" style={{ padding: 0 }}>
            {([['hsn', 'HSN', '0588'], ['tsn', 'TSN', 'ABC'], ['manufacturer', 'Hersteller', ''], ['model', 'Modell', ''], ['variant', 'Variante / Motor', ''], ['powerKw', 'Leistung kW', ''], ['powerHp', 'Leistung PS', ''], ['displacementCc', 'Hubraum cm³', '']] as const).map(([k, l, ph]) => (
              <label key={k} className="adm-field"><span className="adm-label">{l}</span><input className={`adm-input ${k === 'hsn' || k === 'tsn' ? 'mono' : ''}`} value={f[k]} onChange={(e) => set(k, k === 'hsn' || k === 'tsn' ? e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '') : e.target.value)} placeholder={ph} autoComplete="off" /></label>
            ))}
            <label className="adm-field"><span className="adm-label">Kraftstoff</span><select className="adm-input" value={f.fuelType} onChange={(e) => set('fuelType', e.target.value)}><option value="">Nicht verfügbar</option>{Object.entries(FUEL_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          </div>
          {errs && <div className="adm-alert adm-alert-danger" role="alert"><AdminIcon name="alert" />{errs}</div>}
          <div className="vi-actions" style={{ padding: 0 }}><button type="button" className="adm-btn" onClick={create} disabled={busy}>{busy ? 'LEGT AN …' : 'FAHRZEUG ANLEGEN'}</button></div>
        </div>
      )}
    </div>
  );
}
