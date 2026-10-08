'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { AdminIcon } from './AdminIcon';
import { useToast } from './Toast';
import { Badge } from './ui';
import { cancelTaskAction, completeTaskAction, createTaskAction, markReadAction, reopenTaskAction, snoozeTaskAction, updateTaskAction, type TaskResult } from '@/app/admin/(panel)/aufgaben/actions';
import { KIND_LABELS, PRIORITY_LABELS } from '@/lib/tasks';

export type TView = {
  id: string; kind: 'TASK' | 'FOLLOW_UP'; status: 'OPEN' | 'DONE' | 'CANCELLED'; title: string; description: string | null; priority: 'NORMAL' | 'HIGH' | 'URGENT';
  dueDate: string | null; overdue: boolean; dueToday: boolean; assignee: { id: string; name: string } | null;
  caseNumber: string | null; leadId: string | null; leadName: string | null; customerId: string | null; customerName: string | null;
};
export type Person = { id: string; name: string };
const de = (iso: string | null) => (iso ? iso.split('-').reverse().join('.') : 'ohne Datum');

function useRun() {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<TaskResult>, ok?: () => void) => start(async () => {
    const r = await fn();
    toast(r.ok ? r.message ?? 'Gespeichert.' : r.error ?? 'Das hat nicht geklappt.', r.ok ? 'ok' : 'error');
    if (r.ok) { ok?.(); router.refresh(); }
  });
  return { run, pending };
}

type Draft = { id: string | null; kind: 'TASK' | 'FOLLOW_UP'; title: string; description: string; priority: string; dueDate: string; assigneeId: string };

export function TaskForm({ people, defaultAssigneeId, caseId, leadId, customerId, caseNumber, initial, onDone, defaultKind = 'TASK' }: { people: Person[]; defaultAssigneeId: string; caseId?: string; leadId?: string; customerId?: string; caseNumber?: string | null; initial?: TView; onDone?: () => void; defaultKind?: 'TASK' | 'FOLLOW_UP' }) {
  const { run, pending } = useRun();
  const [d, setD] = useState<Draft>(initial
    ? { id: initial.id, kind: initial.kind, title: initial.title, description: initial.description ?? '', priority: initial.priority, dueDate: initial.dueDate ?? '', assigneeId: initial.assignee?.id ?? defaultAssigneeId }
    : { id: null, kind: defaultKind, title: '', description: '', priority: 'NORMAL', dueDate: '', assigneeId: defaultAssigneeId });
  const [err, setErr] = useState<string | null>(null);
  const save = () => {
    setErr(null);
    const task = { kind: d.kind, title: d.title, description: d.description, priority: d.priority as 'NORMAL', dueDate: d.dueDate || null, assigneeId: d.assigneeId, caseId: caseId ?? null, leadId: leadId ?? null, customerId: customerId ?? null };
    if (d.kind === 'FOLLOW_UP' && !d.dueDate) { setErr('Eine Wiedervorlage braucht ein Datum.'); return; }
    run(() => (d.id ? updateTaskAction({ id: d.id, task, caseNumber }) : createTaskAction({ task, caseNumber })), () => { if (!d.id) setD({ ...d, title: '', description: '', dueDate: '' }); onDone?.(); });
  };
  return (
    <form className="task-form" onSubmit={(e) => { e.preventDefault(); save(); }} aria-label={d.id ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}>
      <div className="adm-form-grid">
        <label className="adm-field span-2"><span className="adm-label">Titel</span><input className="adm-input" value={d.title} maxLength={160} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="Was ist zu tun?" /></label>
        <label className="adm-field"><span className="adm-label">Art</span>
          <select className="adm-input" value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as 'TASK' })}><option value="TASK">Aufgabe</option><option value="FOLLOW_UP">Wiedervorlage (Datum Pflicht)</option></select></label>
        <label className="adm-field"><span className="adm-label">Fällig am</span><input type="date" className="adm-input" value={d.dueDate} onChange={(e) => setD({ ...d, dueDate: e.target.value })} /></label>
        <label className="adm-field"><span className="adm-label">Priorität</span>
          <select className="adm-input" value={d.priority} onChange={(e) => setD({ ...d, priority: e.target.value })}>{Object.entries(PRIORITY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="adm-field"><span className="adm-label">Zuständig</span>
          <select className="adm-input" value={d.assigneeId} disabled={people.length <= 1} onChange={(e) => setD({ ...d, assigneeId: e.target.value })}>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="adm-field span-2"><span className="adm-label">Notiz (optional)</span><textarea className="adm-input" rows={2} maxLength={2000} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} /></label>
      </div>
      {err && <div className="adm-alert adm-alert-danger" role="alert"><AdminIcon name="alert" />{err}</div>}
      <div className="adm-actions"><button type="submit" className="adm-btn" disabled={pending}><AdminIcon name={d.id ? 'check' : 'plus'} />{d.id ? 'Speichern' : 'Anlegen'}</button>{onDone && <button type="button" className="adm-btn adm-btn-ghost" onClick={onDone}>Abbrechen</button>}</div>
    </form>
  );
}

