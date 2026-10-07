import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePagePermission } from '@/server/auth/guards';
import { ORG_LABELS, orgKindFromSlug } from '@/lib/workflow';
import { PageHeader } from '@/components/admin/ui';
import { OrganizationForm } from '@/components/admin/OrganizationForm';
import { createOrganizationAction } from '../../actions';

export const metadata: Metadata = { title: 'Neu anlegen' };

export default async function NewOrganizationPage({ params }: { params: Promise<{ kind: string }> }) {
  await requirePagePermission('masterdata.write');
  const kind = orgKindFromSlug((await params).kind);
  if (!kind) notFound();
  const L = ORG_LABELS[kind];
  return (
    <>
      <PageHeader title={`${L.one} anlegen`} crumbs={[{ label: L.many, href: `/admin/stammdaten/${L.slug}` }, { label: 'Neu' }]} actions={<Link href={`/admin/stammdaten/${L.slug}`} className="adm-btn adm-btn-secondary">Abbrechen</Link>} />
      <OrganizationForm action={createOrganizationAction} slug={L.slug} workshop={kind === 'WORKSHOP'} submitLabel={`${L.one} anlegen`} />
    </>
  );
}
