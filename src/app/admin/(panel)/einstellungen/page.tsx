import type { Metadata } from 'next';
import { requirePagePermission, can } from '@/server/auth/guards';
import { getSetting } from '@/server/settings';
import { getSystemStatus } from '@/server/admin/status';
import { PageHeader } from '@/components/admin/ui';
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
      <div className="grid gap-6">
        <section className="adm-card" aria-labelledby="sys-h">
          <h2 id="sys-h" className="mb-3 font-display text-[1.1rem] font-semibold">
            Systemstatus
          </h2>
          <dl className="grid gap-2 text-[.92rem]">
            {rows.map(([k, v, ok]) => (
              <div key={k} className="flex flex-wrap justify-between gap-2 border-b border-line/60 pb-2 last:border-0">
                <dt className="text-fg-mute">{k}</dt>
                <dd className={ok === true ? 'text-ok' : ok === false ? 'text-fg-dim' : 'text-fg'}>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <NumberingForm value={numbering} readOnly={readOnly} />
        <UploadsForm value={uploads} readOnly={readOnly} />
      </div>
    </>
  );
}
