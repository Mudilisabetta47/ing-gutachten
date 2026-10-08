import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/server/db';
import { requirePagePermission } from '@/server/auth/guards';
import { assignees, listTasks } from '@/server/pipeline/tasks';
import { addDays, berlinToday, dueBucket } from '@/lib/tasks';
import { EmptyState, PageHeader, Section } from '@/components/admin/ui';
import { TaskForm, TaskList } from '@/components/admin/TaskParts';

export const metadata: Metadata = { title: 'Wiedervorlagen' };
const GROUPS = [['overdue', 'Überfällig'], ['today', 'Heute'], ['week', 'Diese Woche'], ['later', 'Später']] as const;

export default async function FollowUpsPage() {
  const user = await requirePagePermission('tasks.read.all', 'tasks.read.own', 'leads.read');
  const canTasks = user.permissions.has('tasks.read.all') || user.permissions.has('tasks.read.own');
  const canWrite = user.permissions.has('tasks.write.all') || user.permissions.has('tasks.write.own');
  const today = berlinToday(), weekEnd = addDays(today, 7);
  const [tasks, people, leads] = await Promise.all([
    canTasks ? listTasks(user, { kind: 'FOLLOW_UP', view: user.permissions.has('tasks.read.all') ? 'all' : 'mine' }) : Promise.resolve({ rows: [] as Awaited<ReturnType<typeof listTasks>>['rows'] }),
    canWrite ? assignees(user) : Promise.resolve([]),
    user.permissions.has('leads.read')
      ? db.lead.findMany({ where: { deletedAt: null, status: { notIn: ['CONVERTED', 'CLOSED', 'SPAM'] }, nextActionAt: { not: null } }, orderBy: { nextActionAt: 'asc' }, take: 50, select: { id: true, name: true, nextActionAt: true, phone: true, reason: true } })
      : Promise.resolve([]),
  ]);
  const leadDay = (d: Date | null) => (d ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(d) : null);
  const tv = (t: (typeof tasks.rows)[number]) => ({ ...t, completedAt: undefined, createdAt: undefined }) as never;
  const total = tasks.rows.length + leads.length;
  return (
    <>
      <PageHeader title="Wiedervorlagen" intro="Alles, was zu einem bestimmten Tag wieder auf den Tisch kommt – Wiedervorlagen aus Fällen und die nächsten Schritte bei Anfragen." />
      {canWrite && (
        <details className="adm-card" style={{ padding: 14, marginBottom: 14 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Neue Wiedervorlage</summary>
          <div style={{ marginTop: 12 }}><TaskForm people={people} defaultAssigneeId={user.id} defaultKind="FOLLOW_UP" /></div>
        </details>
      )}
      {total === 0 ? <EmptyState icon="repeat" title="Keine Wiedervorlagen">Setzen Sie bei einer Anfrage einen nächsten Schritt oder legen Sie eine Wiedervorlage an.</EmptyState> : GROUPS.map(([key, label]) => {
        const ts = tasks.rows.filter((t) => dueBucket(t.dueDate, today, weekEnd) === key);
        const ls = leads.filter((l) => dueBucket(leadDay(l.nextActionAt), today, weekEnd) === key);
        if (!ts.length && !ls.length) return null;
        return (
          <Section key={key} title={`${label} · ${ts.length + ls.length}`}>
            {ts.length > 0 && <TaskList tasks={ts.map(tv)} people={people} canWrite={canWrite} />}
            {ls.length > 0 && (
              <ul className="adm-list">{ls.map((l) => (
                <li key={l.id}><span className="main"><Link href={`/admin/anfragen/${l.id}/`} className="stretch">Anfrage: {l.name}</Link><span className="secondary">{l.reason} · nächster Schritt am {leadDay(l.nextActionAt)!.split('-').reverse().join('.')}</span></span></li>
              ))}</ul>
            )}
          </Section>
        );
      })}
    </>
  );
}
