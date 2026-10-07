import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { orNotFound } from '@/server/admin/safe';
import { getCustomer, customerVehicles } from '@/server/pipeline/customers';
import { listExperts } from '@/server/pipeline/cases';
import { EmptyState, PageHeader, qp } from '@/components/admin/ui';
import { NewCaseForm } from './NewCaseForm';

export const metadata: Metadata = { title: 'Fall anlegen' };

export default async function NewCasePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('cases.write.all');
  const customerId = qp((await searchParams).kunde);
  if (!customerId) {
    return (
      <>
        <PageHeader title="Fall anlegen" actions={<Link href="/admin/faelle" className="adm-btn adm-btn-ghost">Zurück</Link>} />
        <EmptyState title="Für welchen Kunden?" action={<Link href="/admin/kunden" className="adm-btn">Kunde wählen</Link>}>
          Einen Fall legt man beim Kunden an („Neuer Fall“). Eingehende Anfragen wandelt man unter „Anfragen“ in einen Fall um.
        </EmptyState>
      </>
    );
  }
  const customer = await orNotFound(getCustomer(user, customerId));
  const [vehicles, experts] = await Promise.all([customerVehicles(user, customerId), listExperts(user)]);
  const name = customer.company || `${customer.firstName} ${customer.lastName}`;

  return (
    <>
      <PageHeader title="Fall anlegen" intro={`für ${name}`} actions={<Link href={`/admin/kunden/${customerId}/`} className="adm-btn adm-btn-ghost">Zurück</Link>} />
      {vehicles.length === 0 ? (
        <EmptyState title="Zuerst ein Fahrzeug anlegen" action={<Link href={`/admin/kunden/${customerId}/fahrzeug-neu/`} className="adm-btn">Fahrzeug anlegen</Link>}>
          Jeder Fall gehört zu einem Fahrzeug dieses Kunden.
        </EmptyState>
      ) : (
        <NewCaseForm
          customerId={customerId}
          vehicles={vehicles.map((v) => ({ id: v.id, label: `${v.licensePlate ?? 'ohne Kennzeichen'} · ${v.manufacturer} ${v.model}` }))}
          experts={experts.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))}
          canAssign={user.permissions.has('cases.assign')}
        />
      )}
    </>
  );
}
