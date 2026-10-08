import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { calculationsOverview } from '@/server/pipeline/overviews';
import { fmtEuro } from '@/lib/money';
import { Badge, EmptyState, PageHeader, Pagination, fmtWhen, hrefWith, qp, qpage } from '@/components/admin/ui';
import { SearchBar } from '@/components/admin/SearchBar';

export const metadata: Metadata = { title: 'Schadenkalkulation' };

export default async function CalculationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('calculations.read.all', 'calculations.read.own');
  const sp = await searchParams;
  const q = qp(sp.q), status = qp(sp.status) === 'DRAFT' ? 'DRAFT' : qp(sp.status) === 'FINAL' ? 'FINAL' : undefined;
  const list = await calculationsOverview(user, { q, status, page: qpage(sp.seite) });
  const base = '/admin/kalkulationen';
  return (
    <>
      <PageHeader title="Schadenkalkulation" intro="Alle Kalkulationsversionen. Bearbeitet wird im jeweiligen Fall unter „Kalkulation“." />
      <nav className="adm-seg" aria-label="Status">
        <Link href={hrefWith(base, { q })} aria-current={!status ? 'page' : undefined}>Alle</Link>
        <Link href={hrefWith(base, { q, status: 'DRAFT' })} aria-current={status === 'DRAFT' ? 'page' : undefined}>Entwürfe</Link>
        <Link href={hrefWith(base, { q, status: 'FINAL' })} aria-current={status === 'FINAL' ? 'page' : undefined}>Final</Link>
      </nav>
      <SearchBar action={base} q={q} placeholder="Fallnummer, Kunde oder Kennzeichen" hidden={{ status }} />
      {list.rows.length === 0 ? <EmptyState icon="calc" title="Keine Kalkulationen">{q || status ? 'Für diese Filter gibt es keine Kalkulation.' : 'Kalkulationen legen Sie im Fall unter „Kalkulation“ an.'}</EmptyState> : (
        <div className="dt-wrap"><table className="dt">
          <thead><tr><th>Fall</th><th>Version</th><th>Kunde</th><th>Fahrzeug</th><th className="num">Netto</th><th className="num">Brutto</th><th>Aktualisiert</th></tr></thead>
          <tbody>{list.rows.map((r) => (
            <tr key={r.id}>
              <td data-slot="title"><Link href={`/admin/faelle/${r.caseNumber}/?tab=kalkulation`} className="primary stretch mono">{r.caseNumber}</Link></td>
              <td data-slot="badge">V{r.version} <Badge tone={r.status === 'FINAL' ? 'ok' : 'muted'}>{r.status === 'FINAL' ? 'Final' : 'Entwurf'}</Badge></td>
              <td data-slot="meta">{r.customer}</td>
              <td data-slot="sub">{r.vehicle}{r.plate ? ` · ${r.plate}` : ''}</td>
              <td data-slot="hide" className="num nowrap">{fmtEuro(r.netCents)}</td>
              <td data-slot="hide" className="num nowrap">{fmtEuro(r.grossCents)}</td>
              <td data-slot="hide" className="nowrap t-2">{fmtWhen(r.updatedAt)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <Pagination total={list.total} page={list.page} pageSize={list.pageSize} basePath={base} params={{ q, status }} noun="Kalkulationen" />
    </>
  );
}
