import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { assignees, listTasks, myNotifications, taskStats } from '@/server/pipeline/tasks';
import { EmptyState, FilterChips, Kpi, Kpis, PageHeader, Pagination, Section, hrefWith, qp, qpage, fmtWhen, type Chip } from '@/components/admin/ui';
import { MarkAllRead, TaskForm, TaskList } from '@/components/admin/TaskParts';
import { AutoForm } from '@/components/admin/AutoForm';
import { AdminIcon } from '@/components/admin/AdminIcon';

export const metadata: Metadata = { title: 'Aufgaben' };

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('tasks.read.all', 'tasks.read.own');
  const sp = await searchParams;
  const all = user.permissions.has('tasks.read.all');
  const canWrite = user.permissions.has('tasks.write.all') || user.permissions.has('tasks.write.own');
  const view = all && qp(sp.ansicht) === 'alle' ? 'all' : 'mine';
  const status = qp(sp.status) === 'done' ? 'done' : 'open';
  const due = (['overdue', 'today', 'week'] as const).find((d) => d === qp(sp.faellig)) ?? (qp(sp.faellig) === '1' ? 'week' : undefined);
  const kind = qp(sp.art) === 'FOLLOW_UP' ? 'FOLLOW_UP' : qp(sp.art) === 'TASK' ? 'TASK' : undefined;
  const q = qp(sp.q);
  const [list, stats, people, notes] = await Promise.all([
    listTasks(user, { view, status, due, kind, q, page: qpage(sp.seite) }),
    taskStats(user),
    canWrite ? assignees(user) : Promise.resolve([]),
    myNotifications(user, 15),
  ]);
  const unread = notes.filter((n) => !n.read);
  const base = '/admin/aufgaben';
  const params = { ansicht: view === 'all' ? 'alle' : undefined, status: status === 'done' ? 'done' : undefined, faellig: due, art: kind, q };
  const chips: Chip[] = [
    q && { label: 'Suche', value: q, href: hrefWith(base, { ...params, q: undefined }) },
    due && { label: 'Fällig', value: due === 'overdue' ? 'überfällig' : due === 'today' ? 'heute' : 'diese Woche', href: hrefWith(base, { ...params, faellig: undefined }) },
    kind && { label: 'Art', value: kind === 'FOLLOW_UP' ? 'Wiedervorlagen' : 'Aufgaben', href: hrefWith(base, { ...params, art: undefined }) },
  ].filter(Boolean) as Chip[];
  const tv = (t: (typeof list.rows)[number]) => ({ ...t, completedAt: undefined, createdAt: undefined }) as never;
  return (
    <>
      <PageHeader title="Aufgaben" intro={view === 'all' ? 'Alle Aufgaben und Wiedervorlagen im Betrieb.' : 'Ihre Aufgaben und Wiedervorlagen.'} />
      {stats && (
        <Kpis>
          <Kpi label="Offen (meine)" value={stats.open} href={hrefWith(base, {})} />
          <Kpi label="Überfällig" value={stats.overdue} warn={stats.overdue > 0} href={hrefWith(base, { faellig: 'overdue' })} />
          <Kpi label="Heute fällig" value={stats.dueToday} href={hrefWith(base, { faellig: 'today' })} />
          <Kpi label="Wiedervorlagen fällig" value={stats.followUpsDue} href={hrefWith(base, { art: 'FOLLOW_UP', faellig: 'week' })} />
        </Kpis>
      )}

      {notes.length > 0 && (
        <Section title={`Hinweise & Erwähnungen${unread.length ? ` · ${unread.length} neu` : ''}`}
          aside={unread.length ? <MarkAllRead /> : undefined}>
          <ul className="adm-list">{notes.map((n) => (
            <li key={n.id} style={n.read ? { opacity: 0.65 } : undefined}>
              <span className="main">{n.href ? <Link href={n.href} className="stretch">{n.text}</Link> : n.text}<span className="secondary">{fmtWhen(n.createdAt)}{n.read ? '' : ' · neu'}</span></span>
            </li>
          ))}</ul>
        </Section>
      )}

      {canWrite && (
        <details className="adm-card" open={qp(sp.neu) === '1'} style={{ padding: 14, marginBottom: 14 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}><AdminIcon name="plus" /> Neue Aufgabe oder Wiedervorlage</summary>
          <div style={{ marginTop: 12 }}><TaskForm people={people} defaultAssigneeId={user.id} /></div>
        </details>
      )}

      <nav className="adm-seg" aria-label="Ansicht">
        <Link href={hrefWith(base, { ...params, ansicht: undefined, status: undefined, seite: undefined })} aria-current={view === 'mine' && status === 'open' ? 'page' : undefined}>Meine</Link>
        {all && <Link href={hrefWith(base, { ...params, ansicht: 'alle', status: undefined, seite: undefined })} aria-current={view === 'all' && status === 'open' ? 'page' : undefined}>Alle</Link>}
        <Link href={hrefWith(base, { ...params, status: 'done', seite: undefined })} aria-current={status === 'done' ? 'page' : undefined}>Erledigt</Link>
      </nav>
      <AutoForm action={base}>
        {params.ansicht && <input type="hidden" name="ansicht" value="alle" />}
        {status === 'done' && <input type="hidden" name="status" value="done" />}
        <div className="grow adm-input-group"><AdminIcon name="search" /><input name="q" defaultValue={q} className="adm-input" placeholder="Titel oder Fallnummer" autoComplete="off" aria-label="Suche" /></div>
      </AutoForm>
      <FilterChips chips={chips} clearHref={base} />
      {list.rows.length === 0 ? (
        <EmptyState icon="checksq" title={status === 'done' ? 'Noch nichts erledigt' : chips.length ? 'Keine Aufgaben für diese Filter' : 'Keine offenen Aufgaben'}>
          {status === 'done' ? 'Erledigte Aufgaben erscheinen hier.' : chips.length ? 'Passen Sie die Filter an.' : 'Alles erledigt – oder legen Sie oben eine neue Aufgabe an.'}
        </EmptyState>
      ) : (
        <TaskList tasks={list.rows.map(tv)} people={people} canWrite={canWrite} />
      )}
      <Pagination total={list.total} page={list.page} pageSize={list.pageSize} basePath={base} params={params} noun="Aufgaben" />
    </>
  );
}
