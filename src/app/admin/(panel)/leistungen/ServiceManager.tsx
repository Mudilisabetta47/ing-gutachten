'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { EmptyState } from '@/components/admin/ui';
import { useToast } from '@/components/admin/Toast';
import { centsToInput, fmtEuro, fmtPercent, parseEuroToCents } from '@/lib/money';
import { archiveServiceAction, saveServiceAction } from '../faelle/invoice-actions';

type Svc = { id: string; name: string; description: string | null; unit: string | null; unitPriceCents: number; vatBp: number };
type Edit = { id: string | null; name: string; description: string; unit: string; price: string; vat: string };
const blank: Edit = { id: null, name: '', description: '', unit: '', price: '', vat: '19' };

export function ServiceManager({ items, canWrite }: { items: Svc[]; canWrite: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState<Edit | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const save = () => {
    if (!edit) return;
    const cents = parseEuroToCents(edit.price), vat = Number(edit.vat.replace(',', '.'));
    if (cents == null || !Number.isFinite(cents)) { setErr('Bitte einen gültigen Preis eingeben.'); return; }
    if (!Number.isFinite(vat) || vat < 0 || vat > 30) { setErr('Bitte einen gültigen MwSt.-Satz eingeben.'); return; }
    setErr(null);
    start(async () => {
      const r = await saveServiceAction({ id: edit.id, name: edit.name, description: edit.description, unit: edit.unit, unitPriceCents: cents, vatBp: Math.round(vat * 100) });
      if (!r.ok) { setErr(r.error ?? 'Das hat nicht geklappt.'); return; }
      toast(r.message ?? 'Gespeichert.', 'ok'); setEdit(null); router.refresh();
    });
  };
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {canWrite && <div><button type="button" className="adm-btn" onClick={() => { setErr(null); setEdit(blank); }}><AdminIcon name="plus" />Neue Leistung</button></div>}
      {edit && (
        <section className="adm-card" style={{ padding: 14, display: 'grid', gap: 10 }} aria-label="Leistung bearbeiten">
          <div className="adm-form-grid">
            <label className="adm-field"><span className="adm-label">Bezeichnung</span><input className="adm-input" value={edit.name} maxLength={160} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
            <label className="adm-field"><span className="adm-label">Einheit (z. B. pauschal, km, Std.)</span><input className="adm-input" value={edit.unit} maxLength={20} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} /></label>
            <label className="adm-field"><span className="adm-label">Preis netto (€)</span><input className="adm-input" inputMode="decimal" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></label>
            <label className="adm-field"><span className="adm-label">MwSt. (%)</span><input className="adm-input" inputMode="decimal" value={edit.vat} onChange={(e) => setEdit({ ...edit, vat: e.target.value })} /></label>
            <label className="adm-field span-2"><span className="adm-label">Beschreibung (optional)</span><input className="adm-input" value={edit.description} maxLength={500} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></label>
          </div>
          {err && <div className="adm-alert adm-alert-danger" role="alert"><AdminIcon name="alert" />{err}</div>}
          <div className="adm-actions"><button type="button" className="adm-btn" disabled={pending} onClick={save}>Speichern</button><button type="button" className="adm-btn adm-btn-ghost" onClick={() => setEdit(null)}>Abbrechen</button></div>
        </section>
      )}
      {items.length === 0 && !edit ? <EmptyState icon="tag" title="Noch keine Leistungen">Legen Sie Ihre eigenen Leistungen und Preise an. Das System gibt bewusst keine Preise vor – sie lassen sich später in Rechnungen mit einem Klick übernehmen.</EmptyState> : (
        <ul className="adm-list">{items.map((s) => (
          <li key={s.id}>
            <span className="main"><b>{s.name}</b><span className="secondary">{fmtEuro(s.unitPriceCents)} netto{s.unit ? ` / ${s.unit}` : ''} · MwSt. {fmtPercent(s.vatBp)}{s.description ? ` · ${s.description}` : ''}</span></span>
            {canWrite && <span className="dm-entry-actions">
              <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => { setErr(null); setEdit({ id: s.id, name: s.name, description: s.description ?? '', unit: s.unit ?? '', price: centsToInput(s.unitPriceCents), vat: String(s.vatBp / 100).replace('.', ',') }); }}>Bearbeiten</button>
              <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" disabled={pending} onClick={() => { if (window.confirm(`„${s.name}“ archivieren? Bestehende Rechnungen bleiben unverändert.`)) start(async () => { const r = await archiveServiceAction({ id: s.id }); toast(r.ok ? r.message ?? 'Archiviert.' : r.error ?? 'Das hat nicht geklappt.', r.ok ? 'ok' : 'error'); if (r.ok) router.refresh(); }); }}>Archivieren</button>
            </span>}
          </li>
        ))}</ul>
      )}
    </div>
  );
}
