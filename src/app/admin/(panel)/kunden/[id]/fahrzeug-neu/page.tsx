import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { orNotFound } from '@/server/admin/safe';
import { getCustomer } from '@/server/pipeline/customers';
import { PageHeader } from '@/components/admin/ui';
import { VehicleForm } from '@/components/admin/forms';
import { createVehicleAction } from '../../actions';

export const metadata: Metadata = { title: 'Fahrzeug anlegen' };

export default async function NewVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission('vehicles.write');
  const { id } = await params;
  const c = await orNotFound(getCustomer(user, id));
  return (
    <>
      <PageHeader title="Fahrzeug anlegen" intro={`für ${c.company || `${c.firstName} ${c.lastName}`}`} actions={<Link href={`/admin/kunden/${id}/?tab=fahrzeuge`} className="adm-btn adm-btn-ghost">Zurück</Link>} />
      <VehicleForm action={createVehicleAction} hidden={{ customerId: id }} submitLabel="Fahrzeug anlegen" />
    </>
  );
}
