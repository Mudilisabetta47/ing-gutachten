import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { listVehicles } from '@/server/pipeline/vehicles';
import { PAGE_SIZE } from '@/server/pipeline/leads';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { AutoForm } from '@/components/admin/AutoForm';
import { EmptyState, FilterChips, PageHeader, Pagination, fmtDate, hrefWith, qp, qpage, type Chip } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Fahrzeuge' };

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('vehicles.read');
  const sp = await searchParams;
  const q = qp(sp.q);
  const list = await listVehicles(user, { q, page: qpage(sp.seite) });
  const base = '/admin/fahrzeuge';
  const chips: Chip[] = q ? [{ label: 'Suche', value: q, href: hrefWith(base, {}) }] : [];
  const canCustomer = user.permissions.has('customers.read') || user.permissions.has('customers.read.own');

  return (
    <>
      <PageHeader
        title="Fahrzeuge"
        intro="Kennzeichen werden in jeder Schreibweise gefunden („H AB 123“, „H-AB 123“, „hab123“)."
        actions={<>
          {user.permissions.has('vehicledata.read') && <Link href="/admin/fahrzeuge/identifizieren/" className="adm-btn adm-btn-secondary"><AdminIcon name="search" />Fahrzeug identifizieren</Link>}
          {user.permissions.has('vehicles.write') && user.permissions.has('customers.write') && <Link href="/admin/fahrzeuge/neu/" className="adm-btn"><AdminIcon name="plus" />Neues Fahrzeug</Link>}
        </>}
      />
      <AutoForm action={base}>
        <div className="grow adm-input-group">
          <AdminIcon name="search" />
          <input name="q" defaultValue={q} className="adm-input" placeholder="Kennzeichen, FIN, Hersteller, Modell, Halter" autoComplete="off" aria-label="Suche" />
        </div>
      </AutoForm>
      <FilterChips chips={chips} clearHref={base} />
      {list.rows.length === 0 ? (
        <EmptyState icon="car" title={q ? 'Keine Fahrzeuge gefunden' : 'Noch keine Fahrzeuge'} action={q ? <Link href={base} className="adm-btn adm-btn-secondary">Suche zurücksetzen</Link> : undefined}>
          {q ? 'Passen Sie die Suche an.' : 'Fahrzeuge entstehen bei der Umwandlung einer Anfrage oder werden beim Kunden angelegt.'}
        </EmptyState>
      ) : (
        <div className="dt-wrap">
          <table className="dt">
            <thead><tr><th>Kennzeichen</th><th>Fahrzeug</th><th>FIN</th><th>Halter</th><th>Angelegt</th></tr></thead>
            <tbody>
              {list.rows.map((v) => (
                <tr key={v.id}>
                  <td data-slot="title"><Link href={`/admin/fahrzeuge/${v.id}/`} className="primary stretch mono">{v.licensePlate ?? 'ohne Kennzeichen'}</Link></td>
                  <td data-slot="sub">{v.manufacturer} {v.model}{v.variant ? ` ${v.variant}` : ''}</td>
                  <td data-slot="meta" className="mono t-2" style={{ fontSize: 12 }}>{v.vin ?? <span className="t-3">–</span>}</td>
                  <td data-slot="meta">{canCustomer ? (v.customer.company || `${v.customer.firstName} ${v.customer.lastName}`) : '–'}</td>
                  <td data-slot="hide" className="nowrap t-2">{fmtDate(v.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination total={list.total} page={list.page} pageSize={PAGE_SIZE} basePath={base} params={{ q }} noun="Fahrzeuge" />
    </>
  );
}
