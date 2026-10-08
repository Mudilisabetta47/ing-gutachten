import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { documentsOverview } from '@/server/pipeline/overviews';
import { DOCUMENT_CATEGORIES, DOCUMENT_LABELS } from '@/server/pipeline/media';
import { Badge, EmptyState, PageHeader, Pagination, fmtWhen, hrefWith, qp, qpage } from '@/components/admin/ui';
import { SearchBar } from '@/components/admin/SearchBar';

export const metadata: Metadata = { title: 'Dokumentenakte' };
const size = (n: number) => (n >= 1_048_576 ? `${(n / 1_048_576).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(n / 1024)).toLocaleString('de-DE')} KB`);

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('documents.read.all', 'documents.read.own');
  const sp = await searchParams;
  const q = qp(sp.q), cat = (DOCUMENT_CATEGORIES as readonly string[]).includes(qp(sp.art) ?? '') ? qp(sp.art) : undefined;
  const list = await documentsOverview(user, { q, category: cat, page: qpage(sp.seite) });
  const base = '/admin/dokumente';
  return (
    <>
      <PageHeader title="Dokumentenakte" intro="Alle Dokumente der Fälle und Kunden. Hochgeladen wird im jeweiligen Fall unter „Dokumente“; der Abruf ist nur mit Anmeldung möglich." />
      <nav className="adm-seg" aria-label="Kategorie">
        <Link href={hrefWith(base, { q })} aria-current={!cat ? 'page' : undefined}>Alle</Link>
        {DOCUMENT_CATEGORIES.map((c) => <Link key={c} href={hrefWith(base, { q, art: c })} aria-current={cat === c ? 'page' : undefined}>{DOCUMENT_LABELS[c]}</Link>)}
      </nav>
      <SearchBar action={base} q={q} placeholder="Titel oder Fallnummer" hidden={{ art: cat }} />
      {list.rows.length === 0 ? <EmptyState icon="folder" title="Keine Dokumente">{q || cat ? 'Für diese Filter gibt es keine Dokumente.' : 'Noch keine Dokumente hochgeladen.'}</EmptyState> : (
        <div className="dt-wrap"><table className="dt">
          <thead><tr><th>Dokument</th><th>Kategorie</th><th>Fall / Kunde</th><th>Größe</th><th>Hinzugefügt</th></tr></thead>
          <tbody>{list.rows.map((d) => (
            <tr key={d.id}>
              <td data-slot="title"><a href={`/api/admin/media/${d.mediaId}`} target="_blank" rel="noreferrer" className="primary stretch">{d.title}</a></td>
              <td data-slot="badge"><Badge tone="muted">{DOCUMENT_LABELS[d.category] ?? d.category}</Badge></td>
              <td data-slot="sub">{d.caseNumber ? <Link href={`/admin/faelle/${d.caseNumber}/?tab=dokumente`} className="mono">{d.caseNumber}</Link> : d.customer ?? '–'}</td>
              <td data-slot="hide" className="nowrap">{size(d.sizeBytes)}</td>
              <td data-slot="hide" className="nowrap t-2">{fmtWhen(d.createdAt)}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <Pagination total={list.total} page={list.page} pageSize={list.pageSize} basePath={base} params={{ q, art: cat }} noun="Dokumente" />
    </>
  );
}
