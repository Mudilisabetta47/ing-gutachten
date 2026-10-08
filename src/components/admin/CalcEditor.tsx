'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { AdminIcon } from './AdminIcon';
import { useToast } from './Toast';
import { createCalcAction, deleteDraftAction, finalizeCalcAction, saveCalcAction, suggestCalcAction } from '@/app/admin/(panel)/faelle/calc-actions';
import {
  CALC_KINDS, KIND_LABELS, LABOR_CATEGORIES, LABOR_LABELS, awToMinutes, diffCalculations, lineTotal, minutesToAw, missingRate, rateFor, totals,
  type CalcHeader, type CalcKind, type CalcLine, type LaborCategory,
} from '@/lib/calc';
import { centsToInput, fmtEuro, parseEuroToCents } from '@/lib/money';

export type CalcVersion = {
  id: string; version: number; status: 'DRAFT' | 'FINAL'; title: string | null; note: string | null; ratesSource: string | null; updatedAt: string; finalizedAt: string | null;
  head: CalcHeader;
  items: { ref: string; kind: CalcKind; laborCategory: LaborCategory | null; description: string; partNumber: string | null; partId: string | null; damageId: string | null; quantityX100: number; minutes: number; unitPriceCents: number; discountBp: number; priceSource: string | null; priceDate: string | null; note: string | null }[];
};

type Unit = 'AW' | 'MIN' | 'H';
type Row = {
  key: string; ref?: string; kind: CalcKind; laborCategory: LaborCategory; description: string; partNumber: string; partId: string | null; damageId: string | null;
  qty: string; time: string; unit: Unit; price: string; discount: string; priceSource: string; priceDate: string; note: string;
};
type HeadForm = { title: string; note: string; vat: string; minutesPerAw: string; body: string; mechanic: string; electric: string; paint: string; markup: string; paintMat: string; ratesSource: string };

const num = (s: string): number => (s.trim() === '' ? 0 : Number(s.replace(/\./g, '').replace(',', '.')));
const dec = (s: string): number => (s.trim() === '' ? 0 : Number(s.replace(',', '.')));
const pct = (bp: number) => String(bp / 100).replace('.', ',');
const fmtNum = (n: number, max = 2) => n.toLocaleString('de-DE', { maximumFractionDigits: max });

function rowFrom(i: CalcVersion['items'][number], minutesPerAw: number): Row {
  const aw = i.minutes / minutesPerAw;
  return {
    key: i.ref, ref: i.ref, kind: i.kind, laborCategory: i.laborCategory ?? 'BODY', description: i.description, partNumber: i.partNumber ?? '', partId: i.partId, damageId: i.damageId,
    qty: String(i.quantityX100 / 100).replace('.', ','), time: i.minutes ? String(Math.round(aw * 100) / 100).replace('.', ',') : '', unit: 'AW',
    price: i.unitPriceCents ? centsToInput(i.unitPriceCents) : '', discount: i.discountBp ? pct(i.discountBp) : '', priceSource: i.priceSource ?? '', priceDate: i.priceDate ?? '', note: i.note ?? '',
  };
}
const headFrom = (v: CalcVersion): HeadForm => ({
  title: v.title ?? '', note: v.note ?? '', vat: pct(v.head.vatBp), minutesPerAw: String(v.head.minutesPerAw), body: v.head.rates.body == null ? '' : centsToInput(v.head.rates.body),
  mechanic: v.head.rates.mechanic == null ? '' : centsToInput(v.head.rates.mechanic), electric: v.head.rates.electric == null ? '' : centsToInput(v.head.rates.electric),
  paint: v.head.rates.paint == null ? '' : centsToInput(v.head.rates.paint), markup: pct(v.head.partsMarkupBp), paintMat: pct(v.head.paintMaterialBp), ratesSource: v.ratesSource ?? '',
});

const rateIn = (s: string): number | null => { const c = parseEuroToCents(s); return c == null || Number.isNaN(c) ? null : c; };
const toMinutes = (r: Row, mpa: number): number => {
  const v = dec(r.time);
  return Math.max(0, Math.round(r.unit === 'AW' ? awToMinutes(v, mpa) : r.unit === 'H' ? v * 60 : v));
};

