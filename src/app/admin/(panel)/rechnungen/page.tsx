import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { financeStats, listInvoices } from '@/server/pipeline/invoices';
import { STATE_LABELS, STATE_TONE, deDate } from '@/lib/invoice';
import { fmtEuro } from '@/lib/money';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { AutoForm } from '@/components/admin/AutoForm';
import { Badge, EmptyState, FilterChips, Kpi, Kpis, PageHeader, Pagination, hrefWith, qp, qpage, type Chip } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Rechnungen' };
const FILTERS: [string, string][] = [['DRAFT', 'Entwürfe'], ['ISSUED', 'Ausgestellt'], ['OVERDUE', 'Überfällig'], ['CANCELLED', 'Storniert']];

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('invoices.read');
  const sp = await searchParams;
  const status = qp(sp.status), q = qp(sp.q);
  const [list, stats] = await Promise.all([listInvoices(user, { status, q, page: qpage(sp.seite) }), financeStats(user)]);
  const base = '/admin/rechnungen';
  const params = { status, q };
  const chips: Chip[] = [
    q && { label: 'Suche', value: q, href: hrefWith(base, { ...params, q: undefined }) },
    status && { label: 'Status', value: FILTERS.find(([k]) => k === status)?.[1] ?? status, href: hrefWith(base, { ...params, status: undefined }) },
  ].filter(Boolean) as Chip[];
  const canExport = user.permissions.has('invoices.export');
  return (
    <>
      <PageHeader title="Rechnungen" intro="Rechnungen aller Fälle. Neue Rechnungen legen Sie im Fall unter „Rechnung“ an." actions={canExport ? <a className="adm-btn adm-btn-secondary" href={`/api/admin/rechnungen/export/?${new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}) }).toString()}`}><AdminIcon name="files" />CSV-Export</a> : undefined} />
      <Kpis>
        <Kpi label="Offen" value={fmtEuro(stats.open)} note={`${stats.openCount} Rechnungen`} />
        <Kpi label="Überfällig" value={fmtEuro(stats.overdue)} note={`${stats.overdueCount} Rechnungen`} warn={stats.overdueCount > 0} href="/admin/mahnwesen" />
        <Kpi label="Umsatz diesen Monat (netto)" value={fmtEuro(stats.revenueMonth)} />
        <Kpi label="Zahlungseingang diesen Monat" value={fmtEuro(stats.paidMonth)} />
        <Kpi label="Entwürfe" value={stats.drafts} />
      </Kpis>
      <nav className="adm-seg" aria-label="Status">
        <Link href={hrefWith(base, { ...params, status: undefined, seite: undefined })} aria-current={!status ? 'page' : undefined}>Alle</Link>
        {FILTERS.map(([k, l]) => <Link key={k} href={hrefWith(base, { ...params, status: k, seite: undefined })} aria-current={status === k ? 'page' : undefined}>{l}</Link>)}
      </nav>
      <AutoForm action={base}>
        {status && <input type="hidden" name="status" value={status} />}
        <div className="grow adm-input-group"><AdminIcon name="search" /><input name="q" defaultValue={q} className="adm-input" placeholder="Rechnungsnummer, Empfänger oder Fallnummer" autoComplete="off" aria-label="Suche" /></div>
      </AutoForm>
      <FilterChips chips={chips} clearHref={base} />
      {list.rows.length === 0 ? (
        <EmptyState icon="receipt" title={chips.length ? 'Keine Rechnungen für diese Filter' : 'Noch keine Rechnungen'} action={chips.length ? <Link href={base} className="adm-btn adm-btn-secondary">Filter zurücksetzen</Link> : <Link href="/admin/faelle" className="adm-btn adm-btn-secondary">Zu den Fällen</Link>}>
          {chips.length ? 'Passen Sie die Suche an.' : 'Legen Sie im Fall unter „Rechnung“ den ersten Entwurf an.'}
        </EmptyState>
      ) : (
        <div className="dt-wrap"><table className="dt">
          <thead><tr><th>Rechnung</th><th>Status</th><th>Empfänger</th><th>Fall</th><th>Datum</th><th>Fällig</th><th className="num">Brutto</th><th className="num">Offen</th></tr></thead>
          <tbody>{list.rows.map((r) => (
            <tr key={r.id}>
              <td data-slot="title"><Link href={r.caseNumber ? `/admin/faelle/${r.caseNumber}/?tab=rechnung&rechnung=${r.id}` : `/api/admin/rechnungen/${r.id}/pdf/`} className="primary stretch mono">{r.number ?? 'Entwurf'}</Link></td>
              <td data-slot="badge"><Badge tone={STATE_TONE[r.state]}>{STATE_LABELS[r.state]}</Badge></td>
              <td data-slot="meta">{r.recipient.name}</td>
              <td data-slot="sub" className="mono">{r.caseNumber ?? '–'}</td>
              <td data-slot="hide" className="nowrap">{deDate(r.issueDate)}</td>
              <td data-slot="hide" className="nowrap">{deDate(r.dueDate)}</td>
              <td data-slot="hide" className="num nowrap">{fmtEuro(r.totals.grossCents)}</td>
              <td data-slot="hide" className="num nowrap">{r.status === 'ISSUED' ? fmtEuro(r.openCents) : '–'}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <Pagination total={list.total} page={list.page} pageSize={list.pageSize} basePath={base} params={params} noun="Rechnungen" />
    </>
  );
}
