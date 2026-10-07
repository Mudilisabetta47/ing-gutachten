import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/server/db';
import { requirePagePermission, can } from '@/server/auth/guards';
import { ROLE_LABELS } from '@/server/auth/permissions';
import { PageHeader, fmtDateTime } from '@/components/admin/ui';
import { ResetPasswordForm, UserEditForm } from '../UserForms';

export const metadata: Metadata = { title: 'Benutzer bearbeiten' };

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePagePermission('users.write');
  const { id } = await params;
  const u = await db.user.findFirst({ where: { id, deletedAt: null }, include: { employee: true } });
  if (!u) notFound();
  // Ein ADMIN sieht keine Bearbeitungsseite für Inhaber.
  if (u.role === 'OWNER' && !can(actor, 'users.write.owner')) notFound();

  const sessions = await db.session.count({ where: { userId: u.id, revokedAt: null, expiresAt: { gt: new Date() } } });

  return (
    <>
      <PageHeader
        title={`${u.firstName} ${u.lastName}`}
        intro={`${u.email} · ${ROLE_LABELS[u.role]} · letzte Anmeldung ${fmtDateTime(u.lastLoginAt)} · ${sessions} aktive Sitzung${sessions === 1 ? '' : 'en'}`}
        actions={<Link href="/admin/benutzer" className="adm-btn adm-btn-ghost">Zurück</Link>}
      />
      <div className="grid gap-6">
        <UserEditForm
          user={{ id: u.id, role: u.role, isActive: u.isActive, isExpert: u.employee?.isExpert ?? false }}
          isSelf={u.id === actor.id}
          canGrantOwner={can(actor, 'users.write.owner')}
        />
        {u.id !== actor.id ? <ResetPasswordForm userId={u.id} /> : null}
      </div>
    </>
  );
}
