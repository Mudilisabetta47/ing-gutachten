'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { AdminIcon } from './AdminIcon';
import { useToast } from './Toast';
import { Badge } from './ui';
import { addPaymentAction, cancelDunningAction, cancelInvoiceAction, createDunningAction, deleteDraftAction, issueDunningAction, issueInvoiceAction, reversePaymentAction, saveInvoiceAction, type InvResult } from '@/app/admin/(panel)/faelle/invoice-actions';
import { DUNNING_LABELS, STATE_LABELS, STATE_TONE, deDate, invoiceTotals, itemNet, nextDunningLevel, type InvoiceState } from '@/lib/invoice';
import { centsToInput, fmtEuro, fmtPercent, parseEuroToCents } from '@/lib/money';

export type IView = {
  id: string; caseNumber: string | null; number: string | null; status: 'DRAFT' | 'ISSUED' | 'CANCELLED'; state: InvoiceState;
  recipient: { name: string; street: string | null; postalCode: string | null; city: string | null; orgId: string | null; ref: string | null };
  serviceDate: string | null; issueDate: string | null; dueDate: string | null; paymentTermsDays: number; introText: string | null; footerText: string | null;
  items: { description: string; quantityX100: number; unit: string | null; unitPriceCents: number; vatBp: number; serviceId: string | null }[];
  totals: { netCents: number; vatCents: number; grossCents: number; groups: { vatBp: number; netCents: number; vatCents: number }[] };
  paidCents: number; openCents: number; cancelReason: string | null;
  payments: { id: string; amountCents: number; paidOn: string; method: string; reference: string | null; note: string | null; reversed: boolean; reverseReason: string | null }[];
  dunnings: { id: string; level: number; status: 'DRAFT' | 'ISSUED' | 'CANCELLED'; issueDate: string | null; dueDate: string | null; feeCents: number; interestCents: number; text: string | null }[];
};
export type ServiceOpt = { id: string; name: string; unit: string | null; unitPriceCents: number; vatBp: number };
type Row = { description: string; qty: string; unit: string; price: string; vat: string; serviceId: string | null };

const today = () => new Date().toISOString().slice(0, 10);
const METHODS: [string, string][] = [['BANK', 'Überweisung'], ['CASH', 'Bar'], ['CARD', 'Karte'], ['OFFSET', 'Verrechnung'], ['OTHER', 'Sonstiges']];
const toRow = (i: IView['items'][number]): Row => ({ description: i.description, qty: String(i.quantityX100 / 100).replace('.', ','), unit: i.unit ?? '', price: centsToInput(i.unitPriceCents), vat: String(i.vatBp / 100).replace('.', ','), serviceId: i.serviceId });
const num = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));
function parseRows(rows: Row[]) {
  return rows.map((r) => ({ description: r.description.trim(), quantityX100: Math.round(num(r.qty) * 100), unit: r.unit.trim() || null, unitPriceCents: parseEuroToCents(r.price), vatBp: Math.round(num(r.vat) * 100), serviceId: r.serviceId }));
}
const METHOD_LABEL = Object.fromEntries(METHODS);

export function InvoicePanel({ inv, services, canWrite, canPay, canDunning, caseNumber }: { inv: IView; services: ServiceOpt[]; canWrite: boolean; canPay: boolean; canDunning: boolean; caseNumber: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<InvResult>, ok?: (r: InvResult) => void) => start(async () => {
    const r = await fn();
    toast(r.ok ? r.message ?? 'Gespeichert.' : r.error ?? 'Das hat nicht geklappt.', r.ok ? 'ok' : 'error');
    if (r.ok) { ok?.(r); router.refresh(); }
  });
  return inv.status === 'DRAFT'
    ? <Draft inv={inv} services={services} canWrite={canWrite} pending={pending} run={run} caseNumber={caseNumber} />
    : <Issued inv={inv} canWrite={canWrite} canPay={canPay} canDunning={canDunning} pending={pending} run={run} caseNumber={caseNumber} />;
}

type RunFn = (fn: () => Promise<InvResult>, ok?: (r: InvResult) => void) => void;

