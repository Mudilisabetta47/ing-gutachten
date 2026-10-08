import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { dunningOverview } from '@/server/pipeline/invoices';
import { DUNNING_LABELS, deDate } from '@/lib/invoice';
import { fmtEuro } from '@/lib/money';
import { Alert, Badge, EmptyState, PageHeader } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Mahnwesen' };

export default async function DunningPage() {
  const user = await requirePagePermission('invoices.read');
  const rows = await dunningOverview(user);
  return (
    <>
      <PageHeader title="Mahnwesen" intro="Überfällige, noch offene Rechnungen. Mahnungen entstehen nie automatisch – Sie legen sie im Fall an, prüfen sie und versenden sie selbst." />
      <Alert tone="info" icon="info">Mahngebühren und Verzugszinsen trägt das System nicht vor; Sie geben sie bewusst selbst ein.</Alert>
      {rows.length === 0 ? (
        <EmptyState icon="check" title="Nichts überfällig">Aktuell gibt es keine offenen Rechnungen nach Fälligkeit.</EmptyState>
      ) : (
        <div className="dt-wrap"><table className="dt">
          <thead><tr><th>Rechnung</th><th>Empfänger</th><th className="num">Offen</th><th>Fällig seit</th><th>Letzte Mahnstufe</th><th>Nächster Schritt</th></tr></thead>
          <tbody>{rows.map((r) => {
            const last = r.dunnings.filter((d) => d.status === 'ISSUED').at(-1);
            const draft = r.dunnings.find((d) => d.status === 'DRAFT');
            return (
              <tr key={r.id}>
                <td data-slot="title"><Link href={r.caseNumber ? `/admin/faelle/${r.caseNumber}/?tab=rechnung&rechnung=${r.id}` : '#'} className="primary stretch mono">{r.number}</Link><span className="secondary mono">{r.caseNumber ?? ''}</span></td>
                <td data-slot="meta">{r.recipient.name}</td>
                <td data-slot="badge" className="num nowrap"><b>{fmtEuro(r.openCents)}</b></td>
                <td data-slot="sub" className="nowrap">{deDate(r.dueDate)} · {r.daysOverdue} Tage</td>
                <td data-slot="hide">{last ? <Badge tone="warn">{DUNNING_LABELS[last.level]} · {deDate(last.issueDate)}</Badge> : <span className="t-3">–</span>}</td>
                <td data-slot="hide">{draft ? 'Entwurf prüfen und ausstellen' : r.nextLevel ? `${DUNNING_LABELS[r.nextLevel]} vorbereiten` : 'Höchste Stufe erreicht – weitere Schritte außerhalb des Systems'}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      )}
    </>
  );
}
