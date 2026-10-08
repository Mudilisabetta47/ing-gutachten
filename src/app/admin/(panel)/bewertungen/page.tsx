import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { valuationsOverview } from '@/server/pipeline/overviews';
import { IS_MONEY, TAX_LABELS, TYPE_LABELS, sourceName, type ValuationTypeKey } from '@/lib/valuation';
import { fmtEuro } from '@/lib/money';
import { EmptyState, PageHeader, Pagination, qp, qpage } from '@/components/admin/ui';
import { SearchBar } from '@/components/admin/SearchBar';

export const metadata: Metadata = { title: 'Fahrzeugbewertung' };
const TYPES = ['REPLACEMENT_VALUE', 'DIMINISHED_VALUE', 'REPLACEMENT_DURATION'] as const;
const de = (iso: string | null) => (iso ? iso.split('-').reverse().join('.') : '–');

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('valuations.read.all', 'valuations.read.own');
  const sp = await searchParams;
  const q = qp(sp.q);
  const list = await valuationsOverview(user, { types: [...TYPES], q, page: qpage(sp.seite) });
  const base = '/admin/bewertungen';
  return (
    <>
      <PageHeader title="Fahrzeugbewertung" intro="Gewählte Wiederbeschaffungswerte, Wertminderungen und Wiederbeschaffungsdauern mit Quelle und Stand. Erfasst wird im Fall." />
      <SearchBar action={base} q={q} placeholder="Fallnummer, Kunde oder Kennzeichen" />
      {list.rows.length === 0 ? <EmptyState icon="gauge" title="Noch keine Werte">{q ? 'Für diese Suche gibt es keine Werte.' : 'Werte erfassen Sie im Fall unter „Bewertung“. Hier erscheinen die jeweils gewählten Werte aller Fälle.'}</EmptyState> : (
        <div className="dt-wrap"><table className="dt">
          <thead><tr><th>Fall</th><th>Wert</th><th>Betrag / Dauer</th><th>Quelle</th><th>Stand</th><th>Kunde</th><th>Fahrzeug</th></tr></thead>
          <tbody>{list.rows.map((r) => (
            <tr key={r.id}>
              <td data-slot="title"><Link href={`/admin/faelle/${r.caseNumber}/?tab=bewertung`} className="primary stretch mono">{r.caseNumber}</Link></td>
              <td data-slot="badge">{TYPE_LABELS[r.type as ValuationTypeKey]}{r.label ? <span className="secondary">{r.label}</span> : null}</td>
              <td data-slot="meta" className="nowrap">{r.amountCents != null && IS_MONEY[r.type as ValuationTypeKey] ? <>{fmtEuro(r.amountCents)} <span className="t-3">{TAX_LABELS[r.taxMode]}</span></> : r.days != null ? `${r.days} Tage` : '–'}</td>
              <td data-slot="hide">{sourceName(r.source)}</td>
              <td data-slot="hide" className="nowrap">{de(r.referenceDate)}{r.validUntil ? <span className="secondary">gültig bis {de(r.validUntil)}</span> : null}</td>
              <td data-slot="sub">{r.customer}</td>
              <td data-slot="hide">{r.vehicle}{r.plate ? ` · ${r.plate}` : ''}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <Pagination total={list.total} page={list.page} pageSize={list.pageSize} basePath={base} params={{ q }} noun="Werte" />
    </>
  );
}
