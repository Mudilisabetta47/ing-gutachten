import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { orNotFound } from '@/server/admin/safe';
import { getCase } from '@/server/pipeline/cases';
import { caseAppointments } from '@/server/pipeline/appointments';
import { getInspection } from '@/server/pipeline/inspection';
import { listCasePhotos, PHOTO_CATEGORIES, PHOTO_LABELS } from '@/server/pipeline/media';
import { AREA_LABELS, DAMAGE_AREAS, DAMAGE_TYPES, REPAIR_KINDS, listDamages } from '@/server/pipeline/damages';
import { caseWorkSummary } from '@/server/pipeline/case-work';
import { EmptyState, PageHeader, Alert, fmtWhen, mapsHref, phoneHref, qp } from '@/components/admin/ui';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { ConfirmForm } from '@/components/admin/forms';
import { startInspectionAction } from '../../work-actions';
import { InspectionWorkflow } from './Workflow';

export const metadata: Metadata = { title: 'Besichtigung' };

export default async function InspectionPage({ params, searchParams }: { params: Promise<{ caseNumber: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('appointments.write.all', 'appointments.write.own');
  const { caseNumber } = await params;
  const wanted = qp((await searchParams).termin);
  const c = await orNotFound(getCase(user, caseNumber));
  const work = await orNotFound(caseWorkSummary(user, c.id));
  const appts = await caseAppointments(user, c.id);
  const appt = appts.find((a) => a.id === wanted && a.kind === 'INSPECTION') ?? [...appts].reverse().find((a) => a.kind === 'INSPECTION' && (a.status === 'PLANNED' || a.status === 'CONFIRMED'));
  const back = `/admin/faelle/${caseNumber}/`;
  const name = `${c.vehicle.manufacturer} ${c.vehicle.model}${c.vehicle.variant ? ` ${c.vehicle.variant}` : ''}`;

  if (!appt) {
    return (
      <>
        <PageHeader title="Besichtigung" crumbs={[{ label: 'Fälle', href: '/admin/faelle' }, { label: caseNumber, href: back }, { label: 'Besichtigung' }]} />
        <EmptyState icon="calendar" title="Kein Besichtigungstermin" action={<Link href={`${back}?tab=termine`} className="adm-btn">Zu den Terminen</Link>}>Für die Erfassung vor Ort braucht der Fall einen Besichtigungstermin.</EmptyState>
      </>
    );
  }
  const inspection = await getInspection(user, appt.id);
  const header = (
    <PageHeader
      title="Besichtigung"
      crumbs={[{ label: 'Fälle', href: '/admin/faelle' }, { label: caseNumber, href: back }, { label: 'Besichtigung' }]}
      intro={`${name}${c.vehicle.licensePlate ? ` · ${c.vehicle.licensePlate}` : ''} · ${fmtWhen(appt.startsAt)}`}
    />
  );

  if (!inspection) {
    return (
      <>
        {header}
        <div className="adm-panel" style={{ display: 'grid', gap: 14 }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{c.customer.company || `${c.customer.firstName} ${c.customer.lastName}`}</p>
          {appt.location && <p className="t-2" style={{ margin: 0, display: 'flex', gap: 6, alignItems: 'center' }}><AdminIcon name="map" className="h-4 w-4" />{appt.location}</p>}
          <div className="adm-actions">
            {appt.location && <a className="adm-btn adm-btn-secondary" href={mapsHref(appt.location)} target="_blank" rel="noreferrer"><AdminIcon name="navigate" />Navigation</a>}
            {phoneHref(c.customer.phone) && <a className="adm-btn adm-btn-secondary" href={phoneHref(c.customer.phone)}><AdminIcon name="phone" />Anrufen</a>}
          </div>
          <StartForm appointmentId={appt.id} caseNumber={caseNumber} />
        </div>
      </>
    );
  }

  if (inspection.status === 'FINISHED') {
    return (
      <>
        {header}
        <Alert tone="ok">Die Besichtigung wurde am {fmtWhen(inspection.finishedAt)} abgeschlossen.</Alert>
        <div className="adm-panel" style={{ marginTop: 14, display: 'grid', gap: 6 }}>
          <p style={{ margin: 0 }}><b>Kilometerstand:</b> {inspection.odometer?.toLocaleString('de-DE') ?? '–'}</p>
          <p style={{ margin: 0 }}><b>Wetter:</b> {inspection.weather ?? '–'}</p>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}><b>Notiz:</b> {inspection.note ?? '–'}</p>
        </div>
        <div style={{ marginTop: 14 }}><Link href={back} className="adm-btn">Zum Fall</Link></div>
      </>
    );
  }

  const [photos, damages] = await Promise.all([work.can.photosRead && work.storage ? listCasePhotos(user, c.id) : Promise.resolve([]), listDamages(user, c.id)]);
  const cats: Record<string, number> = {};
  for (const ph of photos) cats[ph.category] = (cats[ph.category] ?? 0) + 1;

  return (
    <>
      {header}
      <InspectionWorkflow
        appointmentId={appt.id}
        caseId={c.id}
        caseNumber={caseNumber}
        vehicle={{ name, plate: c.vehicle.licensePlate, vin: c.vehicle.vin, mileage: c.vehicle.mileage }}
        initial={{ odometer: inspection.odometer?.toString() ?? '', weather: inspection.weather ?? '', note: inspection.note ?? '' }}
        photoCats={cats}
        photoTotal={photos.length}
        damages={damages.map((d) => ({ id: d.id, label: `${AREA_LABELS[d.area]}: ${d.component}`, sub: [d.damageType, d.repairKind].filter(Boolean).join(' · ') || '–' }))}
        photoCategories={PHOTO_CATEGORIES.map((k) => [k, PHOTO_LABELS[k]])}
        areas={DAMAGE_AREAS.map((k) => [k, AREA_LABELS[k]])}
        types={DAMAGE_TYPES}
        repairs={REPAIR_KINDS}
        canPhotos={work.can.photosWrite}
        storage={work.storage}
      />
    </>
  );
}

function StartForm({ appointmentId, caseNumber }: { appointmentId: string; caseNumber: string }) {
  return <ConfirmForm action={startInspectionAction} id={appointmentId} extra={{ appointmentId, caseNumber }} label="Besichtigung beginnen" title="Besichtigung beginnen?" primary confirm="Das Protokoll wird angelegt. Fotos, Schäden und Notizen werden dabei laufend gespeichert." confirmLabel="Jetzt beginnen" />;
}