function parseHead(h: HeadForm): CalcHeader & { valid: boolean } {
  const bp = (s: string) => Math.round(dec(s) * 100);
  const mpa = Math.round(dec(h.minutesPerAw));
  const vat = bp(h.vat), markup = bp(h.markup), pm = bp(h.paintMat);
  const valid = [vat, markup, pm].every((n) => Number.isFinite(n) && n >= 0) && mpa >= 1 && mpa <= 60;
  return { vatBp: vat, minutesPerAw: mpa >= 1 ? mpa : 5, partsMarkupBp: markup, paintMaterialBp: pm, rates: { body: rateIn(h.body), mechanic: rateIn(h.mechanic), electric: rateIn(h.electric), paint: rateIn(h.paint) }, valid };
}
function parseRow(r: Row, mpa: number): CalcLine & { valid: boolean } {
  const price = parseEuroToCents(r.price);
  const valid = Number.isFinite(dec(r.qty)) && Number.isFinite(dec(r.time)) && (price == null || !Number.isNaN(price)) && Number.isFinite(dec(r.discount));
  return {
    kind: r.kind, laborCategory: r.kind === 'LABOR' ? r.laborCategory : null, quantityX100: Math.round(dec(r.qty) * 100), minutes: r.kind === 'LABOR' || r.kind === 'PAINT' ? toMinutes(r, mpa) : 0,
    unitPriceCents: price && !Number.isNaN(price) ? price : 0, discountBp: Math.round(dec(r.discount) * 100), valid,
  };
}

const newRow = (kind: CalcKind): Row => ({ key: `n${Math.random().toString(36).slice(2, 10)}`, kind, laborCategory: 'BODY', description: '', partNumber: '', partId: null, damageId: null, qty: '1', time: '', unit: 'AW', price: '', discount: '', priceSource: '', priceDate: '', note: '' });

/* ------------------------------------------------------------ Komponente */

export function CalcEditor({ caseId, caseNumber, versions, canWrite, hasWorkshopRates }: { caseId: string; caseNumber: string; versions: CalcVersion[]; canWrite: boolean; hasWorkshopRates: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [sel, setSel] = useState<number>(versions.at(-1)?.version ?? 0);
  const [cmp, setCmp] = useState<number | null>(null);
  const cur = versions.find((v) => v.version === sel) ?? versions.at(-1) ?? null;
  // Zwischenspeicher: Beim Wechseln zwischen Versionen gehen lokale (bereits automatisch gespeicherte) Stände nicht verloren, auch bevor die Seite neu geladen wurde
  const store = useRef(new Map<string, Snap>());
  const [tick, setTick] = useState(0);
  const bumpTick = useCallback(() => setTick((n) => n + 1), []);

  if (!cur) {
    return (
      <div className="adm-card" style={{ display: 'grid', gap: 10, justifyItems: 'start' }}>
        <b>Noch keine Kalkulation</b>
        <p className="vi-hint" style={{ margin: 0 }}>Positionen, Arbeitswerte, Stundensätze und Summen werden hier erfasst. Stundensätze kommen – falls hinterlegt – aus der Werkstatt des Falls{hasWorkshopRates ? ' (hinterlegt)' : ' (keine Werkstatt mit Sätzen zugeordnet; die Sätze müssen dann von Hand eingetragen werden)'}.</p>
        {canWrite ? <button type="button" className="adm-btn" disabled={pending} onClick={() => startTransition(async () => { const r = await createCalcAction({ caseId, caseNumber }); toast(r.ok ? r.message ?? 'Angelegt.' : r.error ?? 'Das hat nicht geklappt.', r.ok ? 'ok' : 'error'); if (r.ok) router.refresh(); })}><AdminIcon name="plus" />Kalkulation anlegen</button> : <p className="vi-hint">Keine Berechtigung zum Anlegen.</p>}
      </div>
    );
  }

  const draftExists = versions.some((v) => v.status === 'DRAFT');
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="dm-toolbar">
        <div className="vi-modes" role="group" aria-label="Version">
          {versions.map((v) => <button key={v.id} type="button" aria-pressed={sel === v.version} onClick={() => { setSel(v.version); setCmp(null); }}>V{v.version} · {v.status === 'FINAL' ? 'Freigegeben' : 'Entwurf'}</button>)}
        </div>
        <div className="adm-actions">
          {versions.length > 1 && (
            <label className="calc-cmp">Vergleichen mit
              <select className="adm-input" value={cmp ?? ''} onChange={(e) => setCmp(e.target.value ? Number(e.target.value) : null)}>
                <option value="">–</option>{versions.filter((v) => v.version !== cur.version).map((v) => <option key={v.id} value={v.version}>V{v.version}</option>)}
              </select>
            </label>
          )}
          {canWrite && !draftExists && (
            <button type="button" className="adm-btn adm-btn-secondary" disabled={pending} onClick={() => startTransition(async () => { const r = await createCalcAction({ caseId, caseNumber, fromVersion: cur.version }); toast(r.ok ? r.message ?? 'Angelegt.' : r.error ?? 'Das hat nicht geklappt.', r.ok ? 'ok' : 'error'); if (r.ok) { setSel(r.version ?? sel); router.refresh(); } })}><AdminIcon name="plus" />Neue Version aus V{cur.version}</button>
          )}
        </div>
      </div>
      {cmp !== null && <DiffView a={liveVersion(versions.find((v) => v.version === cmp)!, store.current.get(versions.find((v) => v.version === cmp)!.id))} b={liveVersion(cur, store.current.get(cur.id))} tick={tick} />}
      <Editor key={`${cur.id}-${cur.status}`} store={store} onSaved={bumpTick} v={cur} caseNumber={caseNumber} canWrite={canWrite && cur.status === 'DRAFT'} onChanged={() => router.refresh()} />
    </div>
  );
}

