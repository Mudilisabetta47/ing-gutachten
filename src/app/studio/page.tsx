import { requireUser } from '@/server/auth/guards';
import { ROLE_LABELS } from '@/server/auth/permissions';
import { appsFor } from '@/lib/studio-apps';
import { getStudioPrefs } from '@/server/studio/prefs';
import { dashboardCounts } from '@/server/pipeline/today';
import { myNotifications } from '@/server/pipeline/tasks';
import { buildNotices } from '@/server/admin/notices';
import { StudioDesktop } from '@/components/studio/StudioDesktop';
import { SysIcon } from '@/components/studio/StudioIcon';
import { logoutAction } from '@/app/admin/(panel)/actions';

/** ING Studio: Desktop-Oberfläche nach der Anmeldung. Apps, Hinweise und Einstellungen kommen nach Rolle und Konto vom Server. */
export default async function StudioPage() {
  const user = await requireUser();
  const apps = appsFor((p) => user.permissions.has(p));
  const allowed = new Set(apps.map((a) => a.id));
  const [prefs, counts, notifs] = await Promise.all([getStudioPrefs(user, allowed), dashboardCounts(user), myNotifications(user, 12)]);
  return (
    <StudioDesktop
      apps={apps}
      prefs={prefs}
      user={{ name: `${user.firstName} ${user.lastName}`, role: ROLE_LABELS[user.role], email: user.email }}
      initialNotices={buildNotices(counts)}
      initialNotifs={notifs.map((n) => ({ id: n.id, text: n.text, href: n.href, read: n.read, at: n.createdAt.toISOString() }))}
      canSearch={user.permissions.has('search.global')}
      logout={
        <form action={logoutAction}>
          <button type="submit" className="st-iconbtn" aria-label="Abmelden" title="Abmelden"><SysIcon name="power" /></button>
        </form>
      }
    />
  );
}
