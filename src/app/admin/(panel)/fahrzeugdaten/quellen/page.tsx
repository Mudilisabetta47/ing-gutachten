import type { Metadata } from 'next';
import { requirePagePermission } from '@/server/auth/guards';
import { db } from '@/server/db';
import { listProviders, providerLogs } from '@/server/vehicledata/gateway';
import { getProvider } from '@/server/vehicledata/providers';
import { LICENSE_LABELS } from '@/lib/vehicle-data';
import { Badge, PageHeader, Section, fmtWhen } from '@/components/admin/ui';
import { DataNav } from '../DataNav';
import { ProviderSettings, ProviderTester } from './ProviderControls';

export const metadata: Metadata = { title: 'Datenquellen' };

const LIC_TONE: Record<string, 'ok' | 'info' | 'warn' | 'danger' | 'muted'> = { LICENSED: 'ok', APPROVED: 'ok', REVIEW_REQUIRED: 'warn', UNKNOWN: 'muted', DISABLED: 'danger' };
const NAMES: Record<string, string> = { OWN: 'Eigene Datenbank', HSN_TSN: 'HSN/TSN Provider', KBA: 'KBA', DAT: 'DAT', VIN: 'VIN Provider', MANUAL: 'Manuelle Daten' };

export default async function SourcesPage() {
  const user = await requirePagePermission('vehicledata.manage');
  const [providers, own, manual, conflicts] = await Promise.all([
    listProviders(user),
    db.vehicleHsnTsn.count({ where: { deletedAt: null } }),
    db.vehicleHsnTsn.count({ where: { deletedAt: null, source: 'MANUAL' } }),
    db.vehicleDataConflict.count({ where: { status: 'OPEN' } }),
  ]);
  const shown = providers.filter((p) => p.key !== 'IMPORT_FILE');
  const logs = await providerLogs(user, 'HSN_TSN', 15);
  const ext = providers.find((p) => p.key === 'HSN_TSN')!;
  const now = new Date();

  return (
    <>
      <PageHeader title="Datenquellen" intro="Die Anwendung arbeitet mit der eigenen Fahrzeugdatenbank. Externe Anbieter sind austauschbare Zulieferer – ohne sie bleibt alles nutzbar." />
      <DataNav active="quellen" conflicts={conflicts} />
      <div className="vd-cards">
        {shown.map((p) => {
          const connected = getProvider(p.key)?.connected ?? false;
          const paused = p.pausedUntil && p.pausedUntil > now;
          const status = p.kind === 'internal' ? (p.enabled ? 'Aktiv' : 'Inaktiv') : !connected ? 'Nicht angebunden' : paused ? 'Pausiert' : p.enabled ? 'Aktiv' : 'Inaktiv';
          const tone = status === 'Aktiv' ? 'ok' : status === 'Pausiert' ? 'warn' : 'muted';
          return (
            <article key={p.key} className="adm-card vd-card" aria-label={NAMES[p.key] ?? p.name}>
              <h3>{NAMES[p.key] ?? p.name}<Badge tone={tone}>{status}</Badge></h3>
              <p className="t-3" style={{ margin: 0, fontSize: 12.5 }}>{p.description}</p>
              <dl>
                <dt>Typ</dt><dd>{p.kind === 'internal' ? 'Intern' : 'Extern'}</dd>
                <dt>Lizenzstatus</dt><dd>{p.kind === 'internal' ? '–' : <Badge tone={LIC_TONE[p.licenseStatus]}>{LICENSE_LABELS[p.licenseStatus]}</Badge>}</dd>
                {p.kind === 'external' && <><dt>Automatische Abfragen</dt><dd>{p.autoLookup ? 'An' : 'Aus'}</dd><dt>Massenimport</dt><dd>{p.massImport ? 'An' : 'Aus'}</dd></>}
                <dt>Letzte Verbindung</dt><dd>{p.kind === 'internal' ? 'immer verfügbar' : p.lastConnectedAt ? fmtWhen(p.lastConnectedAt) : '–'}</dd>
                <dt>Letzte erfolgreiche Anfrage</dt><dd>{p.kind === 'internal' ? '–' : p.lastSuccessAt ? fmtWhen(p.lastSuccessAt) : '–'}</dd>
                <dt>Anfragen gesamt</dt><dd>{p.kind === 'internal' ? (p.key === 'OWN' ? `${own} ${own === 1 ? 'Datensatz' : 'Datensätze'}` : `${manual} ${manual === 1 ? 'Datensatz' : 'Datensätze'}`) : p.requestCount}</dd>
                {p.kind === 'external' && <><dt>Fehlerquote</dt><dd>{p.errorRate == null ? '–' : `${p.errorRate} %`}{p.lastErrorCategory ? ` (zuletzt: ${p.lastErrorCategory})` : ''}</dd></>}
                {paused && <><dt>Pausiert bis</dt><dd>{fmtWhen(p.pausedUntil!)}</dd></>}
              </dl>
              {!connected && p.kind === 'external' && <p className="vi-hint">Es ist noch kein Adapter mit echter Schnittstelle vorhanden. Es werden keine Zugangsdaten, Endpunkte oder Daten erfunden.</p>}
            </article>
          );
        })}
      </div>

      <Section title="Externe Datenquelle: HSN/TSN-Anbieter">
        <div className="adm-alert adm-alert-warn" style={{ marginBottom: 12 }}>
          <b>Status: {LICENSE_LABELS[ext.licenseStatus]}</b>
          <span>· Automatische Abfragen: {ext.autoLookup ? 'An' : 'Aus'} · Massenimport: {ext.massImport ? 'An' : 'Aus'}. Vor der Freigabe bitte Nutzungsbedingungen und Lizenzfragen des Anbieters rechtlich prüfen. Es werden ausschließlich öffentlich erreichbare Seiten per normalem serverseitigem Abruf gelesen.</span>
        </div>
        <ProviderSettings cfg={{ key: 'HSN_TSN', licenseStatus: ext.licenseStatus, enabled: ext.enabled, autoLookup: ext.autoLookup, massImport: ext.massImport, rateLimitPerMin: ext.rateLimitPerMin, urlTemplate: ext.config.urlTemplate ?? '', notes: ext.notes ?? '', paused: Boolean(ext.pausedUntil && ext.pausedUntil > now) }} />
      </Section>
      <Section title="Verbindung testen"><ProviderTester providerKey="HSN_TSN" /></Section>
      <Section title="Letzte Anfragen (ohne personenbezogene Daten)">
        {logs.length === 0 ? <p className="t-3" style={{ margin: 0 }}>Noch keine Anfragen an diesen Anbieter.</p> : (
          <div className="dt-wrap"><table className="vi-prov"><thead><tr><th>Zeitpunkt</th><th>Art</th><th>Ergebnis</th><th>HTTP</th><th>Treffer</th><th>Dauer</th><th>Fehlerart</th></tr></thead><tbody>
            {logs.map((l) => <tr key={l.id}><td className="nowrap">{fmtWhen(l.at)}</td><td>{l.requestType}</td><td>{l.status}</td><td>{l.httpStatus ?? '–'}</td><td>{l.recordsFound ?? '–'}</td><td>{l.durationMs} ms</td><td>{l.errorCategory ?? '–'}</td></tr>)}
          </tbody></table></div>
        )}
      </Section>
    </>
  );
}