function Draft({ inv, services, canWrite, pending, run, caseNumber }: { inv: IView; services: ServiceOpt[]; canWrite: boolean; pending: boolean; run: RunFn; caseNumber: string | null }) {
  const [rcp, setRcp] = useState({ name: inv.recipient.name, street: inv.recipient.street ?? '', postalCode: inv.recipient.postalCode ?? '', city: inv.recipient.city ?? '', ref: inv.recipient.ref ?? '' });
  const [serviceDate, setServiceDate] = useState(inv.serviceDate ?? '');
  const [terms, setTerms] = useState(String(inv.paymentTermsDays));
  const [intro, setIntro] = useState(inv.introText ?? '');
  const [footer, setFooter] = useState(inv.footerText ?? '');
  const [rows, setRows] = useState<Row[]>(inv.items.map(toRow));
  const [err, setErr] = useState<string | null>(null);

  const parsed = useMemo(() => parseRows(rows), [rows]);
  const valid = parsed.every((p) => p.description && Number.isFinite(p.quantityX100) && p.quantityX100 > 0 && p.unitPriceCents != null && Number.isFinite(p.unitPriceCents) && Number.isFinite(p.vatBp));
  const totals = useMemo(() => invoiceTotals(parsed.filter((p) => p.unitPriceCents != null && Number.isFinite(p.unitPriceCents) && Number.isFinite(p.quantityX100) && Number.isFinite(p.vatBp)).map((p) => ({ quantityX100: p.quantityX100, unitPriceCents: p.unitPriceCents!, vatBp: p.vatBp }))), [parsed]);
  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  const draft = () => ({ recipient: { name: rcp.name, street: rcp.street, postalCode: rcp.postalCode, city: rcp.city, ref: rcp.ref, orgId: inv.recipient.orgId }, serviceDate: serviceDate || null, paymentTermsDays: Number(terms) || 0, introText: intro, footerText: footer, items: parsed.map((p) => ({ ...p, unitPriceCents: p.unitPriceCents ?? 0 })) });
  const guard = (): boolean => { if (!valid) { setErr('Bitte alle Positionen vollständig und mit gültigen Zahlen ausfüllen.'); return false; } setErr(null); return true; };
  const addService = (id: string) => {
    const s = services.find((x) => x.id === id);
    if (s) setRows((r) => [...r, { description: s.name, qty: '1', unit: s.unit ?? '', price: centsToInput(s.unitPriceCents), vat: String(s.vatBp / 100).replace('.', ','), serviceId: s.id }]);
  };
  const dis = !canWrite || pending;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <fieldset disabled={dis} className="adm-fieldset">
        <div className="adm-form-grid">
          <label className="adm-field"><span className="adm-label">Empfänger</span><input className="adm-input" value={rcp.name} maxLength={160} onChange={(e) => setRcp({ ...rcp, name: e.target.value })} /></label>
          <label className="adm-field"><span className="adm-label">Ihr Zeichen / Schadennummer</span><input className="adm-input" value={rcp.ref} maxLength={120} onChange={(e) => setRcp({ ...rcp, ref: e.target.value })} /></label>
          <label className="adm-field"><span className="adm-label">Straße</span><input className="adm-input" value={rcp.street} maxLength={160} onChange={(e) => setRcp({ ...rcp, street: e.target.value })} /></label>
          <div className="adm-form-grid" style={{ gridTemplateColumns: '110px 1fr' }}>
            <label className="adm-field"><span className="adm-label">PLZ</span><input className="adm-input" value={rcp.postalCode} maxLength={10} onChange={(e) => setRcp({ ...rcp, postalCode: e.target.value })} /></label>
            <label className="adm-field"><span className="adm-label">Ort</span><input className="adm-input" value={rcp.city} maxLength={120} onChange={(e) => setRcp({ ...rcp, city: e.target.value })} /></label>
          </div>
          <label className="adm-field"><span className="adm-label">Leistungsdatum</span><input type="date" className="adm-input" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} /></label>
          <label className="adm-field"><span className="adm-label">Zahlungsziel (Tage)</span><input className="adm-input" inputMode="numeric" value={terms} onChange={(e) => setTerms(e.target.value.replace(/\D/g, ''))} /></label>
          <label className="adm-field span-2"><span className="adm-label">Einleitungstext (optional)</span><textarea className="adm-input" rows={2} value={intro} maxLength={3000} onChange={(e) => setIntro(e.target.value)} /></label>
        </div>

        <div className="dt-wrap" style={{ overflowX: 'auto' }}>
          <table className="dt inv-items" aria-label="Positionen">
            <thead><tr><th>Bezeichnung</th><th>Menge</th><th>Einheit</th><th>Einzelpreis (€)</th><th>MwSt. %</th><th className="num">Netto</th><th><span className="sr-only-adm">Entfernen</span></th></tr></thead>
            <tbody>{rows.map((r, i) => {
              const p = parsed[i];
              const n = p.unitPriceCents != null && Number.isFinite(p.unitPriceCents) && Number.isFinite(p.quantityX100) ? itemNet({ quantityX100: p.quantityX100, unitPriceCents: p.unitPriceCents }) : null;
              return (
                <tr key={i}>
                  <td><input className="adm-input" aria-label={`Bezeichnung Position ${i + 1}`} value={r.description} maxLength={300} onChange={(e) => set(i, { description: e.target.value })} /></td>
                  <td><input className="adm-input" style={{ width: 76 }} aria-label={`Menge Position ${i + 1}`} inputMode="decimal" value={r.qty} onChange={(e) => set(i, { qty: e.target.value })} /></td>
                  <td><input className="adm-input" style={{ width: 80 }} aria-label={`Einheit Position ${i + 1}`} value={r.unit} maxLength={20} onChange={(e) => set(i, { unit: e.target.value })} /></td>
                  <td><input className="adm-input" style={{ width: 110 }} aria-label={`Einzelpreis Position ${i + 1}`} inputMode="decimal" value={r.price} onChange={(e) => set(i, { price: e.target.value })} /></td>
                  <td><input className="adm-input" style={{ width: 70 }} aria-label={`MwSt Position ${i + 1}`} inputMode="decimal" value={r.vat} onChange={(e) => set(i, { vat: e.target.value })} /></td>
                  <td className="num nowrap">{n != null ? fmtEuro(n) : '–'}</td>
                  <td><button type="button" className="adm-btn adm-btn-ghost adm-btn-icon adm-btn-sm" aria-label={`Position ${i + 1} entfernen`} onClick={() => setRows((x) => x.filter((_, k) => k !== i))}><AdminIcon name="x" /></button></td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7} className="t-3" style={{ padding: 14 }}>Noch keine Positionen. Fügen Sie eine Zeile oder eine Leistung aus dem Katalog hinzu.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="adm-actions">
          <button type="button" className="adm-btn adm-btn-secondary adm-btn-sm" onClick={() => setRows((r) => [...r, { description: '', qty: '1', unit: '', price: '', vat: '19', serviceId: null }])}><AdminIcon name="plus" />Position</button>
          {services.length > 0 && (
            <select className="adm-input" style={{ maxWidth: 260 }} aria-label="Leistung aus Katalog hinzufügen" value="" onChange={(e) => { if (e.target.value) addService(e.target.value); }}>
              <option value="">Leistung aus Katalog …</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name} · {fmtEuro(s.unitPriceCents)}</option>)}
            </select>
          )}
        </div>

        <Totals t={totals} />
        <label className="adm-field"><span className="adm-label">Schlusstext (optional)</span><textarea className="adm-input" rows={2} value={footer} maxLength={3000} onChange={(e) => setFooter(e.target.value)} /></label>
      </fieldset>
      {err && <div className="adm-alert adm-alert-danger" role="alert"><AdminIcon name="alert" />{err}</div>}
      {canWrite ? (
        <div className="adm-actions">
          <button type="button" className="adm-btn adm-btn-secondary" disabled={pending} onClick={() => guard() && run(() => saveInvoiceAction({ id: inv.id, caseNumber, draft: draft() }))}>Entwurf speichern</button>
          <button type="button" className="adm-btn" disabled={pending} onClick={() => { if (guard() && window.confirm('Rechnung jetzt ausstellen? Danach ist sie unveränderlich und erhält eine fortlaufende Nummer.')) run(() => issueInvoiceAction({ id: inv.id, caseNumber, draft: draft() })); }}><AdminIcon name="check" />Rechnung ausstellen</button>
          <a className="adm-btn adm-btn-ghost" href={`/api/admin/rechnungen/${inv.id}/pdf/`} target="_blank" rel="noopener">Vorschau (PDF)</a>
          <button type="button" className="adm-btn adm-btn-ghost" disabled={pending} onClick={() => { if (window.confirm('Entwurf endgültig löschen?')) run(() => deleteDraftAction({ id: inv.id, caseNumber })); }}>Entwurf löschen</button>
        </div>
      ) : <p className="vi-hint">Sie haben Leserechte. Das Bearbeiten der Rechnung ist der Buchhaltung vorbehalten.</p>}
      <p className="vi-hint">Die PDF-Vorschau zeigt den zuletzt gespeicherten Stand. Die Rechnungsnummer wird erst beim Ausstellen vergeben.</p>
    </div>
  );
}

