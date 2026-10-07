import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { db } from '@/server/db';
import { IMPORT_MODES, listJobs } from '@/server/vehicledata/imports';
import { Badge, EmptyState, PageHeader, Section, fmtWhen } from '@/components/admin/ui';
import { DataNav } from '../DataNav';
import { JOB_LABELS } from '../labels';
import { ImportForm } from './ImportForm';

export const metadata: Metadata = { title: 'Fahrzeugdaten-Import' };

export default async function ImportPage() {
  const user = await requirePagePermission('vehicledata.manage');
  const [jobs, providers, conflicts] = await Promise.all([
    listJobs(user),
    db.vehicleProvider.findMany({ where: { kind: 'external' }, orderBy: { key: 'asc' }, select: { key: true, name: true, licenseStatus: true, enabled: true } }),
    db.vehicleDataConflict.count({ where: { status: 'OPEN' } }),
  ]);
  return (
    <>
      <PageHeader title="Import" intro="Datensätze aus Dateien oder freigegebenen Anbietern übernehmen – immer mit Vorschau, ohne vorhandene Daten zu überschreiben." />
      <DataNav active="import" conflicts={conflicts} />
      <Section title="Import starten">
        <ImportForm modes={IMPORT_MODES.map((m) => ({ key: m.key, label: m.label, source: m.source, available: m.available, why: 'why' in m ? m.why : undefined }))} providers={providers} />
      </Section>
      <Section title="Letzte Importläufe">
        {jobs.length === 0 ? <EmptyState icon="doc" title="Noch keine Importläufe">Sobald ein Import gestartet wird, erscheint er hier.</EmptyState> : (
          <div className="dt-wrap"><table className="dt"><thead><tr><th>Bezeichnung</th><th>Quelle</th><th>Status</th><th>Datensätze</th><th>Neu</th><th>Vorhanden</th><th>Konflikte</th><th>Ungültig</th><th>Gestartet</th></tr></thead><tbody>
            {jobs.map((j) => (
              <tr key={j.id}>
                <td data-slot="title"><Link href={`/admin/fahrzeugdaten/import/${j.id}/`} className="primary stretch">{j.label}</Link><span className="secondary">{j.mode}</span></td>
                <td data-slot="sub">{j.provider.name}</td>
                <td data-slot="badge"><Badge tone={JOB_LABELS[j.status][1]}>{JOB_LABELS[j.status][0]}</Badge></td>
                <td data-slot="hide">{j.total}</td><td data-slot="hide">{j.status === 'COMPLETED' ? j.countImported : j.countNew}</td><td data-slot="hide">{j.countExists}</td><td data-slot="hide">{j.countConflict}</td><td data-slot="hide">{j.countInvalid}</td>
                <td data-slot="meta" className="nowrap t-2">{fmtWhen(j.createdAt)}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </Section>
    </>
  );
}
