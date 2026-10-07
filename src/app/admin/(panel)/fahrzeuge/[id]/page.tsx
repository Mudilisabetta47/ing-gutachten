import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { orNotFound } from '@/server/admin/safe';
import { getVehicle, vehicleCases } from '@/server/pipeline/vehicles';
import { CASE_LABELS, FUEL_LABELS } from '@/lib/workflow';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { DrawerHost, Menu, OpenDrawer } from '@/components/admin/Overlay';
import { AsideBlock, DetailHeader, EmptyState, Rows, Section, StatusPill, SummaryBar, fmtDate, fmtWhen } from '@/components/admin/ui';
import { ConfirmForm, VehicleForm } from '@/components/admin/forms';
import { archiveVehicleAction, updateVehicleAction } from '../actions';

export const metadata: Metadata = { title: 'Fahrzeug' };

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission('vehicles.read');
  const { id } = await params;
  const v = await orNotFound(getVehicle(user, id));
  const cases = await vehicleCases(user, id);
  const canWrite = user.permissions.has('vehicles.write');
  const canSeeCustomer = user.permissions.has('customers.read') || user.permissions.has('customers.read.own');
  const owner = v.customer.company || `${v.customer.firstName} ${v.customer.lastName}`;
  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

  const drawers = canWrite ? [{
    id: 'edit', title: 'Fahrzeugdaten bearbeiten',
    content: <VehicleForm action={updateVehicleAction} hidden={{ id }} submitLabel="Speichern" initial={{ manufacturer: v.manufacturer, model: v.model, variant: v.variant, licensePlate: v.licensePlate, vin: v.vin, firstRegistration: iso(v.firstRegistration), mileage: v.mileage?.toString(), fuelType: v.fuelType, color: v.color }} />,
  }] : [];

  return (
    <DrawerHost drawers={drawers}>
      <DetailHeader
        crumbs={[{ label: 'Fahrzeuge', href: '/admin/fahrzeuge' }, { label: v.licensePlate ?? `${v.manufacturer} ${v.model}` }]}
        lead={<span className="adm-avatar adm-avatar-lg" style={{ borderRadius: 12 }}><AdminIcon name="car" className="h-5 w-5" /></span>}
        title={<span><span className="t-3" style={{ display: 'block', fontSize: 13, fontWeight: 600, letterSpacing: 0 }}>{v.manufacturer}</span>{v.model}{v.variant ? ` ${v.variant}` : ''}</span>}
        meta={[v.licensePlate ? <span key="p" className="mono" style={{ fontWeight: 600, color: 'rgb(var(--a-text))' }}>{v.licensePlate}</span> : 'Ohne Kennzeichen', canSeeCustomer ? <Link key="o" href={`/admin/kunden/${v.customer.id}/`} className="adm-link">{owner}</Link> : owner]}
        actions={canWrite ? <>
          <OpenDrawer id="edit" icon="edit" className="adm-btn adm-btn-secondary">Bearbeiten</OpenDrawer>
          {user.permissions.has('vehicles.delete') && <Menu label="Weitere Aktionen" triggerClassName="adm-btn adm-btn-secondary adm-btn-icon" trigger={<AdminIcon name="more" />} entries={[{ kind: 'link', label: 'Zur Fahrzeugliste', href: '/admin/fahrzeuge', icon: 'car' }]} />}
        </> : undefined}
      />
      <SummaryBar items={[
        ['FIN', v.vin ? <span className="mono" style={{ fontSize: 12.5 }}>{v.vin}</span> : null],
        ['Erstzulassung', fmtDate(v.firstRegistration)],
        ['Kilometerstand', v.mileage ? `${v.mileage.toLocaleString('de-DE')} km` : null],
        ['Antrieb', v.fuelType ? FUEL_LABELS[v.fuelType] : null],
        ['Farbe', v.color],
      ]} />
      <div className="adm-work" style={{ marginTop: 24 }}>
        <div style={{ minWidth: 0 }}>
          <Section title="Verknüpfte Fälle">
            {cases.length === 0 ? <EmptyState icon="case" title="Noch keine Fälle">Zu diesem Fahrzeug gibt es noch keinen Fall.</EmptyState> : (
              <ul className="adm-list">{cases.map((k) => (
                <li key={k.id}>
                  <span className="main"><Link href={`/admin/faelle/${k.caseNumber}/`} className="stretch mono">{k.caseNumber}</Link><span className="secondary">{fmtWhen(k.createdAt)}</span></span>
                  <StatusPill kind="case" status={k.status} label={CASE_LABELS[k.status]} />
                </li>
              ))}</ul>
            )}
          </Section>
          <Section title="Fahrzeugdaten">
            <Rows items={[['Kennzeichen', v.licensePlate ? <span className="mono">{v.licensePlate}</span> : null], ['Hersteller', v.manufacturer], ['Modell', `${v.model}${v.variant ? ` ${v.variant}` : ''}`], ['FIN', v.vin ? <span className="mono">{v.vin}</span> : null], ['Angelegt', fmtWhen(v.createdAt)]]} />
          </Section>
        </div>
        <aside>
          <AsideBlock title="Eigentümer">
            <p style={{ margin: 0, fontWeight: 600 }}>{canSeeCustomer ? <Link href={`/admin/kunden/${v.customer.id}/`} className="adm-link">{owner}</Link> : owner}</p>
          </AsideBlock>
          {user.permissions.has('vehicles.delete') && (
            <AsideBlock title="Verwaltung">
              <ConfirmForm action={archiveVehicleAction} id={id} label="Fahrzeug archivieren" title="Fahrzeug archivieren?" confirm="Nur möglich, wenn kein Fall mehr offen ist. Die Daten bleiben erhalten." danger />
            </AsideBlock>
          )}
        </aside>
      </div>
    </DrawerHost>
  );
}