function Totals({ t }: { t: IView['totals'] }) {
  return (
    <dl className="inv-totals">
      <div><dt>Netto</dt><dd>{fmtEuro(t.netCents)}</dd></div>
      {t.groups.map((g) => <div key={g.vatBp}><dt>MwSt. {fmtPercent(g.vatBp)} auf {fmtEuro(g.netCents)}</dt><dd>{fmtEuro(g.vatCents)}</dd></div>)}
      <div className="total"><dt>Brutto</dt><dd>{fmtEuro(t.grossCents)}</dd></div>
    </dl>
  );
}

function Issued({ inv, canWrite, canPay, canDunning, pending, run, caseNumber }: { inv: IView; canWrite: boolean; canPay: boolean; canDunning: boolean; pending: boolean; run: RunFn; caseNumber: string | null }) {
  const toast = useToast();
  const [pay, setPay] = useState<{ amount: string; paidOn: string; method: string; reference: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dun, setDun] = useState<{ fee: string; interest: string; days: string } | null>(null);
  const nextLevel = nextDunningLevel(inv.dunnings);
  const canIssued = inv.status === 'ISSUED';
  const overdue = inv.state === 'OVERDUE' || (inv.state === 'PARTIAL' && inv.dueDate != null && inv.dueDate < today());
  const hasDraftDun = inv.dunnings.some((d) => d.status === 'DRAFT');
  const submitPay = () => {
    if (!pay) return;
    const cents = parseEuroToCents(pay.amount);
    if (cents == null || !Number.isFinite(cents) || cents <= 0) { setErr('Bitte einen gültigen Betrag eingeben.'); return; }
    setErr(null);
    run(() => addPaymentAction({ id: inv.id, caseNumber, amountCents: cents, paidOn: pay.paidOn, method: pay.method, reference: pay.reference }), () => setPay(null));
  };
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="inv-head">
        <div>
          <h3 style={{ margin: 0 }} className="mono">{inv.number}</h3>
          <p className="t-2" style={{ margin: '2px 0 0' }}>{inv.recipient.name}{inv.recipient.city ? ` · ${inv.recipient.postalCode ?? ''} ${inv.recipient.city}` : ''}</p>
        </div>
        <Badge tone={STATE_TONE[inv.state]}>{STATE_LABELS[inv.state]}</Badge>
      </div>
      <dl className="inv-meta">
        <div><dt>Rechnungsdatum</dt><dd>{deDate(inv.issueDate)}</dd></div>
        <div><dt>Fällig am</dt><dd>{deDate(inv.dueDate)}</dd></div>
        <div><dt>Leistungsdatum</dt><dd>{deDate(inv.serviceDate)}</dd></div>
        <div><dt>Bezahlt</dt><dd>{fmtEuro(inv.paidCents)}</dd></div>
        <div><dt>Offen</dt><dd><b>{fmtEuro(inv.openCents)}</b></dd></div>
      </dl>
      <div className="dt-wrap" style={{ overflowX: 'auto' }}>
        <table className="dt" aria-label="Positionen">
          <thead><tr><th>Bezeichnung</th><th className="num">Menge</th><th className="num">Einzelpreis</th><th className="num">MwSt.</th><th className="num">Netto</th></tr></thead>
          <tbody>{inv.items.map((i, n) => (
            <tr key={n}><td>{i.description}</td><td className="num nowrap">{(i.quantityX100 / 100).toLocaleString('de-DE')} {i.unit ?? ''}</td><td className="num nowrap">{fmtEuro(i.unitPriceCents)}</td><td className="num">{fmtPercent(i.vatBp)}</td><td className="num nowrap">{fmtEuro(itemNet(i))}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <Totals t={inv.totals} />
      {inv.status === 'CANCELLED' && <div className="adm-alert adm-alert-warn"><AdminIcon name="alert" />Storniert{inv.cancelReason ? `: ${inv.cancelReason}` : ''}</div>}

      <div className="adm-actions">
        <a className="adm-btn adm-btn-secondary" href={`/api/admin/rechnungen/${inv.id}/pdf/`} target="_blank" rel="noopener"><AdminIcon name="doc" />PDF öffnen</a>
        {canIssued && canPay && inv.openCents > 0 && <button type="button" className="adm-btn" onClick={() => { setErr(null); setPay({ amount: centsToInput(inv.openCents), paidOn: today(), method: 'BANK', reference: '' }); }}>Zahlung erfassen</button>}
        {canIssued && canDunning && overdue && nextLevel && !hasDraftDun && <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setDun({ fee: '', interest: '', days: '7' })}>{DUNNING_LABELS[nextLevel]} vorbereiten</button>}
        {canIssued && canWrite && inv.paidCents === 0 && <button type="button" className="adm-btn adm-btn-ghost" disabled={pending} onClick={() => { const reason = window.prompt('Begründung für die Stornierung (Pflicht):'); if (reason?.trim()) run(() => cancelInvoiceAction({ id: inv.id, caseNumber, reason })); }}>Stornieren</button>}
      </div>

      {pay && (
        <section className="adm-card" style={{ padding: 14, display: 'grid', gap: 10 }} aria-label="Zahlung erfassen">
          <div className="adm-form-grid">
            <label className="adm-field"><span className="adm-label">Betrag (€)</span><input className="adm-input" inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></label>
            <label className="adm-field"><span className="adm-label">Zahlungsdatum</span><input type="date" className="adm-input" max={today()} value={pay.paidOn} onChange={(e) => setPay({ ...pay, paidOn: e.target.value })} /></label>
            <label className="adm-field"><span className="adm-label">Zahlart</span><select className="adm-input" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="adm-field"><span className="adm-label">Verwendungszweck / Referenz</span><input className="adm-input" maxLength={200} value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></label>
          </div>
          {err && <div className="adm-alert adm-alert-danger" role="alert"><AdminIcon name="alert" />{err}</div>}
          <div className="adm-actions"><button type="button" className="adm-btn" disabled={pending} onClick={submitPay}>Zahlung speichern</button><button type="button" className="adm-btn adm-btn-ghost" onClick={() => setPay(null)}>Abbrechen</button></div>
        </section>
      )}
      {dun && nextLevel && (
        <section className="adm-card" style={{ padding: 14, display: 'grid', gap: 10 }} aria-label="Mahnung vorbereiten">
          <p className="vi-hint" style={{ margin: 0 }}>Es wird zunächst nur ein Entwurf angelegt. Gebühren und Zinsen tragen Sie selbst ein; der Versand erfolgt nie automatisch.</p>
          <div className="adm-form-grid">
            <label className="adm-field"><span className="adm-label">Mahngebühr (€, optional)</span><input className="adm-input" inputMode="decimal" value={dun.fee} onChange={(e) => setDun({ ...dun, fee: e.target.value })} /></label>
            <label className="adm-field"><span className="adm-label">Verzugszinsen (€, optional)</span><input className="adm-input" inputMode="decimal" value={dun.interest} onChange={(e) => setDun({ ...dun, interest: e.target.value })} /></label>
            <label className="adm-field"><span className="adm-label">Neue Frist (Tage)</span><input className="adm-input" inputMode="numeric" value={dun.days} onChange={(e) => setDun({ ...dun, days: e.target.value.replace(/\D/g, '') })} /></label>
          </div>
          <div className="adm-actions"><button type="button" className="adm-btn" disabled={pending} onClick={() => {
            const fee = parseEuroToCents(dun.fee) ?? 0, interest = parseEuroToCents(dun.interest) ?? 0;
            if (!Number.isFinite(fee) || !Number.isFinite(interest)) { toast('Bitte gültige Beträge eingeben.', 'error'); return; }
            run(() => createDunningAction({ invoiceId: inv.id, caseNumber, feeCents: fee, interestCents: interest, dueInDays: Number(dun.days) || 7 }), () => setDun(null));
          }}>Entwurf anlegen</button><button type="button" className="adm-btn adm-btn-ghost" onClick={() => setDun(null)}>Abbrechen</button></div>
        </section>
      )}

      <section aria-label="Zahlungen">
        <h4 style={{ margin: '0 0 6px' }}>Zahlungen</h4>
        {inv.payments.length === 0 ? <p className="t-3" style={{ margin: 0 }}>Noch keine Zahlung erfasst.</p> : (
          <ul className="adm-list">{inv.payments.map((p) => (
            <li key={p.id} style={p.reversed ? { opacity: 0.6 } : undefined}>
              <span className="main"><b>{fmtEuro(p.amountCents)}</b> · {deDate(p.paidOn)} · {METHOD_LABEL[p.method] ?? p.method}{p.reversed && <> · <Badge tone="muted">storniert</Badge></>}
                {(p.reference || p.reverseReason) && <span className="secondary">{p.reversed ? `Grund: ${p.reverseReason}` : p.reference}</span>}</span>
              {canPay && !p.reversed && canIssued && <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" disabled={pending} onClick={() => { const reason = window.prompt('Begründung für die Stornierung der Zahlung (Pflicht):'); if (reason?.trim()) run(() => reversePaymentAction({ id: p.id, caseNumber, reason })); }}>Stornieren</button>}
            </li>
          ))}</ul>
        )}
      </section>

      {inv.dunnings.length > 0 && (
        <section aria-label="Mahnungen">
          <h4 style={{ margin: '0 0 6px' }}>Mahnwesen</h4>
          <ul className="adm-list">{inv.dunnings.map((d) => (
            <li key={d.id} style={d.status === 'CANCELLED' ? { opacity: 0.6 } : undefined}>
              <span className="main"><b>{DUNNING_LABELS[d.level]}</b> · {d.status === 'DRAFT' ? <Badge tone="warn">Entwurf</Badge> : d.status === 'ISSUED' ? <Badge tone="info">ausgestellt am {deDate(d.issueDate)}</Badge> : <Badge tone="muted">storniert</Badge>}
                <span className="secondary">Frist {deDate(d.dueDate)}{d.feeCents ? ` · Gebühr ${fmtEuro(d.feeCents)}` : ''}{d.interestCents ? ` · Zinsen ${fmtEuro(d.interestCents)}` : ''}</span></span>
              <span className="dm-entry-actions">
                <a className="adm-btn adm-btn-ghost adm-btn-sm" href={`/api/admin/mahnungen/${d.id}/pdf/`} target="_blank" rel="noopener">PDF</a>
                {canDunning && d.status === 'DRAFT' && <button type="button" className="adm-btn adm-btn-sm" disabled={pending} onClick={() => { if (window.confirm('Mahnung jetzt ausstellen? Der Versand erfolgt anschließend manuell durch Sie.')) run(() => issueDunningAction({ id: d.id, caseNumber })); }}>Ausstellen</button>}
                {canDunning && d.status !== 'CANCELLED' && <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" disabled={pending} onClick={() => { if (window.confirm('Mahnung stornieren?')) run(() => cancelDunningAction({ id: d.id, caseNumber })); }}>Stornieren</button>}
              </span>
            </li>
          ))}</ul>
        </section>
      )}
    </div>
  );
}
