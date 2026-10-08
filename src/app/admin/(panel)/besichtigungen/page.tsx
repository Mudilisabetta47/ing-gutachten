import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { inspectionsOverview } from '@/server/pipeline/overviews';
import { APPT_LABELS } from '@/server/pipeline/appointments';
import { Badge, EmptyState, PageHeader, Pagination, fmtWhen, hrefWith, qp, qpage } from '@/components/admin/ui';
import { SearchBar } from '@/components/admin/SearchBar';

export const metadata: Metadata = { title: 'Besichtigungen' };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('appointments.read.all', 'appointments.read.own');
  const sp = await searchParams;
  const q = qp(sp.q), when = qp(sp.zeit) === 'past' ? 'past' : 'upcoming';
  const list = await inspectionsOverview(user, { kind: 'INSPECTION', when, q, page: qpage(sp.seite) });
  const base = '/admin/besichtigungen';
  return (
    <>
      <PageHeader title="Besichtigungen" intro="Alle Besichtigungstermine mit Stand der Fahrzeug- und Schadenerfassung." actions={<Link href="/admin/termine" className="adm-btn adm-btn-secondary">Zum Kalender</Link>} />
      <nav className="adm-seg" aria-label="Zeitraum">
        <Link href={hrefWith(base, { q })} aria-current={when === 'upcoming' ? 'page' : undefined}>Anstehend</Link>
        <Link href={hrefWith(base, { q, zeit: 'past' })} aria-current={when === 'past' ? 'page' : undefined}>Vergangen</Link>
      </nav>
      <SearchBar action={base} q={q} placeholder="Fallnummer, Kunde oder Kennzeichen" hidden={{ zeit: when === 'past' ? 'past' : undefined }} />
      {list.rows.length === 0 ? <EmptyState icon="camera" title="Keine Termine">{when === 'past' ? 'Es gibt keine vergangenen Termine dieser Art.' : 'Termine legen Sie im Fall unter „Termine“ oder im Kalender an.'}</EmptyState> : (
        <div className="dt-wrap"><table className="dt">
          <thead><tr><th>Termin</th><th>Status</th><th>Fall</th><th>Kunde</th><th>Fahrzeug</th><th>Ort</th><th>Gutachter</th></tr></thead>
          <tbody>{list.rows.map((r) => (
            <tr key={r.id}>
              <td data-slot="title"><Link href={`/admin/faelle/${r.caseNumber}/?tab=termine`} className="primary stretch">{fmtWhen(r.startsAt)}</Link></td>
              <td data-slot="badge"><Badge tone={r.status === 'DONE' ? 'ok' : r.status === 'CANCELLED' || r.status === 'NO_SHOW' ? 'muted' : 'info'}>{APPT_LABELS[r.status]}</Badge>{r.inspectionStatus ? <span className="secondary">Erfassung: {r.inspectionStatus === 'FINISHED' ? 'abgeschlossen' : 'läuft'}</span> : null}</td>
              <td data-slot="sub" className="mono">{r.caseNumber}</td>
              <td data-slot="meta">{r.customer}</td>
              <td data-slot="hide">{r.vehicle}{r.plate ? ` · ${r.plate}` : ''}</td>
              <td data-slot="hide">{r.location ?? '–'}</td>
              <td data-slot="hide">{r.expert ?? <span className="t-3">–</span>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <Pagination total={list.total} page={list.page} pageSize={list.pageSize} basePath={base} params={{ q, zeit: when === 'past' ? 'past' : undefined }} noun="Termine" />
    </>
  );
}
