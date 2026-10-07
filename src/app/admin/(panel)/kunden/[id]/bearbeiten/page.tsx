import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { orNotFound } from '@/server/admin/safe';
import { getCustomer } from '@/server/pipeline/customers';
import { PageHeader } from '@/components/admin/ui';
import { CustomerForm } from '@/components/admin/forms';
import { updateCustomerAction } from '../../actions';

export const metadata: Metadata = { title: 'Kunde bearbeiten' };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission('customers.write');
  const { id } = await params;
  const c = await orNotFound(getCustomer(user, id));
  return (
    <>
      <PageHeader title="Kunde bearbeiten" intro={c.company || `${c.firstName} ${c.lastName}`} actions={<Link href={`/admin/kunden/${id}/`} className="adm-btn adm-btn-ghost">Zurück</Link>} />
      <CustomerForm action={updateCustomerAction} hidden={{ id }} submitLabel="Speichern" initial={{ type: c.type, company: c.company, firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone, street: c.street, postalCode: c.postalCode, city: c.city, country: c.country }} />
    </>
  );
}
