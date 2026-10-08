'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { EmptyState } from '@/components/admin/ui';
import { useToast } from '@/components/admin/Toast';
import { VARIABLES } from '@/lib/report';
import { archiveTextBlockAction, saveTextBlockAction } from '../faelle/report-actions';

type Block = { id: string; title: string; category: string | null; body: string };

export function TextBlockManager({ blocks }: { blocks: Block[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState<{ id: string | null; title: string; category: string; body: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const save = () => {
    if (!edit) return;
    setErr(null);
    start(async () => {
      const r = await saveTextBlockAction({ id: edit.id, title: edit.title, category: edit.category, body: edit.body });
      if (!r.ok) { setErr(r.error ?? 'Das hat nicht geklappt.'); return; }
      toast(r.message ?? 'Gespeichert.', 'ok'); setEdit(null); router.refresh();
    });
  };
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div><button type="button" className="adm-btn" onClick={() => { setErr(null); setEdit({ id: null, title: '', category: '', body: '' }); }}><AdminIcon name="plus" />Neuer Textbaustein</button></div>
      {edit && (
        <section className="adm-card" style={{ padding: 14, display: 'grid', gap: 10 }} aria-label="Textbaustein bearbeiten">
          <div className="adm-form-grid">
            <label className="adm-field"><span className="adm-label">Titel</span><input className="adm-input" value={edit.title} maxLength={120} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
            <label className="adm-field"><span className="adm-label">Kategorie (optional)</span><input className="adm-input" value={edit.category} maxLength={60} onChange={(e) => setEdit({ ...edit, category: e.target.value })} placeholder="z. B. Einleitung, Hinweise" /></label>
          </div>
          <label className="adm-field"><span className="adm-label">Text</span><textarea className="adm-input" rows={7} value={edit.body} maxLength={10000} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></label>
          <details><summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>Verfügbare Variablen</summary>
            <p className="vi-hint" style={{ margin: '6px 0 0', columns: 2 }}>{VARIABLES.map((v) => <span key={v.key} style={{ display: 'block' }}><code>{`{{${v.key}}}`}</code> – {v.label}</span>)}</p></details>
          {err && <div className="adm-alert adm-alert-danger" role="alert"><AdminIcon name="alert" />{err}</div>}
          <div className="adm-actions"><button type="button" className="adm-btn" disabled={pending} onClick={save}>Speichern</button><button type="button" className="adm-btn adm-btn-ghost" onClick={() => setEdit(null)}>Abbrechen</button></div>
        </section>
      )}
      {blocks.length === 0 && !edit ? <EmptyState icon="template" title="Noch keine Textbausteine">Legen Sie Bausteine für wiederkehrende Absätze an – sie lassen sich im Gutachten per Auswahl einfügen.</EmptyState> : (
        <ul className="adm-list">{blocks.map((b) => (
          <li key={b.id} style={{ alignItems: 'flex-start' }}>
            <span className="main"><b>{b.title}</b>{b.category && <span className="secondary">{b.category}</span>}<span className="t-2" style={{ whiteSpace: 'pre-wrap', fontSize: 12.5 }}>{b.body.length > 220 ? `${b.body.slice(0, 220)} …` : b.body}</span></span>
            <span className="dm-entry-actions"><button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => { setErr(null); setEdit({ id: b.id, title: b.title, category: b.category ?? '', body: b.body }); }}>Bearbeiten</button>
              <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" disabled={pending} onClick={() => { if (window.confirm(`„${b.title}“ archivieren?`)) start(async () => { const r = await archiveTextBlockAction({ id: b.id }); toast(r.ok ? r.message ?? 'Archiviert.' : r.error ?? 'Das hat nicht geklappt.', r.ok ? 'ok' : 'error'); if (r.ok) router.refresh(); }); }}>Archivieren</button></span>
          </li>
        ))}</ul>
      )}
    </div>
  );
}
