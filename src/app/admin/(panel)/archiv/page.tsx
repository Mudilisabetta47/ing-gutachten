import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { EXPORT_KINDS, archiveOverview } from '@/server/pipeline/analytics';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { Alert, PageHeader, Section } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Export / Archiv' };

export default async function ArchivePage() {
  const user = await requirePagePermission('data.export', 'cases.delete');
  const a = await archiveOverview(user);
  const canExport = user.permissions.has('data.export');
  return (
    <>
      <PageHeader title="Export / Archiv" intro="Daten herausgeben und archivierte Einträge wiederfinden. Es wird nichts endgültig gelöscht." />
      <div className="adm-grid-2" style={{ alignItems: 'start' }}>
        <Section title="Archiv">
          <ul className="adm-list">
            <li><span className="main"><b>{a.archivedCases}</b> archivierte Fälle<span className="secondary">Nur für die Leitung sichtbar; wiederherstellbar.</span></span><Link href="/admin/faelle?archiv=1" className="adm-btn adm-btn-secondary adm-btn-sm">Anzeigen</Link></li>
            <li><span className="main"><b>{a.archivedCustomers}</b> archivierte Kunden<span className="secondary">Über die Kundenliste wiederherstellbar.</span></span><Link href="/admin/kunden?archiv=1" className="adm-btn adm-btn-secondary adm-btn-sm">Anzeigen</Link></li>
          </ul>
        </Section>
        <Section title="Datenexport (CSV)">
          {canExport ? (
            <ul className="adm-list">
              {(Object.entries(EXPORT_KINDS) as [string, string][]).map(([k, l]) => (
                <li key={k}><span className="main"><b>{l}</b><span className="secondary">Semikolon-getrennt, UTF-8, Formelzeichen entschärft.</span></span><a className="adm-btn adm-btn-secondary adm-btn-sm" href={`/api/admin/export/${k}/`}><AdminIcon name="files" />Herunterladen</a></li>
              ))}
              {user.permissions.has('invoices.export') && <li><span className="main"><b>Rechnungen</b><span className="secondary">Mit Status, Beträgen und offenen Posten.</span></span><a className="adm-btn adm-btn-secondary adm-btn-sm" href="/api/admin/rechnungen/export/"><AdminIcon name="files" />Herunterladen</a></li>}
            </ul>
          ) : <p className="t-3" style={{ margin: 0 }}>Für den Datenexport fehlt die Berechtigung.</p>}
          <Alert tone="info" icon="shield">Jeder Export wird im Protokoll festgehalten. Exportdateien enthalten personenbezogene Daten – bitte nur verschlüsselt speichern oder weitergeben.</Alert>
        </Section>
      </div>
    </>
  );
}
