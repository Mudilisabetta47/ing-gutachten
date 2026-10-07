import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { PageHeader } from '@/components/admin/ui';
import { CustomerForm } from '@/components/admin/forms';
import { createCustomerAction } from '../actions';

export const metadata: Metadata = { title: 'Kunde anlegen' };

export default async function NewCustomerPage() {
  await requirePagePermission('customers.write');
  return (
    <>
      <PageHeader title="Kunde anlegen" actions={<Link href="/admin/kunden" className="adm-btn adm-btn-ghost">Zurück</Link>} />
      <CustomerForm action={createCustomerAction} submitLabel="Kunde anlegen" />
    </>
  );
}
