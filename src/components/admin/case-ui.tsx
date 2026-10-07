import Link from 'next/link';
import { AdminIcon } from './AdminIcon';
import { CASE_PROGRESS, caseProgressIndex, type CaseStatusKey, type PriorityKey, PRIORITY_LABELS } from '@/lib/workflow';
import type { CheckItem } from '@/server/pipeline/case-checklist';
import { Badge } from './ui';

/** Fortschritt: Anfrage → Termin → Besichtigung → Kalkulation → Gutachten → Versand → Abrechnung. */
export function CaseProgress({ status }: { status: CaseStatusKey }) {
  const cancelled = status === 'CANCELLED';
  const idx = caseProgressIndex(status);
  return (
    <ol className="adm-progress" aria-label="Fallfortschritt" data-cancelled={cancelled}>
      {CASE_PROGRESS.map((label, i) => {
        const s = cancelled ? 'todo' : i < idx ? 'done' : i === idx ? 'current' : 'todo';
        return (
          <li key={label} data-s={s} aria-current={s === 'current' ? 'step' : undefined}>
            <span className="dot"><AdminIcon name="check" /></span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

export function PriorityBadge({ priority, always = false }: { priority: PriorityKey; always?: boolean }) {
  if (priority === 'NORMAL' && !always) return null;
  return <Badge tone={priority === 'URGENT' ? 'danger' : priority === 'HIGH' ? 'warn' : 'muted'}>{PRIORITY_LABELS[priority]}</Badge>;
}

/** Checkliste mit ✓ / ○ / ! – Zeilen führen (wenn möglich) direkt zum passenden Reiter. */
export function Checklist({ items, base }: { items: CheckItem[]; base: string }) {
  return (
    <ul className="adm-checks">
      {items.map((i) => {
        const inner = (
          <>
            <span className="ic"><AdminIcon name={i.state === 'done' ? 'check' : i.state === 'na' ? 'x' : 'alert'} /></span>
            <span>{i.label}</span>
            {i.hint ? <span className="hint">{i.hint}</span> : i.state === 'na' ? <span className="hint">nicht nötig</span> : null}
          </>
        );
        return (
          <li key={i.key} data-s={i.state}>
            {i.tab && i.state !== 'done' ? <Link href={`${base}?tab=${i.tab}`}>{inner}</Link> : inner}
          </li>
        );
      })}
    </ul>
  );
}
