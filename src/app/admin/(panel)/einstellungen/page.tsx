import type { Metadata } from 'next';
import { requirePagePermission, can } from '@/server/auth/guards';
import { getSetting } from '@/server/settings';
import { getSystemStatus } from '@/server/admin/status';
import type { ReactNode } from 'react';
import { Badge, PageHeader, Rows, Section } from '@/components/admin/ui';
import { NumberingForm, UploadsForm } from './SettingsForms';

export const metadata: Metadata = { title: 'Einstellungen' };

export default async function SettingsPage() {
  const user = await requirePagePermission('settings.read');
  const [numbering, uploads] = await Promise.all([getSetting('numbering'), getSetting('uploads')]);
  const status = getSystemStatus();
  const readOnly = !can(user, 'settings.write');

  const rows: [string, string, boolean | null][] = [
    ['Umgebung', status.environment, null],
    ['Produktivdomain (SITE_URL)', status.siteUrl, null],
    ['E-Mail-Versand', status.mail.label, status.mail.ok],
    ['Dateispeicher (privat)', status.storage.label, status.storage.ok],
  ];

  return (
    <>
      <PageHeader title="Einstellungen" intro="Betriebswerte, die ohne Deployment geändert werden dürfen. Geheimnisse (API-Schlüssel, Zugangsdaten) liegen ausschließlich in den Umgebungsvariablen bei Vercel." />
      <div className="adm-grid-2" style={{ alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 20 }}>
          <Section title="Systemstatus">
            <Rows items={rows.map(([k, v, ok]) => [k, ok === null ? v : <Badge key={k} tone={ok ? 'ok' : 'muted'}>{v}</Badge>] as [string, ReactNode])} />
          </Section>
        </div>
        <div style={{ display: 'grid', gap: 20 }}>
          <NumberingForm value={numbering} readOnly={readOnly} />
          <UploadsForm value={uploads} readOnly={readOnly} />
        </div>
      </div>
    </>
  );
}