/* ------------------------------------------------------------ Editor einer Version */

type Snap = { head: HeadForm; rows: Row[]; token: string };

/** Aktueller (ggf. noch nicht neu geladener) Stand eines Entwurfs aus dem lokalen Zwischenspeicher – Grundlage für den Versionsvergleich. */
function liveVersion(v: CalcVersion, snap: Snap | undefined): CalcVersion {
  if (!snap || v.status !== 'DRAFT' || snap.token < v.updatedAt) return v;
  const h = parseHead(snap.head);
  return {
    ...v, head: { vatBp: h.vatBp, minutesPerAw: h.minutesPerAw, partsMarkupBp: h.partsMarkupBp, paintMaterialBp: h.paintMaterialBp, rates: h.rates },
    items: snap.rows.map((r) => { const l = parseRow(r, h.minutesPerAw); return { ref: r.ref ?? r.key, kind: l.kind, laborCategory: l.laborCategory ?? null, description: r.description.trim() || '(ohne Bezeichnung)', partNumber: r.partNumber || null, partId: r.partId, damageId: r.damageId, quantityX100: l.quantityX100, minutes: l.minutes, unitPriceCents: l.unitPriceCents, discountBp: l.discountBp, priceSource: r.priceSource || null, priceDate: r.priceDate || null, note: r.note || null }; }),
  };
}

