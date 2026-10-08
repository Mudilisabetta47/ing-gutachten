import Link from 'next/link';
import type { AuthUser } from '@/server/auth/session-types';
import { caseInvoices, companyMissing, listServices, recipientOptions } from '@/server/pipeline/invoices';
import { getSetting } from '@/server/settings';
import { STATE_LABELS } from '@/lib/invoice';
import { fmtEuro } from '@/lib/money';
import { Alert, EmptyState, Section } from '@/components/admin/ui';
import { InvoicePanel, type IView } from '@/components/admin/InvoicePanel';
import { CreateInvoiceButton } from './CreateInvoiceButton';

/** Reiter „Rechnung“: Entwurf, Ausstellen, Zahlungen, Mahnwesen. Die Daten kommen ausschließlich aus dem Fall. */
export async function InvoiceTab({ user, caseId, caseNumber, wanted }: { user: AuthUser; caseId: string; caseNumber: string; wanted?: string }) {
  if (!user.permissions.has('invoices.read')) return <EmptyState icon="lock" title="Kein Zugriff">Für Rechnungen fehlt die Berechtigung.</EmptyState>;
  const canWrite = user.permissions.has('invoices.write');
  const [list, opts, services, company] = await Promise.all([caseInvoices(user, caseId), recipientOptions(user, caseId), listServices(user).catch(() => []), getSetting('company')]);
  const missing = companyMissing(company);
  const chosen = list.find((i) => i.id === wanted) ?? list.at(-1);
  const options = opts.map((o) => ({ key: o.key, label: o.label }));
  const warn = canWrite && missing.length > 0
    ? <Alert tone="warn" icon="alert">Zum Ausstellen fehlen noch Unternehmensdaten: {missing.join(', ')}. <Link href="/admin/einstellungen/">Unter Einstellungen ergänzen</Link>.</Alert>
    : null;
  if (!chosen) {
    return (
      <Section title="Rechnung">
        {warn}
        <EmptyState icon="receipt" title="Noch keine Rechnung" action={canWrite ? <CreateInvoiceButton caseId={caseId} caseNumber={caseNumber} options={options} /> : undefined}>
          Der Entwurf übernimmt den Empfänger aus dem Fall. Positionen stellen Sie selbst zusammen oder wählen sie aus Ihrem Leistungskatalog – Preise gibt das System nicht vor.
        </EmptyState>
      </Section>
    );
  }
  const toView = (i: typeof chosen): IView => ({
    id: i.id, caseNumber, number: i.number, status: i.status, state: i.state, recipient: i.recipient, serviceDate: i.serviceDate, issueDate: i.issueDate, dueDate: i.dueDate, paymentTermsDays: i.paymentTermsDays,
    introText: i.introText, footerText: i.footerText, items: i.items.map((x) => ({ description: x.description, quantityX100: x.quantityX100, unit: x.unit, unitPriceCents: x.unitPriceCents, vatBp: x.vatBp, serviceId: x.serviceId })),
    totals: i.totals, paidCents: i.paidCents, openCents: i.openCents, cancelReason: i.cancelReason, payments: i.payments.map((p) => ({ id: p.id, amountCents: p.amountCents, paidOn: p.paidOn, method: p.method, reference: p.reference, note: p.note, reversed: p.reversed, reverseReason: p.reverseReason })),
    dunnings: i.dunnings.map((d) => ({ id: d.id, level: d.level, status: d.status, issueDate: d.issueDate, dueDate: d.dueDate, feeCents: d.feeCents, interestCents: d.interestCents, text: d.text })),
  });
  return (
    <>
      {warn}
      {list.length > 1 && (
        <nav className="adm-seg" aria-label="Rechnungen des Falls">
          {list.map((i) => <Link key={i.id} href={`/admin/faelle/${caseNumber}/?tab=rechnung&rechnung=${i.id}`} aria-current={i.id === chosen.id ? 'page' : undefined}>{i.number ?? 'Entwurf'} · {STATE_LABELS[i.state]} · {fmtEuro(i.totals.grossCents)}</Link>)}
        </nav>
      )}
      <Section title={chosen.status === 'DRAFT' ? 'Rechnungsentwurf' : 'Rechnung'}>
        <InvoicePanel key={`${chosen.id}-${chosen.status}-${chosen.updatedAt.toISOString()}-${chosen.payments.length}-${chosen.dunnings.length}`} inv={toView(chosen)} services={services.map((s) => ({ id: s.id, name: s.name, unit: s.unit, unitPriceCents: s.unitPriceCents, vatBp: s.vatBp }))}
          canWrite={canWrite} canPay={user.permissions.has('payments.write')} canDunning={user.permissions.has('dunning.write')} caseNumber={caseNumber} />
      </Section>
      {canWrite && <div style={{ marginTop: 12 }}><CreateInvoiceButton caseId={caseId} caseNumber={caseNumber} options={options} label="Weitere Rechnung (z. B. Teil- oder Folgerechnung) anlegen" /></div>}
    </>
  );
}
