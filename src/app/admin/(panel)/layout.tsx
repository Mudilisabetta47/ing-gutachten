import type { ReactNode } from 'react';
import { requireUser } from '@/server/auth/guards';
import { visibleNav, upcomingNav } from '@/server/admin/nav';
import { ROLE_LABELS } from '@/server/auth/permissions';
import { AdminShell } from '@/components/admin/AdminShell';
import { logoutAction } from './actions';

export default async function PanelLayout({ children }: { children: ReactNode }) {
  // Passwortwechsel-Pflicht wird in den Seiten erzwungen; das Layout selbst muss die Profilseite rendern können.
  const user = await requireUser({ allowPasswordChange: true });
  const has = (p: Parameters<typeof visibleNav>[0] extends (p: infer P) => boolean ? P : never) => user.permissions.has(p);
  const nav = visibleNav(has).map(({ href, label, icon }) => ({ href, label, icon }));
  const upcoming = upcomingNav(has).map(({ label, phase }) => ({ label, phase }));

  return (
    <AdminShell
      nav={nav}
      upcoming={upcoming}
      user={{ name: `${user.firstName} ${user.lastName}`, role: ROLE_LABELS[user.role] }}
      logout={
        <form action={logoutAction}>
          <button type="submit" className="adm-btn adm-btn-ghost w-full">
            Abmelden
          </button>
        </form>
      }
    >
      {children}
    </AdminShell>
  );
}
