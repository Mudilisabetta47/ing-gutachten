import type { Metadata } from 'next';
import { requirePagePermission } from '@/server/auth/guards';
import { listServices } from '@/server/pipeline/invoices';
import { PageHeader } from '@/components/admin/ui';
import { ServiceManager } from './ServiceManager';

export const metadata: Metadata = { title: 'Leistungen & Preise' };

export default async function ServicesPage() {
  const user = await requirePagePermission('invoices.read', 'invoices.write');
  const items = await listServices(user);
  return (
    <>
      <PageHeader title="Leistungen & Preise" intro="Ihr eigener Leistungskatalog für Rechnungen. Preise und Steuersätze legen ausschließlich Sie fest." />
      <ServiceManager items={items.map((s) => ({ id: s.id, name: s.name, description: s.description, unit: s.unit, unitPriceCents: s.unitPriceCents, vatBp: s.vatBp }))} canWrite={user.permissions.has('invoices.write')} />
    </>
  );
}
