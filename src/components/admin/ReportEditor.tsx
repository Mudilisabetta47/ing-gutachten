'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { AdminIcon } from './AdminIcon';
import { useToast } from './Toast';
import {
  approveReportAction, commentAction, markSentAction, reopenReportAction, requestChangesAction, resolveCommentAction, saveReportAction, submitReportAction, type RepResult,
} from '@/app/admin/(panel)/faelle/report-actions';
import { AUTO_LABELS, STATUS_LABELS, STATUS_TONE, VARIABLES, resolveText, validateReport, type Chapter, type Issue, type ReportContent, type ReportData } from '@/lib/report';

export type RView = {
  id: string; number: string; status: string; revision: number; saveCounter: number; title: string | null; content: ReportContent;
  snapshot: ReportData; issues: Issue[]; changedSinceSnapshot: string[];
  comments: { id: string; chapterKey: string | null; body: string; revision: number; author: string | null; resolvedAt: string | null; createdAt: string }[];
  versions: { id: string; revision: number; kind: string; note: string | null; createdAt: string; by: string | null; documentId: string | null }[];
  people: { author: string | null; approver: string | null; sentBy: string | null };
  sent: { at: string | null; to: string | null; channel: string | null; note: string | null };
  approvedAt: string | null; submittedAt: string | null;
  can: { write: boolean; writeAny: boolean; review: boolean; approve: boolean; selfApproveBlocked: boolean; send: boolean; comment: boolean };
};
export type TBlock = { id: string; title: string; category: string | null; body: string };

const CHANNELS: [string, string][] = [['EMAIL', 'E-Mail (extern versendet)'], ['POST', 'Post'], ['PORTAL', 'Portal'], ['PERSONAL', 'Persönlich'], ['OTHER', 'Sonstiges']];
const KIND_TXT: Record<string, string> = { SUBMIT: 'Eingereicht', APPROVED: 'Freigegeben' };
const when = (iso: string) => new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

