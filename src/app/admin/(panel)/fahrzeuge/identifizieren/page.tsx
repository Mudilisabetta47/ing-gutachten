import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { getVehicle } from '@/server/pipeline/vehicles';
import { PageHeader, qp } from '@/components/admin/ui';
import { VehicleIdentify } from '@/components/admin/VehicleIdentify';

export const metadata: Metadata = { title: 'Fahrzeug identifizieren' };

export default async function IdentifyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('vehicledata.read');
  const sp = await searchParams;
  const vehicleId = qp(sp.fahrzeug);
  const v = vehicleId ? await getVehicle(user, vehicleId).catch(() => null) : null;
  const target = v ? { id: v.id, label: `${v.licensePlate ?? 'ohne Kennzeichen'} · ${v.manufacturer} ${v.model}` } : null;
  return (
    <>
      <PageHeader
        title="Fahrzeug identifizieren"
        intro={target ? `Die Daten werden in das Fahrzeug ${target.label} übernommen.` : 'HSN/TSN, FIN oder Fahrzeugschein – das Fahrzeug wird zuerst in der eigenen Fahrzeugdatenbank gesucht.'}
        actions={<Link href={target ? `/admin/fahrzeuge/${target.id}/` : '/admin/fahrzeuge'} className="adm-btn adm-btn-ghost">Zurück</Link>}
      />
      <VehicleIdentify target={target} canWriteData={user.permissions.has('vehicledata.write') && user.permissions.has('vehicles.write')} initial={{ hsn: qp(sp.hsn), tsn: qp(sp.tsn) }} />
    </>
  );
}
