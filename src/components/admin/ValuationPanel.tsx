'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { AdminIcon } from './AdminIcon';
import { useToast } from './Toast';
import { addComparableAction, addValuationEntryAction, comparableAction, selectValuationEntryAction, withdrawValuationEntryAction, type ValResult } from '@/app/admin/(panel)/faelle/valuation-actions';
import { DECISION_TEXT, IS_MONEY, TAX_LABELS, TYPE_LABELS, convertTax, decide, sourceName, usageLossTotal, type TaxModeKey, type ValuationTypeKey } from '@/lib/valuation';
import { centsToInput, fmtEuro, parseEuroToCents } from '@/lib/money';

export type VEntry = { id: string; type: ValuationTypeKey; label: string | null; amountCents: number | null; days: number | null; taxMode: TaxModeKey; source: string; sourceRef: string | null; referenceDate: string | null; validUntil: string | null; note: string | null; selected: boolean; createdAt: string; withdrawn: boolean; byName: string | null };
export type VComp = { id: string; title: string; priceCents: number; mileage: number | null; firstReg: string | null; location: string | null; sourceRef: string | null; seenOn: string | null; note: string | null; included: boolean };
type Calc = { version: number; status: 'DRAFT' | 'FINAL'; netCents: number; grossCents: number; vatBp: number } | null;

const de = (iso: string | null) => (iso ? iso.split('-').reverse().join('.') : '–');
const today = () => new Date().toISOString().slice(0, 10);