function Editor({ v, store, onSaved, caseNumber, canWrite, onChanged }: { v: CalcVersion; store: { current: Map<string, Snap> }; onSaved: () => void; caseNumber: string; canWrite: boolean; onChanged: () => void }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const snap = store.current.get(v.id);
  const fromSnap = snap && snap.token >= v.updatedAt && v.status === 'DRAFT';
  const [head, setHead] = useState<HeadForm>(() => (fromSnap ? snap!.head : headFrom(v)));
  const [rows, setRows] = useState<Row[]>(() => (fromSnap ? snap!.rows : v.items.map((i) => rowFrom(i, v.head.minutesPerAw))));
  const [save, setSave] = useState<{ state: 'saved' | 'dirty' | 'saving' | 'error'; at?: string; error?: string }>({ state: 'saved', at: fromSnap ? snap!.token : v.updatedAt });
  const token = useRef(fromSnap ? snap!.token : v.updatedAt);
  const dirty = useRef(false);
  const [showHead, setShowHead] = useState(false);

  const ph = useMemo(() => parseHead(head), [head]);
  const lines = useMemo(() => rows.map((r) => ({ ...parseRow(r, ph.minutesPerAw), row: r })), [rows, ph.minutesPerAw]);
  const t = useMemo(() => totals(lines, ph), [lines, ph]);
  const allValid = ph.valid && lines.every((l) => l.valid && l.row.description.trim() !== '');

  useEffect(() => { store.current.set(v.id, { head, rows, token: token.current }); });
  const touch = () => { dirty.current = true; setSave((s) => ({ ...s, state: 'dirty' })); };
  const setRow = (key: string, patch: Partial<Row>) => { setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r))); touch(); };
  const setH = (patch: Partial<HeadForm>) => { setHead((h) => ({ ...h, ...patch })); touch(); };

  const payload = useCallback(() => ({
    title: head.title, note: head.note, vatBp: ph.vatBp, minutesPerAw: ph.minutesPerAw, partsMarkupBp: ph.partsMarkupBp, paintMaterialBp: ph.paintMaterialBp, ratesSource: head.ratesSource,
    rateBodyCents: ph.rates.body, rateMechanicCents: ph.rates.mechanic, rateElectricCents: ph.rates.electric, ratePaintCents: ph.rates.paint,
    items: lines.map((l) => ({ ref: l.row.ref, kind: l.kind, laborCategory: l.kind === 'LABOR' ? l.laborCategory ?? 'BODY' : null, description: l.row.description.trim(), partNumber: l.row.partNumber, partId: l.row.partId, damageId: l.row.damageId, quantityX100: l.quantityX100, minutes: l.minutes, unitPriceCents: l.unitPriceCents, discountBp: l.discountBp, priceSource: l.row.priceSource, priceDate: l.row.priceDate || null, note: l.row.note })),
  }), [head, ph, lines]);

  const doSave = useCallback(async () => {
    if (!dirty.current || !allValid) return;
    dirty.current = false;
    setSave((s) => ({ ...s, state: 'saving' }));
    const r = await saveCalcAction({ calcId: v.id, caseNumber, data: payload(), token: token.current });
    if (r.ok) { token.current = r.updatedAt!; setSave({ state: dirty.current ? 'dirty' : 'saved', at: r.updatedAt }); onSaved(); }
    else { dirty.current = true; setSave({ state: 'error', error: r.error }); }
  }, [v.id, caseNumber, payload, allValid, onSaved]);

  // Autosave: 900 ms nach der letzten Änderung
  useEffect(() => {
    if (!canWrite || save.state !== 'dirty') return;
    const t2 = setTimeout(() => { void doSave(); }, 900);
    return () => clearTimeout(t2);
  }, [canWrite, save.state, doSave, rows, head]);
  // Warnung beim Verlassen mit ungespeicherten Änderungen
  useEffect(() => {
    const on = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', on);
    return () => window.removeEventListener('beforeunload', on);
  }, []);

  const flush = async () => { dirty.current = true; await doSave(); };
  const act = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) => startTransition(async () => {
    const r = await fn();
    toast(r.ok ? r.message ?? 'Erledigt.' : r.error ?? 'Das hat nicht geklappt.', r.ok ? 'ok' : 'error');
    if (r.ok) { after?.(); onChanged(); }
  });

  const move = (key: string, d: -1 | 1) => { setRows((rs) => { const i = rs.findIndex((r) => r.key === key); const j = i + d; if (i < 0 || j < 0 || j >= rs.length) return rs; const c = [...rs]; [c[i], c[j]] = [c[j], c[i]]; return c; }); touch(); };
  const missing = t.missingRates;

  const group = (kind: CalcKind) => {
    const list = lines.filter((l) => l.kind === kind);
    return (
      <section key={kind} className="calc-group" aria-label={KIND_LABELS[kind]}>
        <header><b>{KIND_LABELS[kind]}</b><span className="t-3">{list.length} {list.length === 1 ? 'Position' : 'Positionen'}</span><span className="grow" /><b className="mono">{fmtEuro(list.reduce((n, l) => n + lineTotal(l, ph.rates), 0))}</b></header>
        {list.length > 0 && (
          <div className="calc-table-wrap">
            <table className="calc-table">
              <thead><tr><th>#</th><th>Bezeichnung</th>{kind === 'LABOR' && <th>Kategorie</th>}{kind === 'PART' && <th>Teile-Nr.</th>}<th className="r">{kind === 'LABOR' || kind === 'PAINT' ? 'Zeit' : 'Menge'}</th><th className="r">{kind === 'LABOR' || kind === 'PAINT' ? 'Stundensatz' : 'Einzelpreis (netto)'}</th>{(kind === 'PART' || kind === 'MISC') && <th className="r">Rabatt %</th>}<th className="r">Summe</th>{canWrite && <th />}</tr></thead>
              <tbody>
                {list.map((l, idx) => {
                  const r = l.row;
                  const rate = rateFor(l, ph.rates);
                  const bad = missingRate(l, ph.rates);
                  return (
                    <tr key={r.key} className={!l.valid ? 'is-bad' : undefined}>
                      <td className="t-3" data-label="#">{rows.indexOf(r) + 1}</td>
                      <td data-label="Bezeichnung">
                        <input className="adm-input" value={r.description} disabled={!canWrite} maxLength={200} aria-label="Bezeichnung" aria-invalid={r.description.trim() === ''} placeholder="z. B. Stoßfänger vorn" onChange={(e) => setRow(r.key, { description: e.target.value })} />
                        {(r.priceSource || r.damageId || r.partId) && <span className="t-3 calc-sub">{[r.partId ? 'Bauteil der Schadenkarte' : null, r.damageId ? 'aus Schaden' : null, r.priceSource ? `Quelle: ${r.priceSource}${r.priceDate ? ` (${r.priceDate.split('-').reverse().join('.')})` : ''}` : null].filter(Boolean).join(' · ')}</span>}
                      </td>
                      {kind === 'LABOR' && <td data-label="Kategorie"><select className="adm-input" value={r.laborCategory} disabled={!canWrite} aria-label="Kategorie" onChange={(e) => setRow(r.key, { laborCategory: e.target.value as LaborCategory })}>{LABOR_CATEGORIES.map((c) => <option key={c} value={c}>{LABOR_LABELS[c]}</option>)}</select></td>}
                      {kind === 'PART' && <td data-label="Teile-Nr."><input className="adm-input mono" value={r.partNumber} disabled={!canWrite} maxLength={60} aria-label="Teilenummer" onChange={(e) => setRow(r.key, { partNumber: e.target.value })} /></td>}
                      {kind === 'LABOR' || kind === 'PAINT' ? (
                        <td className="r" data-label="Zeit">
                          <span className="calc-time"><input className="adm-input r" inputMode="decimal" value={r.time} disabled={!canWrite} aria-label="Zeit" aria-invalid={!Number.isFinite(dec(r.time))} onChange={(e) => setRow(r.key, { time: e.target.value })} />
                            <select className="adm-input" value={r.unit} disabled={!canWrite} aria-label="Einheit" onChange={(e) => { const nu = e.target.value as Unit; const mins = toMinutes(r, ph.minutesPerAw); const nv = nu === 'AW' ? minutesToAw(mins, ph.minutesPerAw) : nu === 'H' ? mins / 60 : mins; setRow(r.key, { unit: nu, time: mins ? String(Math.round(nv * 100) / 100).replace('.', ',') : '' }); }}><option value="AW">AW</option><option value="MIN">Min</option><option value="H">Std</option></select></span>
                          {l.minutes > 0 && <span className="t-3 calc-sub">{fmtNum(minutesToAw(l.minutes, ph.minutesPerAw), 1)} AW · {l.minutes} Min · {fmtNum(l.minutes / 60)} h</span>}
                        </td>
                      ) : (
                        <td className="r" data-label="Menge"><input className="adm-input r" inputMode="decimal" value={r.qty} disabled={!canWrite} aria-label="Menge" onChange={(e) => setRow(r.key, { qty: e.target.value })} /></td>
                      )}
                      {kind === 'LABOR' || kind === 'PAINT' ? (
                        <td className="r mono" data-label="Stundensatz">{rate == null ? <span className="calc-warn">fehlt</span> : fmtEuro(rate)}{bad && <span className="sr-only"> Stundensatz fehlt</span>}</td>
                      ) : (
                        <td className="r" data-label="Einzelpreis"><input className="adm-input r" inputMode="decimal" value={r.price} disabled={!canWrite} aria-label="Einzelpreis netto" aria-invalid={Number.isNaN(parseEuroToCents(r.price))} placeholder="0,00" onChange={(e) => setRow(r.key, { price: e.target.value })} /></td>
                      )}
                      {(kind === 'PART' || kind === 'MISC') && <td className="r" data-label="Rabatt"><input className="adm-input r" inputMode="decimal" value={r.discount} disabled={!canWrite} aria-label="Rabatt in Prozent" onChange={(e) => setRow(r.key, { discount: e.target.value })} /></td>}
                      <td className="r mono b" data-label="Summe">{fmtEuro(lineTotal(l, ph.rates))}</td>
                      {canWrite && (
                        <td className="calc-act">
                          <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" aria-label="Nach oben" disabled={idx === 0} onClick={() => move(r.key, -1)}>↑</button>
                          <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" aria-label="Nach unten" disabled={idx === list.length - 1} onClick={() => move(r.key, 1)}>↓</button>
                          <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" aria-label="Position löschen" onClick={() => { setRows((rs) => rs.filter((x) => x.key !== r.key)); touch(); }}>✕</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {canWrite && <button type="button" className="adm-btn adm-btn-secondary adm-btn-sm" style={{ justifySelf: 'start' }} onClick={() => { setRows((rs) => [...rs, newRow(kind)]); touch(); }}><AdminIcon name="plus" />{kind === 'PART' ? 'Teil' : kind === 'LABOR' ? 'Arbeitsposition' : kind === 'PAINT' ? 'Lackposition' : 'Nebenkosten'}</button>}
      </section>
    );
  };

  return (
    <div className="calc">
      <div className="calc-main">
        <div className="calc-bar adm-card">
          <div className="calc-bar-l">
            <b>Version {v.version}</b>
            <span className={`adm-badge adm-badge-${v.status === 'FINAL' ? 'ok' : 'info'}`}>{v.status === 'FINAL' ? 'Freigegeben' : 'Entwurf'}</span>
            {v.status === 'FINAL' && v.finalizedAt && <span className="t-3" style={{ fontSize: 12.5 }}>am {new Date(v.finalizedAt).toLocaleDateString('de-DE')} – unveränderlich</span>}
            {canWrite && <span className={`calc-save calc-save-${save.state}`} aria-live="polite">{save.state === 'saving' ? 'Speichert …' : save.state === 'dirty' ? 'Ungespeicherte Änderungen' : save.state === 'error' ? `Nicht gespeichert: ${save.error ?? ''}` : save.at ? `Gespeichert ${new Date(save.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>}
          </div>
          <div className="adm-actions">
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setShowHead((s) => !s)} aria-expanded={showHead}>Sätze & Einstellungen</button>
            {canWrite && <button type="button" className="adm-btn adm-btn-secondary" disabled={pending} onClick={() => act(async () => { await flush(); const r = await suggestCalcAction({ calcId: v.id, caseNumber }); if (r.ok && r.added?.length) { token.current = r.updatedAt!; setRows((rs) => [...rs, ...r.added!.map((a): Row => ({ ...newRow(a.kind as CalcKind), key: a.ref, ref: a.ref, qty: '1', laborCategory: (a.laborCategory as LaborCategory | null) ?? 'BODY', description: a.description, partId: a.partId, damageId: a.damageId }))]); setSave({ state: 'saved', at: r.updatedAt }); } return r; })}>Aus Schäden vorschlagen</button>}
            <button type="button" className="adm-btn adm-btn-ghost" onClick={() => window.print()}>Drucken</button>
          </div>
        </div>

        {showHead && (
          <div className="adm-card calc-head">
            {ph.rates.body == null && ph.rates.mechanic == null && ph.rates.electric == null && ph.rates.paint == null && <div className="adm-alert adm-alert-warn" role="status"><AdminIcon name="alert" />Es sind noch keine Stundensätze hinterlegt. Arbeitspositionen werden erst mit Stundensatz berechnet (Quelle z. B. Werkstatt-Stammdaten).</div>}
            <div className="adm-form-grid">
              {([['body', 'Karosserie'], ['mechanic', 'Mechanik'], ['electric', 'Elektrik'], ['paint', 'Lackierung']] as const).map(([k, l]) => (
                <label key={k} className="adm-field"><span className="adm-label">Stundensatz {l} (€/h, netto)</span><input className="adm-input" inputMode="decimal" value={head[k]} disabled={!canWrite} onChange={(e) => setH({ [k]: e.target.value, ratesSource: 'manuell' })} placeholder="nicht festgelegt" aria-invalid={Number.isNaN(parseEuroToCents(head[k]))} /></label>
              ))}
              <label className="adm-field"><span className="adm-label">Minuten je AW</span><input className="adm-input" inputMode="numeric" value={head.minutesPerAw} disabled={!canWrite} onChange={(e) => setH({ minutesPerAw: e.target.value })} aria-invalid={!ph.valid} /></label>
              <label className="adm-field"><span className="adm-label">MwSt (%)</span>
                <select className="adm-input" value={head.vat} disabled={!canWrite} onChange={(e) => setH({ vat: e.target.value })}><option value="19">19 %</option><option value="7">7 %</option><option value="0">0 % (ohne MwSt / vorsteuerabzugsberechtigt)</option>{!['19', '7', '0'].includes(head.vat) && <option value={head.vat}>{head.vat} %</option>}</select></label>
              <label className="adm-field"><span className="adm-label">Teile-Aufschlag (%)</span><input className="adm-input" inputMode="decimal" value={head.markup} disabled={!canWrite} onChange={(e) => setH({ markup: e.target.value })} /></label>
              <label className="adm-field"><span className="adm-label">Lackmaterial (% der Lackarbeit)</span><input className="adm-input" inputMode="decimal" value={head.paintMat} disabled={!canWrite} onChange={(e) => setH({ paintMat: e.target.value })} /></label>
              <label className="adm-field"><span className="adm-label">Titel (optional)</span><input className="adm-input" value={head.title} disabled={!canWrite} maxLength={120} onChange={(e) => setH({ title: e.target.value })} /></label>
            </div>
            <label className="adm-field"><span className="adm-label">Hinweise zur Kalkulation</span><textarea className="adm-input" rows={2} value={head.note} disabled={!canWrite} maxLength={2000} onChange={(e) => setH({ note: e.target.value })} /></label>
            <p className="vi-hint">Quelle der Sätze: {head.ratesSource || 'nicht angegeben'}. Die Sätze gelten nur für diese Version – spätere Änderungen an den Stammdaten ändern sie nicht.</p>
          </div>
        )}

        {rows.length === 0 && <div className="adm-card"><p className="vi-hint" style={{ margin: 0 }}>Noch keine Positionen. Mit „Aus Schäden vorschlagen“ übernehmen Sie die erfassten Schäden als Positionen (ohne Zeiten und Preise) oder legen Positionen von Hand an.</p></div>}
        {CALC_KINDS.map(group)}
      </div>

      <aside className="calc-sum adm-card" aria-label="Summen">
        <b>Zusammenfassung</b>
        <dl>
          <dt>Ersatzteile</dt><dd>{fmtEuro(t.parts)}</dd>
          {t.partsMarkup > 0 && <><dt>Teile-Aufschlag</dt><dd>{fmtEuro(t.partsMarkup)}</dd></>}
          <dt>Arbeitslohn</dt><dd>{fmtEuro(t.labor)}</dd>
          {t.laborBody > 0 && (t.laborMechanic > 0 || t.laborElectric > 0) && <><dt className="sub">davon Karosserie</dt><dd className="sub">{fmtEuro(t.laborBody)}</dd></>}
          {t.laborMechanic > 0 && <><dt className="sub">davon Mechanik</dt><dd className="sub">{fmtEuro(t.laborMechanic)}</dd></>}
          {t.laborElectric > 0 && <><dt className="sub">davon Elektrik</dt><dd className="sub">{fmtEuro(t.laborElectric)}</dd></>}
          <dt>Lackierarbeit</dt><dd>{fmtEuro(t.paintLabor)}</dd>
          {t.paintMaterial > 0 && <><dt>Lackmaterial</dt><dd>{fmtEuro(t.paintMaterial)}</dd></>}
          {t.misc > 0 && <><dt>Nebenkosten</dt><dd>{fmtEuro(t.misc)}</dd></>}
          <dt className="tot">Netto</dt><dd className="tot">{fmtEuro(t.net)}</dd>
          <dt>MwSt {pct(ph.vatBp)} %</dt><dd>{fmtEuro(t.vat)}</dd>
          <dt className="grand">Brutto</dt><dd className="grand">{fmtEuro(t.gross)}</dd>
        </dl>
        <div className="calc-meta">
          <span>Arbeitszeit gesamt</span><b>{fmtNum(t.aw, 1)} AW · {fmtNum(t.minutes / 60)} h</b>
        </div>
        {missing > 0 && <div className="adm-alert adm-alert-warn" role="status"><AdminIcon name="alert" />Für {missing} Arbeitsposition(en) fehlt der Stundensatz – sie sind mit 0 € eingerechnet.</div>}
        {!allValid && <div className="adm-alert adm-alert-danger" role="alert"><AdminIcon name="alert" />Es gibt ungültige oder leere Eingaben – Autosave pausiert, bis alles korrekt ist.</div>}
        {canWrite && (
          <div className="calc-final">
            <button type="button" className="adm-btn" disabled={pending || !allValid || rows.length === 0} onClick={() => { if (window.confirm(`Version ${v.version} freigeben? Sie kann danach nicht mehr geändert werden (Änderungen = neue Version).`)) act(async () => { await flush(); return finalizeCalcAction({ calcId: v.id, caseNumber }); }); }}>Version freigeben</button>
            {v.version > 1 || true ? <button type="button" className="adm-btn adm-btn-ghost" disabled={pending} onClick={() => { if (window.confirm('Entwurf wirklich verwerfen?')) act(() => deleteDraftAction({ calcId: v.id, caseNumber })); }}>Entwurf verwerfen</button> : null}
          </div>
        )}
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------ Versionsvergleich */

function DiffView({ a, b }: { a: CalcVersion; b: CalcVersion; tick?: number }) {
  const [x, y] = a.version < b.version ? [a, b] : [b, a];
  const d = useMemo(() => diffCalculations({ items: x.items, head: x.head }, { items: y.items, head: y.head }), [x, y]);
  const delta = d.netAfter - d.netBefore;
  return (
    <section className="adm-card calc-diff" aria-label="Versionsvergleich">
      <header><b>Vergleich V{x.version} → V{y.version}</b><span className={delta === 0 ? 't-3' : delta > 0 ? 'calc-up' : 'calc-down'}>{delta === 0 ? 'Netto unverändert' : `Netto ${delta > 0 ? '+' : ''}${fmtEuro(delta)}`}</span></header>
      <p className="vi-hint">Netto {fmtEuro(d.netBefore)} → {fmtEuro(d.netAfter)} · Brutto {fmtEuro(d.grossBefore)} → {fmtEuro(d.grossAfter)} · {d.unchanged} unverändert</p>
      {d.added.length + d.removed.length + d.changed.length === 0 ? <p className="vi-hint">Keine Unterschiede in den Positionen.</p> : (
        <table className="vi-prov"><thead><tr><th>Änderung</th><th>Position</th><th>Details</th><th className="r">Auswirkung (netto)</th></tr></thead><tbody>
          {d.added.map((i) => <tr key={i.ref}><td><span className="adm-badge adm-badge-ok">neu</span></td><td>{i.description}</td><td className="t-3">{KIND_LABELS[i.kind]}</td><td className="r mono">+{fmtEuro(i.totalCents)}</td></tr>)}
          {d.removed.map((i) => <tr key={i.ref}><td><span className="adm-badge adm-badge-danger">entfallen</span></td><td>{i.description}</td><td className="t-3">{KIND_LABELS[i.kind]}</td><td className="r mono">−{fmtEuro(i.totalCents)}</td></tr>)}
          {d.changed.map((i) => <tr key={i.ref}><td><span className="adm-badge adm-badge-warn">geändert</span></td><td>{i.description}</td><td className="t-3">{i.fields.join(', ') || 'Satz/Einstellungen'}</td><td className="r mono">{i.deltaCents > 0 ? '+' : ''}{fmtEuro(i.deltaCents)}</td></tr>)}
        </tbody></table>
      )}
    </section>
  );
}
