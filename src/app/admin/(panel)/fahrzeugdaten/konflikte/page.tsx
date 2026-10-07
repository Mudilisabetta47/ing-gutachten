import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { listConflicts } from '@/server/vehicledata/catalog';
import { COMPARE_LABELS, fmtCc, fmtPower, sourceLabel, FUEL_LABELS, type FuelKey } from '@/lib/vehicle-data';
import { EmptyState, PageHeader, Pagination, fmtWhen, qpage } from '@/components/admin/ui';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { DataNav } from '../DataNav';
import { ConflictActions } from './ConflictActions';

export const metadata: Metadata = { title: 'Datenkonflikte' };

export default async function ConflictsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('vehicledata.manage');
  const list = await listConflicts(user, { page: qpage((await searchParams).seite) });
  const line = (r: { manufacturer?: string | null; vehicleNameRaw?: string | null; model?: string | null; powerKw?: number | null; powerHp?: number | null; displacementCc?: number | null; fuelType?: string | null }) =>
    [r.vehicleNameRaw ?? [r.manufacturer, r.model].filter(Boolean).join(' '), fmtPower(r.powerKw, r.powerHp), fmtCc(r.displacementCc), r.fuelType ? FUEL_LABELS[r.fuelType as FuelKey] : null].filter(Boolean).join(' · ');
  return (
    <>
      <PageHeader title="Datenkonflikte" intro="HSN/TSN identisch, Inhalt abweichend: Bestehende Daten werden nie automatisch überschrieben – Sie entscheiden." />
      <DataNav active="konflikte" conflicts={list.total} />
      {list.rows.length === 0 ? <EmptyState icon="check" title="Keine offenen Konflikte">Wenn zwei Quellen für dieselbe HSN/TSN unterschiedliche Angaben liefern, erscheint der Fall hier.</EmptyState> : (
        <div style={{ display: 'grid', gap: 14 }}>
          {list.rows.map((c) => (
            <article key={c.id} className="adm-card" style={{ display: 'grid', gap: 12 }}>
              <header style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <AdminIcon name="alert" /><b className="mono" style={{ fontSize: 17, letterSpacing: '.08em' }}>{c.hsn} / {c.tsn}</b>
                <span className="t-3" style={{ fontSize: 12.5 }}>abweichend: {c.fields.map((f) => COMPARE_LABELS[f]).join(', ')} · {fmtWhen(c.createdAt)}</span>
                <Link href={`/admin/fahrzeugdaten/${c.record.id}/`} className="adm-link" style={{ marginLeft: 'auto', fontSize: 13 }}>Datensatz öffnen</Link>
              </header>
              <div className="adm-form-grid">
                <div className="vi-mini" style={{ display: 'grid', gap: 4 }}><b>Eigene Datenbank <span className="t-3" style={{ fontWeight: 400 }}>({sourceLabel(c.record.source)})</span></b><span>{line(c.record)}</span>{c.fields.map((f) => <span key={f} className="t-2">{COMPARE_LABELS[f]}: <b>{c.own[f] ?? 'n. v.'}</b></span>)}</div>
                <div className="vi-mini" style={{ display: 'grid', gap: 4 }}><b>Externe Quelle <span className="t-3" style={{ fontWeight: 400 }}>({sourceLabel(c.incomingSource)})</span></b><span>{line(c.incomingData)}</span>{c.fields.map((f) => <span key={f} className="t-2">{COMPARE_LABELS[f]}: <b>{c.incoming[f] ?? 'n. v.'}</b></span>)}</div>
              </div>
              <ConflictActions id={c.id} own={{ manufacturer: c.record.manufacturer, model: c.record.model, variant: c.record.variant, powerKw: c.record.powerKw, powerHp: c.record.powerHp, displacementCc: c.record.displacementCc, fuelType: c.record.fuelType }} />
            </article>
          ))}
        </div>
      )}
      <Pagination total={list.total} page={list.page} pageSize={list.pageSize} basePath="/admin/fahrzeugdaten/konflikte" params={{}} noun="Konflikte" />
    </>
  );
}
