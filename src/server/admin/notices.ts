import 'server-only';
import type { dashboardCounts } from '@/server/pipeline/today';

export type Notice = { id: string; label: string; href: string; count: number; tone: 'info' | 'warn' | 'danger' };

/** Offene Hinweise aus den echten Zählern – dieselbe Liste für Glocke im Operating System und Benachrichtigungszentrale im Studio. */
export function buildNotices(c: Awaited<ReturnType<typeof dashboardCounts>> | null): Notice[] {
  const notices: Notice[] = [];
  if (!c) return notices;
  if (c.newLeads) notices.push({ id: 'new', label: 'Neue Anfragen', href: '/admin/anfragen?status=NEW', count: c.newLeads, tone: 'info' });
  if (c.failedMail) notices.push({ id: 'mail', label: 'Ohne Mail-Benachrichtigung', href: '/admin/anfragen?mail=failed', count: c.failedMail, tone: 'warn' });
  if (c.followUpsDue) notices.push({ id: 'fu', label: 'Fällige Wiedervorlagen', href: '/admin/heute', count: c.followUpsDue, tone: 'warn' });
  if (c.tasks && (c.tasks.overdue || c.tasks.dueToday)) notices.push({ id: 'tasks', label: 'Aufgaben fällig oder überfällig', href: '/admin/aufgaben/?faellig=1', count: c.tasks.overdue + c.tasks.dueToday, tone: c.tasks.overdue ? 'warn' : 'info' });
  if (c.unreadNotes) notices.push({ id: 'notes', label: 'Neue Hinweise & Erwähnungen', href: '/admin/aufgaben/', count: c.unreadNotes, tone: 'info' });
  if (c.finance?.overdueCount) notices.push({ id: 'overdue', label: 'Überfällige Rechnungen', href: '/admin/rechnungen/?status=OVERDUE', count: c.finance.overdueCount, tone: 'warn' });
  if (c.reviewsPending) notices.push({ id: 'reviews', label: 'Gutachten zur Prüfung', href: '/admin/gutachten?status=IN_REVIEW', count: c.reviewsPending, tone: 'info' });
  if (c.unassigned) notices.push({ id: 'unassigned', label: 'Fälle ohne Sachverständigen', href: '/admin/faelle?status=open&sv=none', count: c.unassigned, tone: 'warn' });
  return notices;
}
