import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { orNotFound } from '@/server/admin/safe';
import { getCustomer } from '@/server/pipeline/customers';
import { PageHeader, qp } from '@/components/admin/ui';
import { getRecord } from '@/server/vehicledata/catalog';
import { VehicleForm } from '@/components/admin/forms';
import { createVehicleAction } from '../../actions';

export const metadata: Metadata = { title: 'Fahrzeug anlegen' };

export default async function NewVehiclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('vehicles.write');
  const { id } = await params;
  const c = await orNotFound(getCustomer(user, id));
  // Kommt man von „Fahrzeug identifizieren“, ist der Datensatz schon gewählt und füllt das Formular vor
  const recId = qp((await searchParams).datensatz);
  const rec = recId && user.permissions.has('vehicledata.read') ? await getRecord(user, recId).catch(() => null) : null;
  const initial = rec ? { manufacturer: rec.manufacturer, model: rec.model, variant: rec.variant, fuelType: rec.fuelType, hsn: rec.hsn, tsn: rec.tsn, hsnTsnId: rec.id, powerKw: rec.powerKw?.toString(), powerHp: rec.powerHp?.toString(), displacementCc: rec.displacementCc?.toString(), engineName: rec.engineName, bodyStyle: rec.bodyStyle, driveType: rec.driveType, transmission: rec.transmission, vehicleClass: rec.vehicleClass } : {};
  return (
    <>
      <PageHeader title="Fahrzeug anlegen" intro={`für ${c.company || `${c.firstName} ${c.lastName}`}`} actions={<Link href={`/admin/kunden/${id}/?tab=fahrzeuge`} className="adm-btn adm-btn-ghost">Zurück</Link>} />
      <VehicleForm action={createVehicleAction} hidden={{ customerId: id }} submitLabel="Fahrzeug anlegen" initial={initial} canIdentify={user.permissions.has('vehicledata.read')} />
    </>
  );
}
