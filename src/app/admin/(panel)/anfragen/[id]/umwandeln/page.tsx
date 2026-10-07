import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requirePagePermission } from '@/server/auth/guards';
import { orNotFound } from '@/server/admin/safe';
import { findLeadDuplicates, getLead } from '@/server/pipeline/leads';
import { customerVehicles } from '@/server/pipeline/customers';
import { listExperts } from '@/server/pipeline/cases';
import { caseRefOptions } from '@/server/pipeline/masterdata';
import { LEAD_CONVERTIBLE, serviceFromReason } from '@/lib/workflow';
import { splitName } from '@/lib/normalize';
import { Notice, PageHeader } from '@/components/admin/ui';
import { ConvertWizard } from './ConvertWizard';

export const metadata: Metadata = { title: 'Anfrage umwandeln' };

export default async function ConvertPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission('leads.convert');
  for (const p of ['customers.write', 'vehicles.write', 'cases.write.all'] as const) if (!user.permissions.has(p)) notFound();
  const { id } = await params;
  const lead = await orNotFound(getLead(user, id));
  if (lead.status === 'CONVERTED') redirect(`/admin/anfragen/${id}/`);

  const convertible = LEAD_CONVERTIBLE.includes(lead.status);
  const [dups, experts, refs] = await Promise.all([findLeadDuplicates(user, id), listExperts(user), caseRefOptions(user)]);
  const existing = await Promise.all(
    dups.customers.map(async (c) => ({
      id: c.id,
      label: `${c.company || `${c.firstName} ${c.lastName}`}${c.city ? `, ${c.city}` : ''}`,
      vehicles: (await customerVehicles(user, c.id)).map((v) => ({ id: v.id, label: `${v.licensePlate ?? 'ohne Kennzeichen'} · ${v.manufacturer} ${v.model}` })),
    })),
  );
  const name = splitName(lead.name);

  return (
    <>
      <PageHeader
        title="Anfrage umwandeln"
        intro={`${lead.name} · ${lead.reason} · ${lead.vehicleKind}`}
        actions={<Link href={`/admin/anfragen/${id}/`} className="adm-btn adm-btn-ghost">Abbrechen</Link>}
      />
      {!convertible ? (
        <Notice tone="error">Diese Anfrage hat den Status „{lead.status}“ und kann nicht umgewandelt werden. Bitte zuerst den Status ändern (z. B. Spam-Markierung aufheben).</Notice>
      ) : (
        <ConvertWizard
          canIdentify={user.permissions.has('vehicledata.read')}
          leadId={id}
          existing={existing}
          experts={experts.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))}
          canAssign={user.permissions.has('cases.assign')}
          refs={refs}
          init={{
            c_firstName: name.firstName, c_lastName: name.lastName, c_email: lead.email ?? '', c_phone: lead.phone ?? '',
            v_licensePlate: lead.licensePlate ?? '', k_serviceType: serviceFromReason(lead.reason), k_inspectionLocation: lead.location ?? '', k_description: lead.message ?? '',
          }}
        />
      )}
    </>
  );
}