export function ValuationPanel({ caseId, caseNumber, entries, comparables, calc, canWrite, calcHours }: { caseId: string; caseNumber: string; entries: VEntry[]; comparables: VComp[]; calc: Calc; canWrite: boolean; calcHours: number | null }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [basis, setBasis] = useState<'GROSS' | 'NET'>('GROSS');
  const [limit, setLimit] = useState('130');
  const live = entries.filter((e) => !e.withdrawn);
  const sel = (t: ValuationTypeKey) => live.find((e) => e.type === t && e.selected) ?? null;
  const wbw = sel('REPLACEMENT_VALUE'), rw = sel('RESIDUAL_VALUE'), dim = sel('DIMINISHED_VALUE'), rate = sel('USAGE_LOSS'), dur = sel('REPAIR_DURATION'), rep = sel('REPLACEMENT_DURATION');
  const limitBp = Math.round(Number(limit.replace(',', '.')) * 100);

  const dec = useMemo(() => decide({
    repairCents: calc ? (basis === 'NET' ? calc.netCents : calc.grossCents) : null,
    replacement: wbw?.amountCents != null ? { cents: wbw.amountCents, tax: wbw.taxMode } : null,
    residual: rw?.amountCents != null ? { cents: rw.amountCents, tax: rw.taxMode } : null,
    basis, vatBp: calc?.vatBp ?? 1900, limitBp: Number.isFinite(limitBp) && limitBp > 0 ? limitBp : 13000,
  }), [calc, basis, wbw, rw, limitBp]);
  const T = DECISION_TEXT[dec.state];
  const usage = usageLossTotal(dur?.days ?? null, rate?.amountCents ?? null);

  const run = (fn: () => Promise<ValResult>, ok?: () => void) => start(async () => {
    const r = await fn();
    toast(r.ok ? r.message ?? 'Gespeichert.' : r.error ?? 'Das hat nicht geklappt.', r.ok ? 'ok' : 'error');
    if (r.ok) { ok?.(); router.refresh(); }
  });
  const add = (data: Record<string, unknown>, ok?: () => void) => run(() => addValuationEntryAction({ caseId, caseNumber, data }), ok);

  const card = (label: string, value: string, sub?: string, tone?: string) => (
    <div className={`val-kpi ${tone ?? ''}`}><span>{label}</span><b>{value}</b>{sub && <small>{sub}</small>}</div>
  );
  const tax = (e: VEntry) => (e.amountCents != null && IS_MONEY[e.type] ? ` ${TAX_LABELS[e.taxMode]}` : '');

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="val-kpis">
        {card('Reparaturkosten', calc ? fmtEuro(basis === 'NET' ? calc.netCents : calc.grossCents) : '–', calc ? `Kalkulation V${calc.version}${calc.status === 'DRAFT' ? ' (Entwurf, vorläufig)' : ''} · ${basis === 'NET' ? 'netto' : 'brutto'}` : 'keine Kalkulation')}
        {card('Wiederbeschaffungswert', wbw?.amountCents != null ? fmtEuro(wbw.amountCents) : '–', wbw ? `${TAX_LABELS[wbw.taxMode]} · ${sourceName(wbw.source)} · Stand ${de(wbw.referenceDate)}` : 'nicht erfasst')}
        {card('Restwert', rw?.amountCents != null ? fmtEuro(rw.amountCents) : '–', rw ? `${TAX_LABELS[rw.taxMode]} · ${sourceName(rw.source)}` : 'nicht erfasst')}
        {card('Wiederbeschaffungsaufwand', dec.replacementEffort != null ? fmtEuro(dec.replacementEffort) : '–', 'WBW − Restwert')}
        {card('Wertminderung', dim?.amountCents != null ? fmtEuro(dim.amountCents) : '–', dim ? `${sourceName(dim.source)}${dim.label ? ` · ${dim.label}` : ''}` : 'nicht erfasst')}
        {card('Nutzungsausfall', usage != null ? fmtEuro(usage) : '–', rate && dur ? `${dur.days} Tage × ${fmtEuro(rate.amountCents)}` : 'Tagessatz und Dauer erfassen')}
      </div>

      <section className={`adm-card val-dec val-${T.tone}`} aria-label="Einordnung Reparatur oder Totalschaden">
        <header>
          <b>Reparatur oder Totalschaden?</b>
          <span className="grow" />
          <label className="calc-cmp">Basis<select className="adm-input" value={basis} onChange={(e) => setBasis(e.target.value as 'GROSS' | 'NET')}><option value="GROSS">brutto</option><option value="NET">netto</option></select></label>
          <label className="calc-cmp">Grenze (% vom WBW)<input className="adm-input" style={{ width: 70 }} value={limit} onChange={(e) => setLimit(e.target.value)} inputMode="decimal" aria-label="Grenze in Prozent des Wiederbeschaffungswerts" /></label>
        </header>
        <div className="val-dec-body">
          <span className={`adm-badge adm-badge-${T.tone === 'danger' ? 'danger' : T.tone === 'warn' ? 'warn' : T.tone === 'ok' ? 'ok' : 'muted'}`}>{T.title}</span>
          <p style={{ margin: 0 }}>{T.text}</p>
          {dec.state !== 'UNKNOWN' && (
            <dl className="val-nums">
              <dt>Reparaturkosten ({basis === 'NET' ? 'netto' : 'brutto'})</dt><dd>{fmtEuro(dec.repair)}</dd>
              <dt>Wiederbeschaffungsaufwand (WBW − Restwert)</dt><dd>{fmtEuro(dec.replacementEffort)}</dd>
              <dt>Grenze {fmtEuro(dec.limit)} ({(dec.limitBp / 100).toLocaleString('de-DE')} % WBW)</dt><dd>{dec.ratioBp != null ? `${(dec.ratioBp / 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} % vom WBW` : ''}</dd>
            </dl>
          )}
          {dec.notes.map((n) => <p key={n} className="vi-hint" style={{ margin: 0 }}>{n}</p>)}
          <p className="vi-hint" style={{ margin: 0 }}>Rechenhilfe mit den eingetragenen Werten. Die fachliche und rechtliche Beurteilung obliegt dem Sachverständigen.</p>
        </div>
      </section>

      {/* ---- Wiederbeschaffungswert ---- */}
      <Block title="Wiederbeschaffungswert" type="REPLACEMENT_VALUE" entries={live} canWrite={canWrite} pending={pending} run={run} caseNumber={caseNumber} tax={tax}
        form={<EntryForm type="REPLACEMENT_VALUE" pending={pending} onSave={add} sources={[['MANUAL', 'Manuell / Bewertung'], ['VERGLEICH', 'Aus Vergleichsfahrzeugen'], ['TABELLE', 'Tabelle']]} needRef />} />
      <section className="calc-group" aria-label="Vergleichsfahrzeuge">
        <header><b>Vergleichsfahrzeuge</b><span className="t-3">{comparables.length} erfasst</span></header>
        <ComparableSection caseId={caseId} caseNumber={caseNumber} comps={comparables} canWrite={canWrite} pending={pending} run={run} onAdopt={(median, n) => add({ type: 'REPLACEMENT_VALUE', amountCents: median, taxMode: 'GROSS', source: 'VERGLEICH', referenceDate: today(), note: `Median aus ${n} Vergleichsfahrzeugen` })} />
      </section>

      {/* ---- Restwert ---- */}
      <Block title="Restwert" type="RESIDUAL_VALUE" entries={live} canWrite={canWrite} pending={pending} run={run} caseNumber={caseNumber} tax={tax}
        form={<EntryForm type="RESIDUAL_VALUE" pending={pending} onSave={add} sources={[['MANUAL', 'Manuell'], ['ANGEBOT', 'Aus Angebot']]} />} />
      <Block title="Restwertangebote" type="RESIDUAL_OFFER" entries={live} canWrite={canWrite} pending={pending} run={run} caseNumber={caseNumber} tax={tax} noSelect
        adopt={(e) => add({ type: 'RESIDUAL_VALUE', amountCents: e.amountCents, taxMode: e.taxMode, source: 'ANGEBOT', sourceRef: e.label, referenceDate: e.referenceDate ?? today(), validUntil: e.validUntil, note: `Übernommen aus Angebot von ${e.label}` })}
        form={<EntryForm type="RESIDUAL_OFFER" pending={pending} onSave={add} sources={[['ANGEBOT', 'Angebot']]} offer />} />

      {/* ---- Wertminderung ---- */}
      <Block title="Wertminderung (merkantil)" type="DIMINISHED_VALUE" entries={live} canWrite={canWrite} pending={pending} run={run} caseNumber={caseNumber} tax={tax}
        hint="Es wird kein Berechnungsverfahren vorgegeben. Betrag und angewandtes Verfahren trägt der Sachverständige ein."
        form={<EntryForm type="DIMINISHED_VALUE" pending={pending} onSave={add} sources={[['MANUAL', 'Manuell']]} labelText="Verfahren / Methode" />} />

      {/* ---- Nutzungsausfall ---- */}
      <Block title="Nutzungsausfall: Tagessatz" type="USAGE_LOSS" entries={live} canWrite={canWrite} pending={pending} run={run} caseNumber={caseNumber} tax={tax}
        hint="Der Tagessatz wird aus der vom Sachverständigen verwendeten Tabelle abgelesen und hier eingetragen (keine Tabelle hinterlegt)."
        form={<EntryForm type="USAGE_LOSS" pending={pending} onSave={add} sources={[['TABELLE', 'Tabelle (abgelesen)'], ['MANUAL', 'Manuell']]} labelText="Fahrzeuggruppe / Tabelle" />} />
      <Block title="Reparaturdauer" type="REPAIR_DURATION" entries={live} canWrite={canWrite} pending={pending} run={run} caseNumber={caseNumber} tax={tax}
        hint={calcHours != null ? `Arbeitszeit laut Kalkulation: ${calcHours.toLocaleString('de-DE', { maximumFractionDigits: 1 })} h (reine Arbeitszeit, ohne Teilebeschaffung und Trocknung).` : undefined}
        form={<EntryForm type="REPAIR_DURATION" pending={pending} onSave={add} sources={[['MANUAL', 'Manuell']]} />} />
      <Block title="Wiederbeschaffungsdauer" type="REPLACEMENT_DURATION" entries={live} canWrite={canWrite} pending={pending} run={run} caseNumber={caseNumber} tax={tax}
        form={<EntryForm type="REPLACEMENT_DURATION" pending={pending} onSave={add} sources={[['MANUAL', 'Manuell']]} />} />
      {rep && null}
      {entries.some((e) => e.withdrawn) && (
        <details className="adm-card" style={{ padding: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Zurückgezogene Werte ({entries.filter((e) => e.withdrawn).length})</summary>
          <ul className="adm-list" style={{ marginTop: 8 }}>{entries.filter((e) => e.withdrawn).map((e) => <li key={e.id}><span className="main"><span>{TYPE_LABELS[e.type]}: {IS_MONEY[e.type] ? fmtEuro(e.amountCents) : `${e.days} Tage`}{tax(e)}</span><span className="secondary">{sourceName(e.source)} · erfasst von {e.byName ?? '–'} am {new Date(e.createdAt).toLocaleDateString('de-DE')}</span></span></li>)}</ul>
        </details>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ Block mit Einträgen */

function Block({ title, type, entries, canWrite, pending, run, caseNumber, tax, form, hint, noSelect, adopt }: {
  title: string; type: ValuationTypeKey; entries: VEntry[]; canWrite: boolean; pending: boolean; run: (fn: () => Promise<ValResult>, ok?: () => void) => void; caseNumber: string;
  tax: (e: VEntry) => string; form: React.ReactNode; hint?: string; noSelect?: boolean; adopt?: (e: VEntry) => void;
}) {
  const list = entries.filter((e) => e.type === type);
  const [open, setOpen] = useState(false);
  const best = type === 'RESIDUAL_OFFER' ? list.reduce<VEntry | null>((b, e) => ((e.amountCents ?? 0) > (b?.amountCents ?? -1) ? e : b), null) : null;
  return (
    <section className="calc-group" aria-label={title}>
      <header><b>{title}</b><span className="t-3">{list.length ? `${list.length} Eintrag${list.length > 1 ? 'e' : ''}` : 'noch nichts erfasst'}</span><span className="grow" />{canWrite && <button type="button" className="adm-btn adm-btn-secondary adm-btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}><AdminIcon name="plus" />{open ? 'Schließen' : 'Wert erfassen'}</button>}</header>
      {hint && <p className="vi-hint" style={{ margin: 0 }}>{hint}</p>}
      {list.length > 0 && (
        <ul className="val-list">
          {list.map((e) => (
            <li key={e.id} className={e.selected ? 'is-sel' : undefined}>
              <span className="val-main">
                <b>{IS_MONEY[e.type] ? fmtEuro(e.amountCents) : `${e.days} ${e.days === 1 ? 'Tag' : 'Tage'}`}<span className="t-3" style={{ fontWeight: 400 }}>{tax(e)}</span></b>
                {e.label && <span>{e.label}</span>}
                <span className="t-3">{sourceName(e.source)}{e.sourceRef ? ` · ${e.sourceRef}` : ''}{e.referenceDate ? ` · Stand ${de(e.referenceDate)}` : ''}{e.validUntil ? ` · gültig bis ${de(e.validUntil)}` : ''} · erfasst {new Date(e.createdAt).toLocaleDateString('de-DE')}{e.byName ? ` von ${e.byName}` : ''}</span>
                {e.note && <span className="t-2" style={{ fontSize: 12.5 }}>{e.note}</span>}
              </span>
              {e.selected && !noSelect && <span className="adm-badge adm-badge-ok">gewählt</span>}
              {best?.id === e.id && list.length > 1 && <span className="adm-badge adm-badge-info">höchstes Angebot</span>}
              {canWrite && (
                <span className="dm-entry-actions">
                  {!noSelect && !e.selected && <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" disabled={pending} onClick={() => run(() => selectValuationEntryAction({ id: e.id, caseNumber }))}>Wählen</button>}
                  {adopt && <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" disabled={pending} onClick={() => adopt(e)}>Als Restwert übernehmen</button>}
                  <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" disabled={pending} onClick={() => { if (window.confirm('Wert zurückziehen? Er bleibt im Verlauf sichtbar.')) run(() => withdrawValuationEntryAction({ id: e.id, caseNumber })); }}>Zurückziehen</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {open && canWrite && <div className="val-form">{form}</div>}
    </section>
  );
}

/* ------------------------------------------------------------ Formular für einen Wert */

function EntryForm({ type, onSave, pending, sources, needRef, offer, labelText }: {
  type: ValuationTypeKey; onSave: (data: Record<string, unknown>, ok?: () => void) => void; pending: boolean; sources: [string, string][]; needRef?: boolean; offer?: boolean; labelText?: string;
}) {
  const money = IS_MONEY[type];
  const [f, setF] = useState({ amount: '', days: '', tax: 'GROSS' as TaxModeKey, source: sources[0][0], ref: '', date: type === 'REPLACEMENT_VALUE' ? today() : '', until: '', label: '', note: '', choose: true });
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<typeof f>) => setF((c) => ({ ...c, ...p }));
  const submit = () => {
    setErr(null);
    const cents = money ? parseEuroToCents(f.amount) : null;
    if (money && (cents == null || Number.isNaN(cents))) return setErr('Bitte einen gültigen Betrag eingeben (z. B. 12.500,00).');
    if (!money && !/^\d+$/.test(f.days.trim())) return setErr('Bitte die Dauer in ganzen Tagen eingeben.');
    onSave({ type, amountCents: cents, days: money ? null : Number(f.days), taxMode: f.tax, source: f.source, sourceRef: f.ref, referenceDate: f.date, validUntil: f.until, label: f.label, note: f.note, select: offer ? false : f.choose }, () => setF((c) => ({ ...c, amount: '', days: '', ref: '', note: '', label: '' })));
  };
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div className="adm-form-grid">
        {money ? <label className="adm-field"><span className="adm-label">Betrag (€)</span><input className="adm-input" inputMode="decimal" value={f.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="0,00" /></label>
          : <label className="adm-field"><span className="adm-label">Dauer (Tage)</span><input className="adm-input" inputMode="numeric" value={f.days} onChange={(e) => set({ days: e.target.value })} /></label>}
        {money && <label className="adm-field"><span className="adm-label">Steuerbasis</span><select className="adm-input" value={f.tax} onChange={(e) => set({ tax: e.target.value as TaxModeKey })}>{(Object.keys(TAX_LABELS) as TaxModeKey[]).map((k) => <option key={k} value={k}>{TAX_LABELS[k]}</option>)}</select></label>}
        {(offer || labelText) && <label className="adm-field"><span className="adm-label">{offer ? 'Bieter' : labelText}</span><input className="adm-input" value={f.label} maxLength={120} onChange={(e) => set({ label: e.target.value })} /></label>}
        <label className="adm-field"><span className="adm-label">Quelle</span><select className="adm-input" value={f.source} onChange={(e) => set({ source: e.target.value })}>{sources.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="adm-field"><span className="adm-label">Quellenangabe / Link{needRef ? ' (empfohlen)' : ''}</span><input className="adm-input" value={f.ref} maxLength={300} onChange={(e) => set({ ref: e.target.value })} /></label>
        {(type === 'REPLACEMENT_VALUE' || money) && <label className="adm-field"><span className="adm-label">Stand / Datum{type === 'REPLACEMENT_VALUE' ? ' (Pflicht)' : ''}</span><input className="adm-input" type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} /></label>}
        {offer && <label className="adm-field"><span className="adm-label">Gültig bis</span><input className="adm-input" type="date" value={f.until} onChange={(e) => set({ until: e.target.value })} /></label>}
      </div>
      <label className="adm-field"><span className="adm-label">Notiz</span><input className="adm-input" value={f.note} maxLength={1000} onChange={(e) => set({ note: e.target.value })} /></label>
      {!offer && <label className="adm-check"><input type="checkbox" checked={f.choose} onChange={(e) => set({ choose: e.target.checked })} /> Als maßgeblichen Wert übernehmen (bisheriger Wert bleibt im Verlauf)</label>}
      {err && <div className="adm-alert adm-alert-danger" role="alert"><AdminIcon name="alert" />{err}</div>}
      <div className="adm-actions"><button type="button" className="adm-btn" disabled={pending} onClick={submit}>Speichern</button></div>
    </div>
  );
}

/* ------------------------------------------------------------ Vergleichsfahrzeuge */

function ComparableSection({ caseId, caseNumber, comps, canWrite, pending, run, onAdopt }: {
  caseId: string; caseNumber: string; comps: VComp[]; canWrite: boolean; pending: boolean; run: (fn: () => Promise<ValResult>, ok?: () => void) => void; onAdopt: (median: number, n: number) => void;
}) {
  const [f, setF] = useState({ title: '', price: '', mileage: '', firstReg: '', location: '', ref: '', seen: today(), note: '' });
  const [err, setErr] = useState<string | null>(null);
  const inc = comps.filter((c) => c.included);
  const sorted = inc.map((c) => c.priceCents).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length ? (sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)) : null;
  const mean = sorted.length ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : null;
  const submit = () => {
    setErr(null);
    const cents = parseEuroToCents(f.price);
    if (cents == null || Number.isNaN(cents) || cents <= 0) return setErr('Bitte einen gültigen Preis eingeben.');
    run(() => addComparableAction({ caseId, caseNumber, data: { title: f.title, priceCents: cents, mileage: f.mileage ? Number(f.mileage.replace(/\./g, '')) : null, firstReg: f.firstReg, location: f.location, sourceRef: f.ref, seenOn: f.seen, note: f.note } }), () => setF({ ...f, title: '', price: '', mileage: '', ref: '', note: '' }));
  };
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {comps.length > 0 && (
        <div className="calc-table-wrap"><table className="vi-table" style={{ minWidth: 640 }}>
          <thead><tr><th>Einbeziehen</th><th>Fahrzeug / Inserat</th><th>Preis</th><th>km</th><th>Erstzulassung</th><th>Ort</th><th>Gesehen</th><th /></tr></thead>
          <tbody>{comps.map((c) => (
            <tr key={c.id} style={c.included ? undefined : { opacity: .5 }}>
              <td><input type="checkbox" checked={c.included} disabled={!canWrite || pending} aria-label={`${c.title} einbeziehen`} onChange={(e) => run(() => comparableAction({ id: c.id, caseNumber, included: e.target.checked }))} /></td>
              <td><b>{c.title}</b>{c.sourceRef && <div className="t-3" style={{ fontSize: 12, wordBreak: 'break-all' }}>{/^https?:\/\//.test(c.sourceRef) ? <a href={c.sourceRef} target="_blank" rel="noopener noreferrer nofollow" className="adm-link">{c.sourceRef}</a> : c.sourceRef}</div>}{c.note && <div className="t-2" style={{ fontSize: 12.5 }}>{c.note}</div>}</td>
              <td className="mono nowrap">{fmtEuro(c.priceCents)}</td><td className="nowrap">{c.mileage != null ? c.mileage.toLocaleString('de-DE') : '–'}</td><td className="nowrap">{de(c.firstReg)}</td><td>{c.location ?? '–'}</td><td className="nowrap">{de(c.seenOn)}</td>
              <td>{canWrite && <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" disabled={pending} onClick={() => run(() => comparableAction({ id: c.id, caseNumber, remove: true }))}>Entfernen</button>}</td>
            </tr>))}</tbody>
        </table></div>
      )}
      {inc.length > 0 && (
        <div className="vi-mini">
          <span>{inc.length} einbezogen</span><span>Median <b>{fmtEuro(median)}</b></span><span>Mittelwert <b>{fmtEuro(mean)}</b></span><span>Spanne {fmtEuro(sorted[0])} – {fmtEuro(sorted.at(-1))}</span>
          {canWrite && median != null && <button type="button" className="adm-btn adm-btn-secondary adm-btn-sm" disabled={pending} onClick={() => onAdopt(median, inc.length)}>Median als Wiederbeschaffungswert übernehmen</button>}
        </div>
      )}
      {comps.length === 0 && <p className="vi-hint" style={{ margin: 0 }}>Hier erfassen Sie gefundene Inserate/Angebote als Beleg. Es werden keine Börsen abgefragt (nicht angebunden); Preise und Links tragen Sie selbst ein.</p>}
      {canWrite && (
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Vergleichsfahrzeug hinzufügen</summary>
          <div className="adm-form-grid" style={{ marginTop: 8 }}>
            <label className="adm-field"><span className="adm-label">Bezeichnung</span><input className="adm-input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={160} /></label>
            <label className="adm-field"><span className="adm-label">Preis (€)</span><input className="adm-input" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></label>
            <label className="adm-field"><span className="adm-label">Kilometer</span><input className="adm-input" inputMode="numeric" value={f.mileage} onChange={(e) => setF({ ...f, mileage: e.target.value })} /></label>
            <label className="adm-field"><span className="adm-label">Erstzulassung</span><input className="adm-input" type="date" value={f.firstReg} onChange={(e) => setF({ ...f, firstReg: e.target.value })} /></label>
            <label className="adm-field"><span className="adm-label">Standort</span><input className="adm-input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></label>
            <label className="adm-field"><span className="adm-label">Quelle / Link</span><input className="adm-input" value={f.ref} onChange={(e) => setF({ ...f, ref: e.target.value })} maxLength={300} /></label>
            <label className="adm-field"><span className="adm-label">Gesehen am</span><input className="adm-input" type="date" value={f.seen} onChange={(e) => setF({ ...f, seen: e.target.value })} /></label>
            <label className="adm-field"><span className="adm-label">Notiz</span><input className="adm-input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={500} /></label>
          </div>
          {err && <div className="adm-alert adm-alert-danger" role="alert" style={{ marginTop: 8 }}><AdminIcon name="alert" />{err}</div>}
          <div className="adm-actions" style={{ marginTop: 8 }}><button type="button" className="adm-btn" disabled={pending} onClick={submit}>Hinzufügen</button></div>
        </details>
      )}
    </div>
  );
}

export { convertTax, centsToInput };
