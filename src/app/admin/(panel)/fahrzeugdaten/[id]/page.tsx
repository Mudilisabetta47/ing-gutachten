import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { orNotFound } from '@/server/admin/safe';
import { getRecord, withOpenConflicts } from '@/server/vehicledata/catalog';
import { db } from '@/server/db';
import { COMPARE_LABELS, FUEL_LABELS, fmtCc, fmtPower, sourceLabel, type FuelKey } from '@/lib/vehicle-data';
import { DetailHeader, Rows, Section, fmtWhen } from '@/components/admin/ui';
import { StatusBadge } from '@/components/admin/VehicleIdentify';
import { ConfirmForm } from '@/components/admin/forms';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { archiveRecordAction } from '../actions';

export const metadata: Metadata = { title: 'Fahrzeugdatensatz' };
const NA = <span className="t-3">Nicht verfügbar</span>;

export default async function RecordPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission('vehicledata.manage');
  const { id } = await params;
  const r = await orNotFound(getRecord(user, id));
  const [dto] = await withOpenConflicts([r]);
  const used = await db.vehicle.count({ where: { hsnTsnId: id, deletedAt: null } });
  const raw = (r.rawData ?? {}) as { raw?: Record<string, string | null> };
  return (
    <>
      <DetailHeader
        crumbs={[{ label: 'Fahrzeugdaten', href: '/admin/fahrzeugdaten' }, { label: `${r.hsn} / ${r.tsn}` }]}
        title={<span><span className="t-3" style={{ display: 'block', fontSize: 13, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase' }}>{r.manufacturer ?? 'Hersteller unbekannt'}</span>{r.model ?? r.vehicleNameRaw ?? 'Fahrzeug'}{r.variant ? ` ${r.variant}` : ''}</span>}
        badge={<StatusBadge status={dto.verificationStatus} />}
        meta={[<span key="c" className="mono">{r.hsn} / {r.tsn}</span>, sourceLabel(r.source), `${used} Fahrzeug(e) verknüpft`]}
        actions={dto.openConflicts?.length ? <Link href="/admin/fahrzeugdaten/konflikte" className="adm-btn adm-btn-secondary"><AdminIcon name="alert" />Konflikte</Link> : undefined}
      />
      <div className="adm-work" style={{ marginTop: 20 }}>
        <div style={{ minWidth: 0 }}>
          <Section title="Normalisierte Werte">
            <Rows items={[
              ['Hersteller', r.manufacturer ?? NA], ['Modell', r.model ?? NA], ['Generation', r.generation ?? NA], ['Variante', r.variant ?? NA], ['Karosserie', r.bodyStyle ?? NA], ['Motor', r.engineName ?? NA], ['Motorkennbuchstabe', r.engineCode ?? NA],
              ['Leistung', fmtPower(r.powerKw, r.powerHp) ?? NA], ['Hubraum', fmtCc(r.displacementCc) ?? NA], ['Kraftstoff', r.fuelType ? FUEL_LABELS[r.fuelType as FuelKey] : NA],
              ['Drehmoment', r.torqueNm ? `${r.torqueNm} Nm` : NA], ['Antrieb', r.driveType ?? NA], ['Getriebe', r.transmission ?? NA], ['Fahrzeugklasse', r.vehicleClass ?? NA], ['Typgenehmigung', r.typeApproval ?? NA],
              ['Bauzeitraum', r.productionFrom || r.productionTo ? `${r.productionFrom?.toISOString().slice(0, 7) ?? '…'} – ${r.productionTo?.toISOString().slice(0, 7) ?? 'heute'}` : NA],
            ]} />
          </Section>
          <Section title="Herkunft und Nachvollziehbarkeit">
            <Rows items={[
              ['Quelle', sourceLabel(r.source)], ['Quell-URL', r.sourceUrl ? <a key="u" href={r.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="adm-link" style={{ wordBreak: 'break-all' }}>{r.sourceUrl}</a> : NA],
              ['Quell-ID', r.sourceRecordId || NA], ['Eingelesen am', r.sourceImportedAt ? fmtWhen(r.sourceImportedAt) : NA], ['Zuletzt geprüft', r.sourceLastCheckedAt ? fmtWhen(r.sourceLastCheckedAt) : NA],
              ['Importer-Version', r.importerVersion ?? NA], ['Hash des Quelldatensatzes', r.sourceHash ? <span key="h" className="mono" style={{ fontSize: 11.5, wordBreak: 'break-all' }}>{r.sourceHash}</span> : NA],
            ]} />
          </Section>
          <Section title="Originalwerte der Quelle (vor der Normalisierung)">
            <Rows items={[['Hersteller (roh)', r.manufacturerNameRaw ?? NA], ['Fahrzeugbezeichnung (roh)', r.vehicleNameRaw ?? NA], ...Object.entries(raw.raw ?? {}).filter(([k, v]) => v && !['name', 'manufacturer'].includes(k)).map(([k, v]) => [`${k} (roh)`, v as string] as [string, string])]} />
          </Section>
        </div>
        <aside>
          {dto.openConflicts && dto.openConflicts.length > 0 && (
            <div className="adm-alert adm-alert-warn" style={{ marginBottom: 14 }}><AdminIcon name="alert" /><div><b>Offene Konflikte</b>{dto.openConflicts.map((c) => <div key={c.id}>{c.fields.map((f) => COMPARE_LABELS[f]).join(', ')} – {sourceLabel(c.incomingSource)}</div>)}</div></div>
          )}
          <div className="adm-card" style={{ display: 'grid', gap: 10 }}>
            <b style={{ fontSize: 13 }}>Verwaltung</b>
            <ConfirmForm action={archiveRecordAction} id={id} label="Datensatz archivieren" title="Datensatz archivieren?" confirm="Der Datensatz wird nicht mehr gefunden. Bereits übernommene Fahrzeugdaten bleiben unverändert." danger />
          </div>
        </aside>
      </div>
    </>
  );
}
