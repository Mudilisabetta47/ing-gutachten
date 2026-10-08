import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { listReports } from '@/server/pipeline/reports';
import { STATUS_LABELS, STATUS_TONE } from '@/lib/report';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { AutoForm } from '@/components/admin/AutoForm';
import { Badge, EmptyState, FilterChips, PageHeader, Pagination, fmtWhen, hrefWith, qp, qpage, type Chip } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Gutachten' };
const ORDER = ['DRAFT', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'SENT'];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('reports.read.all', 'reports.read.own');
  const sp = await searchParams;
  const status = qp(sp.status), q = qp(sp.q);
  const list = await listReports(user, { status, q, page: qpage(sp.seite) });
  const base = '/admin/gutachten';
  const params = { status, q };
  const chips: Chip[] = [
    q && { label: 'Suche', value: q, href: hrefWith(base, { ...params, q: undefined }) },
    status && { label: 'Status', value: STATUS_LABELS[status] ?? status, href: hrefWith(base, { ...params, status: undefined }) },
  ].filter(Boolean) as Chip[];
  const total = Object.values(list.counts).reduce((a, b) => a + b, 0);
  return (
    <>
      <PageHeader title="Gutachten" intro={user.permissions.has('reports.read.all') ? 'Alle Gutachten mit Stand im Prüfprozess.' : 'Ihre Gutachten.'} />
      <nav className="adm-seg" aria-label="Status">
        <Link href={hrefWith(base, { ...params, status: undefined, seite: undefined })} aria-current={!status ? 'page' : undefined}>Alle <span className="n">{total}</span></Link>
        {ORDER.map((s) => (list.counts[s] ? <Link key={s} href={hrefWith(base, { ...params, status: s, seite: undefined })} aria-current={status === s ? 'page' : undefined}>{STATUS_LABELS[s]} <span className="n">{list.counts[s]}</span></Link> : null))}
      </nav>
      <AutoForm action={base}>
        {status && <input type="hidden" name="status" value={status} />}
        <div className="grow adm-input-group"><AdminIcon name="search" /><input name="q" defaultValue={q} className="adm-input" placeholder="Gutachtennummer, Fallnummer oder Kundenname" autoComplete="off" aria-label="Suche" /></div>
      </AutoForm>
      <FilterChips chips={chips} clearHref={base} />
      {list.rows.length === 0 ? (
        <EmptyState icon="doc" title={chips.length ? 'Keine Gutachten für diese Filter' : 'Noch keine Gutachten'} action={chips.length ? <Link href={base} className="adm-btn adm-btn-secondary">Filter zurücksetzen</Link> : <Link href="/admin/faelle" className="adm-btn adm-btn-secondary">Zu den Fällen</Link>}>
          {chips.length ? 'Passen Sie die Suche an.' : 'Gutachten legen Sie im Fall unter dem Reiter „Gutachten“ an.'}
        </EmptyState>
      ) : (
        <div className="dt-wrap"><table className="dt">
          <thead><tr><th>Gutachten</th><th>Status</th><th>Fall</th><th>Kunde</th><th>Fahrzeug</th><th>Gutachter</th><th>Aktualisiert</th></tr></thead>
          <tbody>{list.rows.map((r) => (
            <tr key={r.id}>
              <td data-slot="title"><Link href={`/admin/faelle/${r.case.caseNumber}/?tab=gutachten&bericht=${r.id}`} className="primary stretch mono">{r.number}</Link><span className="secondary">Fassung {r.revision}</span></td>
              <td data-slot="badge"><Badge tone={STATUS_TONE[r.status]}>{STATUS_LABELS[r.status]}</Badge></td>
              <td data-slot="sub" className="mono">{r.case.caseNumber}</td>
              <td data-slot="meta">{r.case.customer.company || `${r.case.customer.firstName} ${r.case.customer.lastName}`}</td>
              <td data-slot="meta">{r.case.vehicle.manufacturer} {r.case.vehicle.model}{r.case.vehicle.licensePlate ? ` · ${r.case.vehicle.licensePlate}` : ''}</td>
              <td data-slot="hide">{r.case.assignedExpert ? `${r.case.assignedExpert.firstName} ${r.case.assignedExpert.lastName}` : <span className="t-3">–</span>}</td>
              <td data-slot="hide" className="nowrap t-2">{fmtWhen(r.updatedAt)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <Pagination total={list.total} page={list.page} pageSize={list.pageSize} basePath={base} params={params} noun="Gutachten" />
    </>
  );
}
