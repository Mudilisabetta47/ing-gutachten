import Link from 'next/link';
import { CLAIM_LABELS, PRIORITY_LABELS, SERVICE_LABELS, type ClaimTypeKey, type PriorityKey } from '@/lib/workflow';
import type { getCase } from '@/server/pipeline/cases';
import type { caseChecklist } from '@/server/pipeline/case-checklist';
import type { caseWorkSummary } from '@/server/pipeline/case-work';
import { Checklist } from '@/components/admin/case-ui';
import { OpenDrawer } from '@/components/admin/Overlay';
import { fmtDate, fmtWhen, mapsHref, phoneHref } from '@/components/admin/ui';
import type { ReactNode } from 'react';

type Case = Awaited<ReturnType<typeof getCase>>;
type Checklist = Awaited<ReturnType<typeof caseChecklist>>;
type Work = Awaited<ReturnType<typeof caseWorkSummary>>;

const Row = ({ k, v }: { k: string; v: ReactNode }) => (
  <div className="adm-row"><dt>{k}</dt><dd>{v === null || v === undefined || v === '' ? <span className="t-3">–</span> : v}</dd></div>
);
const Mini = ({ title, children, span2, aside }: { title: string; children: ReactNode; span2?: boolean; aside?: ReactNode }) => (
  <section className={`adm-mini ${span2 ? 'span-2' : ''}`}><h3><span>{title}</span>{aside}</h3><dl className="adm-rows" style={{ margin: 0 }}>{children}</dl></section>
);

/** Übersicht des Falls: kompakte Gruppen statt riesiger Karten – Kunde, Fahrzeug, Unfall, Bearbeitung, Besichtigung, Checkliste. */
export function OverviewTab({ c, checklist, work, base, canEdit, canSeeCustomer, canSeeVehicle, notes, noteDrawer }: {
  c: Case; checklist: Checklist; work: Work; base: string; canEdit: boolean; canSeeCustomer: boolean; canSeeVehicle: boolean; notes: ReactNode; noteDrawer?: ReactNode;
}) {
  const address = [c.customer.street, [c.customer.postalCode, c.customer.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const insurance = c.insuranceOrg?.name ?? c.insuranceName;
  const expert = c.assignedExpert ? `${c.assignedExpert.firstName} ${c.assignedExpert.lastName}` : null;
  const next = work.next;
  const edit = canEdit ? <OpenDrawer id="edit" icon="edit" className="adm-btn adm-btn-quiet adm-btn-sm">Bearbeiten</OpenDrawer> : null;
  return (
    <>
      <div className="adm-minis">
        <Mini title="Kunde" aside={canSeeCustomer ? <Link href={`/admin/kunden/${c.customer.id}/`} className="adm-link" style={{ textTransform: 'none', letterSpacing: 0 }}>Öffnen</Link> : null}>
          <Row k="Name" v={<b style={{ fontWeight: 600 }}>{c.customer.company || `${c.customer.firstName} ${c.customer.lastName}`.trim()}</b>} />
          <Row k="Adresse" v={address} />
          <Row k="Telefon" v={c.customer.phone ? <a href={phoneHref(c.customer.phone)} className="adm-link">{c.customer.phone}</a> : null} />
          <Row k="E-Mail" v={c.customer.email ? <a href={`mailto:${c.customer.email}`} className="adm-link" style={{ wordBreak: 'break-all' }}>{c.customer.email}</a> : null} />
        </Mini>
        <Mini title="Fahrzeug" aside={canSeeVehicle ? <Link href={`/admin/fahrzeuge/${c.vehicle.id}/`} className="adm-link" style={{ textTransform: 'none', letterSpacing: 0 }}>Öffnen</Link> : null}>
          <Row k="Fahrzeug" v={`${c.vehicle.manufacturer} ${c.vehicle.model}${c.vehicle.variant ? ` ${c.vehicle.variant}` : ''}`} />
          <Row k="Kennzeichen" v={c.vehicle.licensePlate ? <span className="mono">{c.vehicle.licensePlate}</span> : null} />
          <Row k="FIN" v={c.vehicle.vin ? <span className="mono" style={{ fontSize: 12 }}>{c.vehicle.vin}</span> : null} />
          <Row k="EZ / km" v={[c.vehicle.firstRegistration ? fmtDate(c.vehicle.firstRegistration) : null, c.vehicle.mileage ? `${c.vehicle.mileage.toLocaleString('de-DE')} km` : null].filter(Boolean).join(' · ')} />
        </Mini>
        <Mini title="Unfall" aside={edit}>
          <Row k="Schadenart" v={c.claimType ? CLAIM_LABELS[c.claimType as ClaimTypeKey] : null} />
          <Row k="Datum" v={c.internalsVisible ? fmtDate(c.accidentDate ?? c.damageDate) : null} />
          <Row k="Ort" v={c.internalsVisible ? c.accidentPlace : null} />
          <Row k="Versicherung" v={insurance} />
          <Row k="Schadennr." v={c.insuranceClaimNumber ? <span className="mono">{c.insuranceClaimNumber}</span> : null} />
          {c.internalsVisible && <Row k="Unfallgegner" v={c.opposingInsurance} />}
        </Mini>
        <Mini title="Bearbeitung">
          <Row k="Gutachter" v={expert} />
          <Row k="Büro" v={c.createdBy ? `${c.createdBy.firstName} ${c.createdBy.lastName}` : null} />
          <Row k="Standort" v={c.location?.name} />
          <Row k="Priorität" v={PRIORITY_LABELS[c.priority as PriorityKey]} />
          <Row k="Gutachtenart" v={SERVICE_LABELS[c.serviceType]} />
          <Row k="Angelegt" v={fmtWhen(c.createdAt)} />
        </Mini>
        <Mini title="Besichtigung">
          <Row k="Termin" v={next ? fmtWhen(next.startsAt) : <span className="t-3">Noch kein Termin</span>} />
          <Row k="Ort" v={next?.location || c.inspectionLocation ? <a href={mapsHref(next?.location || c.inspectionLocation)} target="_blank" rel="noreferrer" className="adm-link">{next?.location || c.inspectionLocation}</a> : null} />
          <Row k="Kontakt" v={c.customer.phone ? <a href={phoneHref(c.customer.phone)} className="adm-link">{c.customer.phone}</a> : null} />
        </Mini>
        <section className="adm-mini">
          <h3><span>Dokumente</span>{checklist.missing.length > 0 ? <Link href={`${base}?tab=dokumente`} className="adm-link" style={{ textTransform: 'none', letterSpacing: 0 }}>{checklist.missing.length} offen</Link> : null}</h3>
          <Checklist items={checklist.documents} base={base} />
        </section>
        <section className="adm-mini span-2">
          <h3><span>Status-Checkliste</span><span className="t-2" style={{ textTransform: 'none', letterSpacing: 0 }}>{checklist.progress.done} von {checklist.progress.total}</span></h3>
          <div className="adm-bar" role="progressbar" aria-valuenow={checklist.progress.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Bearbeitungsfortschritt"><i style={{ width: `${checklist.progress.pct}%` }} /></div>
          <div className="adm-grid-2" style={{ gap: '0 32px' }}>
            <Checklist items={checklist.items.slice(0, 6)} base={base} />
            <Checklist items={checklist.items.slice(6)} base={base} />
          </div>
        </section>
      </div>
      <div style={{ marginTop: 24 }}>{notes}{noteDrawer}</div>
    </>
  );
}