export function TaskList({ tasks, people, canWrite, showCase = true, empty, caseNumber }: { tasks: TView[]; people: Person[]; canWrite: boolean; showCase?: boolean; empty?: string; caseNumber?: string | null }) {
  const { run, pending } = useRun();
  const [editing, setEditing] = useState<string | null>(null);
  const [pickDate, setPickDate] = useState<{ id: string; value: string } | null>(null);
  if (tasks.length === 0) return <p className="t-3" style={{ margin: 0 }}>{empty ?? 'Keine Einträge.'}</p>;
  return (
    <ul className="adm-list task-list">
      {tasks.map((t) => {
        const open = t.status === 'OPEN';
        const cn = caseNumber ?? t.caseNumber;
        return (
          <li key={t.id} className={t.overdue ? 'is-overdue' : undefined} style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {editing === t.id ? (
              <div style={{ width: '100%' }}><TaskForm people={people} defaultAssigneeId={t.assignee?.id ?? ''} initial={t} caseNumber={cn} onDone={() => setEditing(null)} /></div>
            ) : (
              <>
                <input type="checkbox" className="task-check" aria-label={open ? `„${t.title}“ als erledigt markieren` : `„${t.title}“ wieder öffnen`} checked={!open} disabled={!canWrite || pending || t.status === 'CANCELLED'}
                  onChange={() => run(() => (open ? completeTaskAction({ id: t.id, caseNumber: cn }) : reopenTaskAction({ id: t.id, caseNumber: cn })))} />
                <span className="main" style={{ flex: 1, minWidth: 0 }}>
                  <b style={open ? undefined : { textDecoration: 'line-through', opacity: 0.7 }}>{t.title}</b>
                  <span className="secondary">
                    {t.kind === 'FOLLOW_UP' && <Badge tone="info">Wiedervorlage</Badge>}{' '}
                    {t.priority !== 'NORMAL' && <Badge tone={t.priority === 'URGENT' ? 'danger' : 'warn'}>{PRIORITY_LABELS[t.priority]}</Badge>}{' '}
                    <span className={t.overdue ? 'task-due is-late' : 'task-due'}>{t.overdue ? 'Überfällig seit ' : t.dueToday ? 'Heute fällig' : 'Fällig '}{t.dueToday ? '' : de(t.dueDate)}</span>
                    {t.assignee && <> · {t.assignee.name}</>}
                    {showCase && cn && <> · <Link href={`/admin/faelle/${cn}/`} className="mono">{cn}</Link></>}
                    {showCase && t.leadId && <> · <Link href={`/admin/anfragen/${t.leadId}/`}>Anfrage {t.leadName}</Link></>}
                    {showCase && t.customerId && <> · <Link href={`/admin/kunden/${t.customerId}/`}>{t.customerName}</Link></>}
                  </span>
                  {t.description && <span className="t-2" style={{ fontSize: 12.5, whiteSpace: 'pre-wrap' }}>{t.description}</span>}
                </span>
                {canWrite && open && (
                  <span className="dm-entry-actions">
                    <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" disabled={pending} onClick={() => run(() => snoozeTaskAction({ id: t.id, days: 1, caseNumber: cn }))}>+1 Tag</button>
                    <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" disabled={pending} onClick={() => run(() => snoozeTaskAction({ id: t.id, days: 7, caseNumber: cn }))}>+1 Woche</button>
                    {pickDate?.id === t.id ? (
                      <span className="adm-actions" style={{ gap: 4 }}>
                        <input type="date" className="adm-input" aria-label="Neues Datum" value={pickDate.value} onChange={(e) => setPickDate({ id: t.id, value: e.target.value })} />
                        <button type="button" className="adm-btn adm-btn-sm" disabled={pending || !pickDate.value} onClick={() => run(() => snoozeTaskAction({ id: t.id, date: pickDate.value, caseNumber: cn }), () => setPickDate(null))}>OK</button>
                      </span>
                    ) : <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => setPickDate({ id: t.id, value: '' })}>Datum …</button>}
                    <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" onClick={() => setEditing(t.id)}>Bearbeiten</button>
                    <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" disabled={pending} onClick={() => { if (window.confirm(`„${t.title}“ abbrechen?`)) run(() => cancelTaskAction({ id: t.id, caseNumber: cn })); }}>Abbrechen</button>
                  </span>
                )}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function MarkAllRead() {
  const { run, pending } = useRun();
  return <button type="button" className="adm-btn adm-btn-ghost adm-btn-sm" disabled={pending} onClick={() => run(() => markReadAction({}))}>Alle als gelesen markieren</button>;
}
