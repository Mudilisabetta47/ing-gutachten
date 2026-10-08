import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { requireUser } from '@/server/auth/guards';
import { readTheme } from '@/server/admin/theme';
import { NAV_GROUPS, navFor } from '@/server/admin/nav';
import { ROLE_LABELS } from '@/server/auth/permissions';
import { dashboardCounts } from '@/server/pipeline/today';
import { AdminShell, type ShellAction, type ShellNotice } from '@/components/admin/AdminShell';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { logoutAction } from './actions';

export default async function PanelLayout({ children }: { children: ReactNode }) {
  // Passwortwechsel-Pflicht wird in den Seiten erzwungen; das Layout selbst muss die Profilseite rendern können.
  const user = await requireUser({ allowPasswordChange: true });
  const has = (p: Parameters<typeof navFor>[0] extends (p: infer P) => boolean ? P : never) => user.permissions.has(p);
  const jar = await cookies();
  const theme = readTheme(jar);

  // Hinweise und Zähler: echte Daten, nur soweit die Rolle sie sehen darf.
  const c = user.mustChangePassword ? null : await dashboardCounts(user);
  const badge: Record<string, number | null | undefined> = { leads: c?.newLeads, reports: c?.reviewsPending, invoices: c?.finance?.overdueCount, reminders: c?.followUpsDue };
  const nav = navFor(has).map(({ href, label, icon, group, ready, phase, note, badge: b }) => ({ href, label, icon, group, ready, phase, note, count: (b && badge[b]) || undefined }));
  const notices: ShellNotice[] = [];
  if (c?.newLeads) notices.push({ id: 'new', label: 'Neue Anfragen', href: '/admin/anfragen?status=NEW', count: c.newLeads, tone: 'info' });
  if (c?.failedMail) notices.push({ id: 'mail', label: 'Ohne Mail-Benachrichtigung', href: '/admin/anfragen?mail=failed', count: c.failedMail, tone: 'warn' });
  if (c?.followUpsDue) notices.push({ id: 'fu', label: 'Fällige Wiedervorlagen', href: '/admin/heute', count: c.followUpsDue, tone: 'warn' });
  if (c?.tasks && (c.tasks.overdue || c.tasks.dueToday)) notices.push({ id: 'tasks', label: 'Aufgaben fällig oder überfällig', href: '/admin/aufgaben/?faellig=1', count: c.tasks.overdue + c.tasks.dueToday, tone: c.tasks.overdue ? 'warn' : 'info' });
  if (c?.unreadNotes) notices.push({ id: 'notes', label: 'Neue Hinweise & Erwähnungen', href: '/admin/aufgaben/', count: c.unreadNotes, tone: 'info' });
  if (c?.finance?.overdueCount) notices.push({ id: 'overdue', label: 'Überfällige Rechnungen', href: '/admin/rechnungen/?status=OVERDUE', count: c.finance.overdueCount, tone: 'warn' });
  if (c?.reviewsPending) notices.push({ id: 'reviews', label: 'Gutachten zur Prüfung', href: '/admin/gutachten?status=IN_REVIEW', count: c.reviewsPending, tone: 'info' });
  if (c?.unassigned) notices.push({ id: 'unassigned', label: 'Fälle ohne Sachverständigen', href: '/admin/faelle?status=open&sv=none', count: c.unassigned, tone: 'warn' });

  const actions: ShellAction[] = [];
  if (has('cases.write.all')) actions.push({ id: 'new-case', label: 'Neuer Fall', href: '/admin/faelle/neu/', icon: 'case' });
  if (has('tasks.write.all') || has('tasks.write.own')) actions.push({ id: 'new-task', label: 'Neue Aufgabe', href: '/admin/aufgaben/?neu=1', icon: 'checksq' });
  if (has('customers.write')) actions.push({ id: 'new-customer', label: 'Neuer Kunde', href: '/admin/kunden/neu/', icon: 'users' });
  if (has('users.write')) actions.push({ id: 'new-user', label: 'Neuer Benutzer', href: '/admin/benutzer/neu/', icon: 'user' });

  return (
    <AdminShell
      nav={nav}
      groups={NAV_GROUPS}
      actions={actions}
      notices={notices}
      canSearch={has('search.global')}
      theme={theme}
      collapsedInitially={jar.get('ing_nav')?.value === 'collapsed'}
      user={{ name: `${user.firstName} ${user.lastName}`, role: ROLE_LABELS[user.role], email: user.email }}
      logout={
        <form action={logoutAction}>
          <button type="submit" className="adm-menu-item" role="menuitem">
            <AdminIcon name="logout" />
            Abmelden
          </button>
        </form>
      }
    >
      {children}
    </AdminShell>
  );
}
