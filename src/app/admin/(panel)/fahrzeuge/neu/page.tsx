import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { PageHeader } from '@/components/admin/ui';
import { CustomerPicker } from './CustomerPicker';

export const metadata: Metadata = { title: 'Neues Fahrzeug' };

export default async function NewVehicleEntryPage() {
  await requirePagePermission('vehicles.write');
  return (
    <>
      <PageHeader title="Neues Fahrzeug" intro="Ein Fahrzeug gehört immer zu einem Kunden. Danach wird es per HSN/TSN, FIN oder manuell erfasst." actions={<Link href="/admin/fahrzeuge" className="adm-btn adm-btn-ghost">Zurück</Link>} />
      <CustomerPicker />
    </>
  );
}
