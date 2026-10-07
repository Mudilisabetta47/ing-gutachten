import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePagePermission } from '@/server/auth/guards';
import { orNotFound } from '@/server/admin/safe';
import { getOrganization, organizationCases } from '@/server/pipeline/masterdata';
import { CASE_LABELS, ORG_LABELS, orgKindFromSlug } from '@/lib/workflow';
import { centsToInput, fmtEuro, fmtPercent, bpToInput } from '@/lib/money';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { DrawerHost, OpenDrawer } from '@/components/admin/Overlay';
import { OrganizationForm } from '@/components/admin/OrganizationForm';
import { ConfirmForm } from '@/components/admin/forms';
import { AsideBlock, Badge, DetailHeader, EmptyState, Rows, Section, StatusPill, SummaryBar, fmtWhen, phoneHref } from '@/components/admin/ui';
import { archiveOrganizationAction, restoreOrganizationAction, updateOrganizationAction } from '../../actions';

export const metadata: Metadata = { title: 'Stammdaten' };

export default async function OrganizationDetailPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const user = await requirePagePermission('masterdata.read', 'masterdata.write');
  const { kind: slug, id } = await params;
  const kind = orgKindFromSlug(slug);
  if (!kind) notFound();
  const o = await orNotFound(getOrganization(user, id));
  if (o.kind !== kind) notFound();
  const L = ORG_LABELS[kind];
  const cases = await organizationCases(user, id, kind);
  const canWrite = user.permissions.has('masterdata.write');
  const workshop = kind === 'WORKSHOP';
  const address = [o.street, [o.postalCode, o.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const n = o._count.casesInsurance + o._count.casesLawyer + o._count.casesWorkshop + o._count.casesDealership + o._count.casesPartner;

  const drawers = canWrite && !o.deletedAt ? [{
    id: 'edit', title: `${L.one} bearbeiten`,
    content: (
      <OrganizationForm
        bare action={updateOrganizationAction} slug={slug} workshop={workshop} id={id} submitLabel="Speichern"
        initial={{ name: o.name, contactName: o.contactName, street: o.street, postalCode: o.postalCode, city: o.city, phone: o.phone, fax: o.fax, email: o.email, claimsEmail: o.claimsEmail, portalUrl: o.portalUrl, notes: o.notes,
          rateBodyCents: centsToInput(o.rateBodyCents), rateMechanicCents: centsToInput(o.rateMechanicCents), rateElectricCents: centsToInput(o.rateElectricCents), ratePaintCents: centsToInput(o.ratePaintCents), shippingCents: centsToInput(o.shippingCents),
          partsMarkupBp: bpToInput(o.partsMarkupBp), paintMaterialBp: bpToInput(o.paintMaterialBp) }}
      />
    ),
  }] : [];

  return (
    <DrawerHost drawers={drawers}>
      <DetailHeader
        crumbs={[{ label: L.many, href: `/admin/stammdaten/${slug}` }, { label: o.name }]}
        title={o.name}
        badge={o.deletedAt ? <Badge tone="danger">Archiviert</Badge> : undefined}
        meta={[o.contactName, o.city, o.phone ? <a key="p" href={phoneHref(o.phone)} className="adm-link">{o.phone}</a> : null, o.email ? <a key="e" href={`mailto:${o.email}`} className="adm-link">{o.email}</a> : null].filter(Boolean) as React.ReactNode[]}
        actions={
          <>
            {phoneHref(o.phone) && <a href={phoneHref(o.phone)} className="adm-btn adm-btn-secondary"><AdminIcon name="phone" />Anrufen</a>}
            {o.email && <a href={`mailto:${o.email}`} className="adm-btn adm-btn-secondary adm-hide-mobile"><AdminIcon name="mail" />E-Mail</a>}
            {canWrite && !o.deletedAt && <OpenDrawer id="edit" icon="edit" className="adm-btn">Bearbeiten</OpenDrawer>}
          </>
        }
      />
      <SummaryBar items={[['Ansprechpartner', o.contactName], ['Telefon', o.phone], ['E-Mail', o.email], ['Ort', o.city], ['Fälle', n]]} />
      <div className="adm-work" style={{ marginTop: 24 }}>
        <div style={{ minWidth: 0 }}>
          <Section title="Kontakt">
            <Rows items={[
              ['Anschrift', address || null], ['Telefon', o.phone ? <a href={phoneHref(o.phone)} className="adm-link">{o.phone}</a> : null], ['Fax', o.fax],
              ['E-Mail', o.email ? <a href={`mailto:${o.email}`} className="adm-link">{o.email}</a> : null],
              ...(o.claimsEmail ? ([[kind === 'INSURANCE' ? 'Schadenservice' : 'Sekretariat', <a key="c" href={`mailto:${o.claimsEmail}`} className="adm-link">{o.claimsEmail}</a>]] as [string, React.ReactNode][]) : []),
              ...(o.portalUrl ? ([['Portal', <a key="u" href={o.portalUrl} target="_blank" rel="noreferrer" className="adm-link">{o.portalUrl}</a>]] as [string, React.ReactNode][]) : []),
            ]} />
          </Section>
          {workshop && (
            <Section title="Konditionen">
              <Rows items={[
                ['Karosserie', o.rateBodyCents != null ? `${fmtEuro(o.rateBodyCents)} / h` : null], ['Mechanik', o.rateMechanicCents != null ? `${fmtEuro(o.rateMechanicCents)} / h` : null],
                ['Elektrik', o.rateElectricCents != null ? `${fmtEuro(o.rateElectricCents)} / h` : null], ['Lack', o.ratePaintCents != null ? `${fmtEuro(o.ratePaintCents)} / h` : null],
                ['Verbringung', o.shippingCents != null ? fmtEuro(o.shippingCents) : null], ['Ersatzteilaufschlag', o.partsMarkupBp != null ? fmtPercent(o.partsMarkupBp) : null], ['Lackmaterial', o.paintMaterialBp != null ? `${fmtPercent(o.paintMaterialBp)} vom Lacklohn` : null],
              ]} />
            </Section>
          )}
          {o.notes && <Section title="Notizen"><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{o.notes}</p></Section>}
          <Section title={`Fälle · ${cases.length}`}>
            {cases.length === 0 ? <EmptyState icon="case" title="Noch keine Fälle">Sobald ein Fall diese Stammdaten nutzt, erscheint er hier.</EmptyState> : (
              <ul className="adm-list">{cases.map((c) => (
                <li key={c.id}>
                  <span className="main"><Link href={`/admin/faelle/${c.caseNumber}/`} className="stretch mono">{c.caseNumber}</Link><span className="secondary">{c.customer.company || `${c.customer.firstName} ${c.customer.lastName}`} · {c.vehicle.licensePlate ?? c.vehicle.model} · {fmtWhen(c.createdAt)}</span></span>
                  <StatusPill kind="case" status={c.status} label={CASE_LABELS[c.status]} />
                </li>
              ))}</ul>
            )}
          </Section>
        </div>
        <aside>
          {canWrite && (
            <AsideBlock title="Verwaltung">
              {o.deletedAt
                ? <ConfirmForm action={restoreOrganizationAction} id={id} extra={{ kind: slug }} label="Wiederherstellen" title="Wiederherstellen?" confirm="Der Eintrag steht wieder zur Auswahl." />
                : <ConfirmForm action={archiveOrganizationAction} id={id} extra={{ kind: slug }} label="Archivieren" title={`${L.one} archivieren?`} confirm="Der Eintrag steht nicht mehr zur Auswahl; bestehende Fälle behalten ihn." danger />}
            </AsideBlock>
          )}
        </aside>
      </div>
    </DrawerHost>
  );
}
