import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { listPayments, METHOD_LABELS } from '@/server/pipeline/invoices';
import { deDate } from '@/lib/invoice';
import { fmtEuro } from '@/lib/money';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { AutoForm } from '@/components/admin/AutoForm';
import { Badge, EmptyState, PageHeader, Pagination, qp, qpage } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Zahlungen' };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('invoices.read');
  const sp = await searchParams;
  const q = qp(sp.q);
  const list = await listPayments(user, { q, page: qpage(sp.seite) });
  const base = '/admin/zahlungen';
  return (
    <>
      <PageHeader title="Zahlungen" intro="Alle erfassten Zahlungseingänge. Erfasst werden sie an der jeweiligen Rechnung; Stornierungen bleiben nachvollziehbar sichtbar." />
      <AutoForm action={base}>
        <div className="grow adm-input-group"><AdminIcon name="search" /><input name="q" defaultValue={q} className="adm-input" placeholder="Rechnungsnummer, Empfänger oder Verwendungszweck" autoComplete="off" aria-label="Suche" /></div>
      </AutoForm>
      {list.rows.length === 0 ? (
        <EmptyState icon="wallet" title={q ? 'Keine Zahlungen gefunden' : 'Noch keine Zahlungen'} action={q ? <Link href={base} className="adm-btn adm-btn-secondary">Suche zurücksetzen</Link> : undefined}>{q ? 'Passen Sie die Suche an.' : 'Zahlungen erfassen Sie an einer ausgestellten Rechnung.'}</EmptyState>
      ) : (
        <div className="dt-wrap"><table className="dt">
          <thead><tr><th>Datum</th><th className="num">Betrag</th><th>Rechnung</th><th>Empfänger</th><th>Zahlart</th><th>Verwendungszweck</th></tr></thead>
          <tbody>{list.rows.map((p) => (
            <tr key={p.id} style={p.reversed ? { opacity: 0.6 } : undefined}>
              <td data-slot="title" className="nowrap">{deDate(p.paidOn)}{p.reversed && <> <Badge tone="muted">storniert</Badge></>}</td>
              <td data-slot="badge" className="num nowrap"><b>{fmtEuro(p.amountCents)}</b></td>
              <td data-slot="sub">{p.caseNumber ? <Link href={`/admin/faelle/${p.caseNumber}/?tab=rechnung&rechnung=${p.invoiceId}`} className="mono">{p.invoiceNumber}</Link> : <span className="mono">{p.invoiceNumber}</span>}</td>
              <td data-slot="meta">{p.recipient}</td>
              <td data-slot="hide">{METHOD_LABELS[p.method] ?? p.method}</td>
              <td data-slot="hide" className="t-2">{p.reference ?? '–'}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <Pagination total={list.total} page={list.page} pageSize={list.pageSize} basePath={base} params={{ q }} noun="Zahlungen" />
    </>
  );
}
