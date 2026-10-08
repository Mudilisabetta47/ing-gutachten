import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { photosOverview } from '@/server/pipeline/overviews';
import { PHOTO_LABELS } from '@/server/pipeline/media';
import { Badge, EmptyState, PageHeader, Pagination, qp, qpage } from '@/components/admin/ui';
import { SearchBar } from '@/components/admin/SearchBar';

export const metadata: Metadata = { title: 'Fotodokumentation' };

export default async function PhotosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('photos.read.all', 'photos.read.own');
  const sp = await searchParams;
  const q = qp(sp.q);
  const list = await photosOverview(user, { q, page: qpage(sp.seite) });
  const base = '/admin/fotos';
  return (
    <>
      <PageHeader title="Fotodokumentation" intro="Fälle mit Fotos und deren Aufteilung nach Kategorie. Die Fotos selbst sehen und bearbeiten Sie im Fall unter „Fotos“." />
      <SearchBar action={base} q={q} placeholder="Fallnummer, Kunde oder Kennzeichen" />
      {list.rows.length === 0 ? <EmptyState icon="photo" title="Keine Fotos">{q ? 'Für diese Suche gibt es keine Fälle mit Fotos.' : 'Noch keine Fotos hochgeladen.'}</EmptyState> : (
        <div className="dt-wrap"><table className="dt">
          <thead><tr><th>Fall</th><th>Fotos</th><th>Nach Kategorie</th><th>Kunde</th><th>Fahrzeug</th></tr></thead>
          <tbody>{list.rows.map((r) => (
            <tr key={r.caseNumber}>
              <td data-slot="title"><Link href={`/admin/faelle/${r.caseNumber}/?tab=fotos`} className="primary stretch mono">{r.caseNumber}</Link></td>
              <td data-slot="badge"><b>{r.total}</b></td>
              <td data-slot="meta"><span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>{Object.entries(r.byCategory).map(([k, n]) => <Badge key={k} tone="muted">{PHOTO_LABELS[k] ?? k} {n}</Badge>)}</span></td>
              <td data-slot="sub">{r.customer}</td>
              <td data-slot="hide">{r.vehicle}{r.plate ? ` · ${r.plate}` : ''}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <Pagination total={list.total} page={list.page} pageSize={list.pageSize} basePath={base} params={{ q }} noun="Fälle" />
    </>
  );
}
