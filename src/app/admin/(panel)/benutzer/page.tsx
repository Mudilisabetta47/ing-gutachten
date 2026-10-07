import type { Metadata } from 'next';
import Link from 'next/link';
import type { Role } from '@prisma/client';
import { requirePagePermission, can } from '@/server/auth/guards';
import { ROLE_LABELS } from '@/server/auth/permissions';
import { listUsers, ROLES } from '@/server/users';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { AutoForm } from '@/components/admin/AutoForm';
import { Avatar, Badge, EmptyState, FilterChips, PageHeader, Pagination, fmtWhen, hrefWith, type Chip } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Benutzer' };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; rolle?: string; seite?: string }> }) {
  const user = await requirePagePermission('users.read');
  const sp = await searchParams;
  const role = ROLES.find((r) => r === sp.rolle) as Role | undefined;
  const page = Math.max(1, Number(sp.seite) || 1);
  const { total, items, pageSize } = await listUsers({ q: sp.q?.trim() || undefined, role, page });
  const base = '/admin/benutzer';
  const chips: Chip[] = [
    sp.q && { label: 'Suche', value: sp.q, href: hrefWith(base, { rolle: role }) },
    role && { label: 'Rolle', value: ROLE_LABELS[role], href: hrefWith(base, { q: sp.q }) },
  ].filter(Boolean) as Chip[];

  return (
    <>
      <PageHeader
        title="Benutzer"
        intro="Mitarbeiter und ihre Rollen. Rechte werden serverseitig geprüft; Rollenwechsel und Deaktivierung beenden laufende Sitzungen sofort."
        actions={can(user, 'users.write') ? <Link href="/admin/benutzer/neu/" className="adm-btn"><AdminIcon name="plus" />Benutzer anlegen</Link> : null}
      />
      <AutoForm action={base}>
        <div className="grow adm-input-group">
          <AdminIcon name="search" />
          <input name="q" defaultValue={sp.q} placeholder="Name oder E-Mail" className="adm-input" aria-label="Suche" autoComplete="off" />
        </div>
        <select name="rolle" defaultValue={role ?? ''} className="adm-input" aria-label="Rolle filtern">
          <option value="">Alle Rollen</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </AutoForm>
      <FilterChips chips={chips} clearHref={base} />

      {items.length === 0 ? (
        <EmptyState icon="user" title="Keine Benutzer gefunden" action={chips.length ? <Link href={base} className="adm-btn adm-btn-secondary">Filter zurücksetzen</Link> : undefined}>Passen Sie Suche oder Rolle an.</EmptyState>
      ) : (
        <div className="dt-wrap">
          <table className="dt">
            <thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th><th>Status</th><th>Letzte Anmeldung</th></tr></thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} className={u.isActive ? undefined : 'muted-row'}>
                  <td data-slot="title">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={`${u.firstName} ${u.lastName}`} size="sm" />
                      {can(user, 'users.write') ? <Link href={`/admin/benutzer/${u.id}/`} className="primary stretch">{u.firstName} {u.lastName}</Link> : <span className="primary">{u.firstName} {u.lastName}</span>}
                      {u.employee?.isExpert ? <Badge tone="info">Gutachter</Badge> : null}
                    </span>
                  </td>
                  <td data-slot="sub" className="t-2">{u.email}</td>
                  <td data-slot="meta">{ROLE_LABELS[u.role]}</td>
                  <td data-slot="badge"><Badge tone={u.isActive ? 'ok' : 'muted'}>{u.isActive ? 'Aktiv' : 'Deaktiviert'}</Badge></td>
                  <td data-slot="hide" className="nowrap t-2">{u.lastLoginAt ? fmtWhen(u.lastLoginAt) : 'Noch nie'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination total={total} page={page} pageSize={pageSize} basePath={base} params={{ q: sp.q, rolle: role }} noun="Benutzer" />
    </>
  );
}
