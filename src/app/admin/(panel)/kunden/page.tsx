import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { listCustomers } from '@/server/pipeline/customers';
import { PAGE_SIZE } from '@/server/pipeline/leads';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { AutoForm } from '@/components/admin/AutoForm';
import { Menu } from '@/components/admin/Overlay';
import { Badge, EmptyState, FilterChips, PageHeader, Pagination, SortTh, fmtWhen, hrefWith, phoneHref, qp, qpage, type Chip } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Kunden' };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('customers.read', 'customers.read.own');
  const sp = await searchParams;
  const f = { q: qp(sp.q), archiv: qp(sp.archiv) === '1', sort: qp(sp.sort), dir: qp(sp.dir) };
  const list = await listCustomers(user, { ...f, page: qpage(sp.seite) });
  const canDelete = user.permissions.has('customers.delete');
  const base = '/admin/kunden';
  const params = { q: f.q, archiv: f.archiv ? '1' : undefined, sort: f.sort, dir: f.dir };
  const chips: Chip[] = [
    f.q && { label: 'Suche', value: f.q, href: hrefWith(base, { ...params, q: undefined }) },
    f.archiv && { label: 'Archiv', value: 'anzeigen', href: hrefWith(base, { ...params, archiv: undefined }) },
  ].filter(Boolean) as Chip[];
  const sortProps = { sort: f.sort ?? 'name', dir: f.dir ?? 'asc', basePath: base, params };

  return (
    <>
      <PageHeader
        title="Kunden"
        intro={user.permissions.has('customers.read') ? undefined : 'Sie sehen die Kunden Ihrer zugewiesenen Fälle.'}
        actions={user.permissions.has('customers.write') ? <Link href="/admin/kunden/neu/" className="adm-btn"><AdminIcon name="plus" />Kunde anlegen</Link> : null}
      />
      <AutoForm action={base}>
        {f.sort && <input type="hidden" name="sort" value={f.sort} />}
        {f.dir && <input type="hidden" name="dir" value={f.dir} />}
        <div className="grow adm-input-group">
          <AdminIcon name="search" />
          <input name="q" defaultValue={f.q} className="adm-input" placeholder="Name, Firma, Telefon, E-Mail, Kennzeichen" autoComplete="off" aria-label="Suche" />
        </div>
        {canDelete && <label className="adm-check"><input type="checkbox" name="archiv" value="1" defaultChecked={f.archiv} /> Archiv</label>}
      </AutoForm>
      <FilterChips chips={chips} clearHref={base} />

      {list.rows.length === 0 ? (
        <EmptyState icon="users" title={chips.length ? 'Keine Kunden gefunden' : 'Noch keine Kunden'}
          action={chips.length ? <Link href={base} className="adm-btn adm-btn-secondary">Suche zurücksetzen</Link> : user.permissions.has('customers.write') ? <Link href="/admin/kunden/neu/" className="adm-btn">Kunde anlegen</Link> : undefined}>
          {chips.length ? 'Passen Sie die Suche an.' : 'Kunden entstehen, wenn eine Anfrage in einen Fall umgewandelt wird – oder Sie legen einen Kunden von Hand an.'}
        </EmptyState>
      ) : (
        <div className="dt-wrap">
          <table className="dt">
            <thead>
              <tr>
                <SortTh label="Kunde" field="name" {...sortProps} />
                <th>Telefon</th>
                <th>E-Mail</th>
                <SortTh label="Ort" field="ort" {...sortProps} />
                <th className="num">Fälle</th>
                <th className="num">Fahrzeuge</th>
                <SortTh label="Letzte Aktivität" field="aktiv" {...sortProps} />
                <th aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {list.rows.map((c) => {
                const name = c.company || `${c.firstName} ${c.lastName}`.trim();
                return (
                  <tr key={c.id} className={c.deletedAt ? 'muted-row' : undefined}>
                    <td data-slot="title">
                      <Link href={`/admin/kunden/${c.id}/`} className="primary stretch">{name}</Link>
                      {c.company && <span className="secondary">{`${c.firstName} ${c.lastName}`.trim()}</span>}
                    </td>
                    <td data-slot="sub" className="nowrap">{c.phone ?? <span className="t-3">–</span>}</td>
                    <td data-slot="hide" className="truncate-1" style={{ maxWidth: 240 }}>{c.email ?? <span className="t-3">–</span>}</td>
                    <td data-slot="meta">{c.city ?? <span className="t-3">–</span>}</td>
                    <td data-slot="badge" className="num">{c._count.cases ? <Badge tone="muted">{c._count.cases} {c._count.cases === 1 ? 'Fall' : 'Fälle'}</Badge> : <span className="t-3">–</span>}{c.deletedAt && <Badge tone="danger">Archiv</Badge>}</td>
                    <td data-slot="hide" className="num">{c._count.vehicles || <span className="t-3">–</span>}</td>
                    <td data-slot="hide" className="nowrap t-2">{fmtWhen(c.updatedAt)}</td>
                    <td data-slot="hide" className="menu-cell">
                      <Menu
                        label={`Aktionen für ${name}`} triggerClassName="adm-btn adm-btn-quiet adm-btn-icon adm-btn-sm" trigger={<AdminIcon name="more" />}
                        entries={[
                          { kind: 'link', label: 'Öffnen', href: `/admin/kunden/${c.id}/`, icon: 'external' },
                          ...(phoneHref(c.phone) ? [{ kind: 'link' as const, label: 'Anrufen', href: phoneHref(c.phone)!, icon: 'phone' as const }] : []),
                          ...(c.email ? [{ kind: 'link' as const, label: 'E-Mail schreiben', href: `mailto:${c.email}`, icon: 'mail' as const }] : []),
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination total={list.total} page={list.page} pageSize={PAGE_SIZE} basePath={base} params={params} noun="Kunden" />
    </>
  );
}
