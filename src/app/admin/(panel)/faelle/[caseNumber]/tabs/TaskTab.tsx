import type { AuthUser } from '@/server/auth/session-types';
import { assignees, caseTasks } from '@/server/pipeline/tasks';
import { EmptyState, Section } from '@/components/admin/ui';
import { TaskForm, TaskList } from '@/components/admin/TaskParts';

/** Reiter „Aufgaben“: Aufgaben und Wiedervorlagen dieses Falls. */
export async function TaskTab({ user, caseId, caseNumber }: { user: AuthUser; caseId: string; caseNumber: string }) {
  const canRead = user.permissions.has('tasks.read.all') || user.permissions.has('tasks.read.own');
  if (!canRead) return <EmptyState icon="lock" title="Kein Zugriff">Für Aufgaben fehlt die Berechtigung.</EmptyState>;
  const canWrite = user.permissions.has('tasks.write.all') || user.permissions.has('tasks.write.own');
  const [tasks, people] = await Promise.all([caseTasks(user, caseId), canWrite ? assignees(user) : Promise.resolve([])]);
  const open = tasks.filter((t) => t.status === 'OPEN'), rest = tasks.filter((t) => t.status !== 'OPEN');
  const tv = (t: (typeof tasks)[number]) => ({ ...t, completedAt: undefined, createdAt: undefined }) as never;
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <Section title={`Offen (${open.length})`}>
        <TaskList tasks={open.map(tv)} people={people} canWrite={canWrite} showCase={false} caseNumber={caseNumber} empty="Keine offenen Aufgaben zu diesem Fall." />
      </Section>
      {canWrite && <Section title="Neue Aufgabe oder Wiedervorlage"><TaskForm people={people} defaultAssigneeId={user.id} caseId={caseId} caseNumber={caseNumber} /></Section>}
      {rest.length > 0 && <Section title={`Erledigt / abgebrochen (${rest.length})`}><TaskList tasks={rest.map(tv)} people={people} canWrite={canWrite} showCase={false} caseNumber={caseNumber} /></Section>}
    </div>
  );
}
