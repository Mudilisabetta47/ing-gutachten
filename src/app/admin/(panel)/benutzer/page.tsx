import type { Metadata } from 'next';
import Link from 'next/link';
import type { Role } from '@prisma/client';
import { requirePagePermission, can } from '@/server/auth/guards';
import { ROLE_LABELS } from '@/server/auth/permissions';
import { listUsers, ROLES } from '@/server/users';
import { PageHeader, Pagination, fmtDateTime } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Benutzer' };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; rolle?: string; seite?: string }> }) {
  const user = await requirePagePermission('users.read');
  const sp = await searchParams;
  const role = ROLES.find((r) => r === sp.rolle) as Role | undefined;
  const page = Math.max(1, Number(sp.seite) || 1);
  const { total, items, pageSize } = await listUsers({ q: sp.q?.trim() || undefined, role, page });

  return (
    <>
      <PageHeader
        title="Benutzer"
        intro="Mitarbeiter und ihre Rollen. Rechte werden serverseitig geprüft; Rollenwechsel und Deaktivierung beenden laufende Sitzungen sofort."
        actions={
          can(user, 'users.write') ? (
            <Link href="/admin/benutzer/neu" className="adm-btn">
              Benutzer anlegen
            </Link>
          ) : null
        }
      />

      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={sp.q} placeholder="Name oder E-Mail" className="adm-input !w-auto min-w-[220px] flex-1" aria-label="Suche" />
        <select name="rolle" defaultValue={role ?? ''} className="adm-input !w-auto" aria-label="Rolle filtern">
          <option value="">Alle Rollen</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <button type="submit" className="adm-btn adm-btn-ghost">
          Filtern
        </button>
      </form>

      <div className="adm-card overflow-hidden !p-0">
        <table className="adm-table adm-stack">
          <thead>
            <tr>
              <th>Name</th>
              <th>E-Mail</th>
              <th>Rolle</th>
              <th>Status</th>
              <th>Letzte Anmeldung</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-fg-mute">
                  Keine Benutzer gefunden.
                </td>
              </tr>
            )}
            {items.map((u) => (
              <tr key={u.id}>
                <td data-label="Name">
                  {can(user, 'users.write') ? (
                    <Link href={`/admin/benutzer/${u.id}`} className="adm-link font-medium">
                      {u.firstName} {u.lastName}
                    </Link>
                  ) : (
                    <span className="font-medium">
                      {u.firstName} {u.lastName}
                    </span>
                  )}
                  {u.employee?.isExpert ? <span className="adm-pill ml-2">Gutachter</span> : null}
                </td>
                <td data-label="E-Mail" className="text-fg-dim">
                  {u.email}
                </td>
                <td data-label="Rolle">{ROLE_LABELS[u.role]}</td>
                <td data-label="Status">
                  <span className={`adm-pill ${u.isActive ? 'adm-pill-ok' : 'adm-pill-off'}`}>{u.isActive ? 'aktiv' : 'deaktiviert'}</span>
                </td>
                <td data-label="Letzte Anmeldung" className="font-mono text-[.78rem] text-fg-mute">
                  {fmtDateTime(u.lastLoginAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination total={total} page={page} pageSize={pageSize} basePath="/admin/benutzer" params={{ q: sp.q, rolle: role }} />
    </>
  );
}