export function ReportEditor({ view, caseNumber, blocks }: { view: RView; caseNumber: string; blocks: TBlock[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(view.title ?? '');
  const [chapters, setChapters] = useState<Chapter[]>(view.content.chapters);
  const [sel, setSel] = useState<string>(view.content.chapters.find((c) => c.enabled)?.key ?? view.content.chapters[0]?.key ?? '');
  const [save, setSave] = useState<{ state: 'saved' | 'dirty' | 'saving' | 'error'; error?: string }>({ state: 'saved' });
  const [panel, setPanel] = useState<null | 'send' | 'changes' | 'reopen'>(null);
  const [form, setForm] = useState({ to: '', channel: 'EMAIL', note: '', reason: '' });
  const [comment, setComment] = useState('');
  const counter = useRef(view.saveCounter);
  const dirty = useRef(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const canEdit = view.can.write;
  const cur = chapters.find((c) => c.key === sel) ?? chapters[0];

  const touch = () => { dirty.current = true; setSave((s) => ({ ...s, state: 'dirty' })); };
  const setChapter = (key: string, patch: Partial<Chapter>) => { setChapters((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c))); touch(); };

  const doSave = useCallback(async () => {
    if (!dirty.current) return;
    dirty.current = false;
    setSave({ state: 'saving' });
    const r = await saveReportAction({ id: view.id, caseNumber, title: title || null, content: { chapters }, counter: counter.current });
    if (r.ok) { counter.current = r.saveCounter!; setSave({ state: dirty.current ? 'dirty' : 'saved' }); }
    else { dirty.current = true; setSave({ state: 'error', error: r.error }); }
  }, [view.id, caseNumber, title, chapters]);

  useEffect(() => {
    if (!canEdit || save.state !== 'dirty') return;
    const t = setTimeout(() => { void doSave(); }, 1000);
    return () => clearTimeout(t);
  }, [canEdit, save.state, doSave, chapters, title]);
  useEffect(() => {
    const on = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', on);
    return () => window.removeEventListener('beforeunload', on);
  }, []);

  // Prüfhinweise live (nur Entwürfe – sonst gelten die eingefrorenen Hinweise des Servers)
  const issues = useMemo(() => (canEdit ? validateReport({ chapters }, view.snapshot) : view.issues), [canEdit, chapters, view.snapshot, view.issues]);
  const errors = issues.filter((i) => i.level === 'error').length;
  const resolved = useMemo(() => (cur ? resolveText(cur.text, view.snapshot.vars) : null), [cur, view.snapshot.vars]);

  const act = (fn: () => Promise<RepResult>, after?: () => void) => start(async () => {
    const r = await fn();
    toast(r.ok ? r.message ?? 'Erledigt.' : r.error ?? 'Das hat nicht geklappt.', r.ok ? 'ok' : 'error');
    if (r.ok) { after?.(); router.refresh(); }
  });
  const flush = async () => { dirty.current = true; await doSave(); };

  const insert = (snippet: string, block = false) => {
    if (!cur || !canEdit) return;
    const el = ta.current;
    const start0 = el?.selectionStart ?? cur.text.length, end = el?.selectionEnd ?? cur.text.length;
    // Bausteine (mehr als eine Variable lang) beginnen in einem eigenen Absatz
    const before = cur.text.slice(0, start0);
    const sep = block && before.trim() && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
    const add = sep + snippet;
    setChapter(cur.key, { text: before + add + cur.text.slice(end) });
    setTimeout(() => { el?.focus(); el?.setSelectionRange(start0 + add.length, start0 + add.length); }, 0);
  };
  const move = (key: string, d: -1 | 1) => { setChapters((cs) => { const i = cs.findIndex((c) => c.key === key); const j = i + d; if (i < 0 || j < 0 || j >= cs.length) return cs; const n = [...cs]; [n[i], n[j]] = [n[j], n[i]]; return n; }); touch(); };
  const addChapter = () => { const key = `kap_${Math.random().toString(36).slice(2, 7)}`; setChapters((cs) => [...cs, { key, title: 'Neues Kapitel', enabled: true, auto: null, text: '' }]); setSel(key); touch(); };

  const openComments = view.comments.filter((c) => !c.resolvedAt);
  const chapterComments = (key: string | null) => view.comments.filter((c) => c.chapterKey === key);
  const tone = STATUS_TONE[view.status] ?? 'muted';
  const groups = [...new Set(VARIABLES.map((v) => v.group))];

  return (
    <div className="rep">
      <header className="rep-head adm-card">
        <div className="rep-head-l">
          <b className="mono" style={{ fontSize: 16 }}>{view.number}</b>
          <span className={`adm-badge adm-badge-${tone}`}>{STATUS_LABELS[view.status] ?? view.status}</span>
          <span className="t-3" style={{ fontSize: 12.5 }}>Fassung {view.revision}{view.people.author ? ` · Verfasser: ${view.people.author}` : ''}{view.people.approver ? ` · freigegeben von ${view.people.approver}` : ''}</span>
          {canEdit && <span className={`calc-save calc-save-${save.state}`} aria-live="polite">{save.state === 'saving' ? 'Speichert …' : save.state === 'dirty' ? 'Ungespeicherte Änderungen' : save.state === 'error' ? `Nicht gespeichert: ${save.error ?? ''}` : 'Gespeichert'}</span>}
        </div>
        <div className="adm-actions">
          <a className="adm-btn adm-btn-secondary" href={`/api/admin/gutachten/${view.id}/pdf`} target="_blank" rel="noopener"><AdminIcon name="doc" />{view.status === 'APPROVED' || view.status === 'SENT' ? 'PDF öffnen' : 'PDF-Vorschau'}</a>
          {canEdit && <button type="button" className="adm-btn" disabled={pending || errors > 0} title={errors ? 'Bitte zuerst die offenen Punkte beheben' : undefined} onClick={() => { if (window.confirm('Gutachten zur Prüfung einreichen? Der Stand wird eingefroren, bis die Prüfung abgeschlossen ist.')) act(async () => { await flush(); return submitReportAction({ id: view.id, caseNumber }); }); }}>Zur Prüfung einreichen</button>}
          {view.can.review && <button type="button" className="adm-btn adm-btn-secondary" disabled={pending} onClick={() => setPanel(panel === 'changes' ? null : 'changes')}>Änderungen anfordern</button>}
          {view.can.approve && <button type="button" className="adm-btn" disabled={pending} onClick={() => { if (window.confirm(`Gutachten ${view.number} freigeben? Es wird ein PDF erzeugt und im Fall abgelegt.${openComments.length ? `\n\nAchtung: ${openComments.length} Kommentar(e) sind noch offen.` : ''}`)) act(() => approveReportAction({ id: view.id, caseNumber })); }}>Freigeben</button>}
          {view.can.send && <button type="button" className="adm-btn" disabled={pending} onClick={() => setPanel(panel === 'send' ? null : 'send')}>Versand erfassen</button>}
          {view.can.writeAny && (view.status === 'APPROVED' || view.status === 'SENT') && <button type="button" className="adm-btn adm-btn-ghost" disabled={pending} onClick={() => setPanel(panel === 'reopen' ? null : 'reopen')}>Zur Überarbeitung öffnen</button>}
        </div>
      </header>

      {view.can.selfApproveBlocked && <div className="adm-alert adm-alert-warn" role="status"><AdminIcon name="info" />Vier-Augen-Prinzip: Das Gutachten muss von einer anderen Person geprüft und freigegeben werden.</div>}
      {view.changedSinceSnapshot.length > 0 && <div className="adm-alert adm-alert-warn" role="status"><AdminIcon name="alert" />Seit der Einreichung haben sich Falldaten geändert ({view.changedSinceSnapshot.slice(0, 4).join(', ')}{view.changedSinceSnapshot.length > 4 ? ' …' : ''}). Das PDF verwendet den eingefrorenen Stand der Einreichung.</div>}
      {view.status === 'SENT' && view.sent.at && <div className="adm-alert" role="status"><AdminIcon name="check" />Versendet am {when(view.sent.at)} an {view.sent.to} ({CHANNELS.find(([k]) => k === view.sent.channel)?.[1] ?? view.sent.channel}){view.sent.note ? ` – ${view.sent.note}` : ''}. Versendet wurde außerhalb des Systems; hier ist der Versand dokumentiert.</div>}

      {panel === 'send' && (
        <div className="adm-card rep-panel">
          <b>Versand erfassen</b><p className="vi-hint" style={{ margin: 0 }}>Das System versendet nichts automatisch. Tragen Sie ein, wohin und wie das freigegebene Gutachten gegangen ist.</p>
          <div className="adm-form-grid">
            <label className="adm-field"><span className="adm-label">Empfänger</span><input className="adm-input" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} maxLength={200} placeholder="Name / Firma / E-Mail" /></label>
            <label className="adm-field"><span className="adm-label">Weg</span><select className="adm-input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>{CHANNELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          </div>
          <label className="adm-field"><span className="adm-label">Notiz (optional)</span><input className="adm-input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={500} /></label>
          <div className="adm-actions"><button type="button" className="adm-btn" disabled={pending} onClick={() => act(() => markSentAction({ id: view.id, caseNumber, to: form.to, channel: form.channel, note: form.note }), () => setPanel(null))}>Als versendet erfassen</button><button type="button" className="adm-btn adm-btn-ghost" onClick={() => setPanel(null)}>Abbrechen</button></div>
        </div>
      )}
      {panel === 'changes' && (
        <div className="adm-card rep-panel">
          <b>Änderungen anfordern</b><p className="vi-hint" style={{ margin: 0 }}>Offene Kommentare gehen an den Verfasser. Zusätzlich können Sie hier eine Begründung angeben{openComments.length === 0 ? ' (ohne Kommentar ist sie Pflicht)' : ''}.</p>
          <textarea className="adm-input" rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={2000} aria-label="Begründung" />
          <div className="adm-actions"><button type="button" className="adm-btn" disabled={pending} onClick={() => act(() => requestChangesAction({ id: view.id, caseNumber, note: form.reason }), () => { setPanel(null); setForm({ ...form, reason: '' }); })}>Änderungen anfordern</button><button type="button" className="adm-btn adm-btn-ghost" onClick={() => setPanel(null)}>Abbrechen</button></div>
        </div>
      )}
      {panel === 'reopen' && (
        <div className="adm-card rep-panel">
          <b>Zur Überarbeitung öffnen</b><p className="vi-hint" style={{ margin: 0 }}>Es entsteht eine neue Fassung, die erneut geprüft werden muss. Bereits erzeugte PDFs bleiben im Fall erhalten.</p>
          <textarea className="adm-input" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={500} aria-label="Begründung" placeholder="Begründung (Pflicht)" />
          <div className="adm-actions"><button type="button" className="adm-btn" disabled={pending} onClick={() => act(() => reopenReportAction({ id: view.id, caseNumber, reason: form.reason }), () => { setPanel(null); setForm({ ...form, reason: '' }); })}>Wieder öffnen</button><button type="button" className="adm-btn adm-btn-ghost" onClick={() => setPanel(null)}>Abbrechen</button></div>
        </div>
      )}

      <div className="rep-grid">
        <nav className="rep-chapters adm-card" aria-label="Kapitel">
          <div className="rep-chapters-head"><b>Kapitel</b>{canEdit && <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={addChapter}><AdminIcon name="plus" />Kapitel</button>}</div>
          <ul>
            {chapters.map((c, i) => {
              const n = openComments.filter((x) => x.chapterKey === c.key).length;
              const bad = issues.filter((x) => x.chapter === c.key && x.level === 'error').length;
              return (
                <li key={c.key} className={`${c.key === sel ? 'is-on' : ''} ${c.enabled ? '' : 'is-off'}`}>
                  {canEdit && <input type="checkbox" checked={c.enabled} aria-label={`${c.title} aufnehmen`} onChange={(e) => setChapter(c.key, { enabled: e.target.checked })} />}
                  <button type="button" onClick={() => setSel(c.key)} aria-current={c.key === sel}>{c.title}{bad > 0 && <span className="adm-badge adm-badge-danger" title="Offene Punkte">{bad}</span>}{n > 0 && <span className="adm-badge adm-badge-warn" title="Offene Kommentare">{n}</span>}</button>
                  {canEdit && <span className="rep-mv"><button type="button" aria-label="Nach oben" disabled={i === 0} onClick={() => move(c.key, -1)}>↑</button><button type="button" aria-label="Nach unten" disabled={i === chapters.length - 1} onClick={() => move(c.key, 1)}>↓</button></span>}
                </li>
              );
            })}
          </ul>
        </nav>

        <section className="rep-editor adm-card" aria-label="Kapitel bearbeiten">
          {cur ? (
            <>
              <div className="rep-ed-top">
                <input className="adm-input rep-ed-title" value={cur.title} disabled={!canEdit} maxLength={120} aria-label="Kapitelüberschrift" onChange={(e) => setChapter(cur.key, { title: e.target.value })} />
                {canEdit && !cur.auto && <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => { if (window.confirm(`Kapitel „${cur.title}“ entfernen?`)) { setChapters((cs) => cs.filter((c) => c.key !== cur.key)); setSel(chapters.find((c) => c.key !== cur.key)?.key ?? ''); touch(); } }}>Entfernen</button>}
              </div>
              {cur.auto && <div className="adm-alert" role="note"><AdminIcon name="info" />Dieses Kapitel enthält automatisch: <b>{AUTO_LABELS[cur.auto]}</b>. Der Text unten steht davor.</div>}
              {canEdit && (
                <div className="rep-tools">
                  <label className="calc-cmp">Variable
                    <select className="adm-input" value="" onChange={(e) => { if (e.target.value) insert(`{{${e.target.value}}}`); }} aria-label="Variable einfügen">
                      <option value="">einfügen …</option>
                      {groups.map((g) => <optgroup key={g} label={g}>{VARIABLES.filter((v) => v.group === g).map((v) => <option key={v.key} value={v.key}>{v.label}{view.snapshot.vars[v.key] ? '' : ' (kein Wert)'}</option>)}</optgroup>)}
                    </select>
                  </label>
                  <label className="calc-cmp">Textbaustein
                    <select className="adm-input" value="" onChange={(e) => { const b = blocks.find((x) => x.id === e.target.value); if (b) insert(b.body, true); }} aria-label="Textbaustein einfügen" disabled={blocks.length === 0}>
                      <option value="">{blocks.length ? 'einfügen …' : 'keine vorhanden'}</option>
                      {blocks.map((b) => <option key={b.id} value={b.id}>{b.category ? `${b.category}: ` : ''}{b.title}</option>)}
                    </select>
                  </label>
                </div>
              )}
              <textarea ref={ta} className="adm-input rep-text" rows={14} value={cur.text} disabled={!canEdit} maxLength={20000} aria-label="Text des Kapitels" placeholder={cur.auto ? 'Optionaler Einleitungstext …' : 'Text des Kapitels …'} onChange={(e) => setChapter(cur.key, { text: e.target.value })} />
              {resolved && cur.text.trim() && (
                <details open className="rep-preview"><summary>Vorschau mit eingesetzten Werten</summary>
                  <div className="rep-preview-text">{resolved.text.split(/(\[fehlt: [^\]]+\]|\[unbekannte Variable: [^\]]+\])/).map((part, i) => (/^\[(fehlt|unbekannte)/.test(part) ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>))}</div>
                </details>
              )}
              <div className="rep-ch-comments">
                <b style={{ fontSize: 13 }}>Kommentare zu diesem Kapitel</b>
                {chapterComments(cur.key).length === 0 && <p className="vi-hint" style={{ margin: 0 }}>Keine Kommentare.</p>}
                {chapterComments(cur.key).map((c) => <CommentRow key={c.id} c={c} can={view.can.comment} caseNumber={caseNumber} onDone={() => router.refresh()} />)}
                {view.can.comment && (
                  <div className="rep-comment-new"><input className="adm-input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Kommentar zu diesem Kapitel …" maxLength={2000} aria-label="Neuer Kommentar" />
                    <button type="button" className="adm-btn adm-btn-secondary" disabled={pending || !comment.trim()} onClick={() => act(() => commentAction({ id: view.id, caseNumber, chapterKey: cur.key, body: comment }), () => setComment(''))}>Senden</button></div>
                )}
              </div>
            </>
          ) : <p className="vi-hint">Kein Kapitel vorhanden.</p>}
        </section>

        <aside className="rep-side">
          <div className="adm-card rep-box">
            <div className="rep-box-head"><b>Prüfung vor Einreichung</b><span className={`adm-badge adm-badge-${errors ? 'danger' : issues.length ? 'warn' : 'ok'}`}>{errors ? `${errors} offen` : issues.length ? `${issues.length} Hinweis${issues.length > 1 ? 'e' : ''}` : 'in Ordnung'}</span></div>
            {issues.length === 0 ? <p className="vi-hint" style={{ margin: 0 }}>Keine offenen Punkte.</p> : (
              <ul className="rep-issues">{issues.map((i, n) => (
                <li key={n} className={`is-${i.level}`}><button type="button" onClick={() => i.chapter && setSel(i.chapter)}><span aria-hidden>{i.level === 'error' ? '✕' : '!'}</span>{i.text}</button></li>
              ))}</ul>
            )}
          </div>
          <div className="adm-card rep-box">
            <div className="rep-box-head"><b>Kommentare</b><span className="t-3">{openComments.length} offen</span></div>
            {view.comments.filter((c) => !c.chapterKey).map((c) => <CommentRow key={c.id} c={c} can={view.can.comment} caseNumber={caseNumber} onDone={() => router.refresh()} />)}
            {view.comments.length === 0 && <p className="vi-hint" style={{ margin: 0 }}>Noch keine Kommentare.</p>}
            {view.can.comment && view.comments.some((c) => c.chapterKey) && <p className="vi-hint" style={{ margin: 0 }}>Kapitelbezogene Kommentare stehen beim jeweiligen Kapitel.</p>}
          </div>
          <div className="adm-card rep-box">
            <div className="rep-box-head"><b>Verlauf</b></div>
            {view.versions.length === 0 ? <p className="vi-hint" style={{ margin: 0 }}>Noch nicht eingereicht.</p> : (
              <ul className="rep-versions">{view.versions.map((v) => <li key={v.id}><b>Fassung {v.revision}</b> · {KIND_TXT[v.kind] ?? v.kind}<span className="t-3"> {when(v.createdAt)}{v.by ? ` · ${v.by}` : ''}</span>{v.note && <span className="t-2" style={{ display: 'block', fontSize: 12 }}>{v.note}</span>}</li>)}</ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function CommentRow({ c, can, caseNumber, onDone }: { c: RView['comments'][number]; can: boolean; caseNumber: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  return (
    <div className={`rep-comment ${c.resolvedAt ? 'is-done' : ''}`}>
      <div className="t-3" style={{ fontSize: 12 }}>{c.author ?? 'System'} · {when(c.createdAt)} · Fassung {c.revision}{c.resolvedAt ? ' · erledigt' : ''}</div>
      <div style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div>
      {can && <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" disabled={pending} onClick={() => start(async () => { await resolveCommentAction({ id: c.id, caseNumber, resolved: !c.resolvedAt }); onDone(); })}>{c.resolvedAt ? 'Wieder öffnen' : 'Erledigt'}</button>}
    </div>
  );
}
