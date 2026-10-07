import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission, can } from '@/server/auth/guards';
import { PageHeader } from '@/components/admin/ui';
import { UserCreateForm } from '../UserForms';

export const metadata: Metadata = { title: 'Benutzer anlegen' };

export default async function NewUserPage() {
  const user = await requirePagePermission('users.write');
  return (
    <>
      <PageHeader title="Benutzer anlegen" actions={<Link href="/admin/benutzer" className="adm-btn adm-btn-ghost">Zurück</Link>} />
      <UserCreateForm canGrantOwner={can(user, 'users.write.owner')} />
    </>
  );
}
