import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { orNotFound } from '@/server/admin/safe';
import { getJob } from '@/server/vehicledata/imports';
import { COMPARE_LABELS, FUEL_LABELS, diffRecords, fmtCc, fmtPower, sourceLabel, type CompareField, type FuelKey } from '@/lib/vehicle-data';
import { Badge, DetailHeader, EmptyState, Kpi, Kpis, Pagination, Section, hrefWith, qp, qpage, fmtWhen } from '@/components/admin/ui';
import { JOB_LABELS } from '../../labels';
import { JobActions } from './JobActions';

export const metadata: Metadata = { title: 'Importvorschau' };

const OUTCOMES: [string, string][] = [['', 'Alle'], ['NEW', 'Neu'], ['EXISTS', 'Vorhanden'], ['CONFLICT', 'Konflikte'], ['INVALID', 'Ungültig'], ['IMPORTED', 'Importiert']];
const O_TONE: Record<string, 'ok' | 'info' | 'warn' | 'danger' | 'muted'> = { NEW: 'info', EXISTS: 'muted', CONFLICT: 'warn', INVALID: 'danger', IMPORTED: 'ok' };

export default async function ImportJobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('vehicledata.manage');
  const { id } = await params;
  const sp = await searchParams;
  const outcome = qp(sp.ergebnis);
  const { job, rows, total, page, pageSize } = await orNotFound(getJob(user, id, { outcome, page: qpage(sp.seite) }));
  const phase = ((job.params ?? {}) as { phase?: string }).phase ?? 'ready';
  const [lab, tone] = JOB_LABELS[job.status];
  const base = `/admin/fahrzeugdaten/import/${id}`;
  const fieldVal = (f: CompareField, r: { manufacturer?: string | null; vehicleNameRaw?: string | null; powerKw?: number | null; powerHp?: number | null; displacementCc?: number | null; fuelType?: string | null }) =>
    f === 'manufacturer' ? r.manufacturer : f === 'name' ? r.vehicleNameRaw : f === 'powerKw' ? (r.powerKw != null ? `${r.powerKw} kW` : null) : f === 'powerHp' ? (r.powerHp != null ? `${r.powerHp} PS` : null) : f === 'displacementCc' ? fmtCc(r.displacementCc) : r.fuelType ? FUEL_LABELS[r.fuelType as FuelKey] : null;

  return (
    <>
      <DetailHeader crumbs={[{ label: 'Fahrzeugdaten', href: '/admin/fahrzeugdaten' }, { label: 'Import', href: '/admin/fahrzeugdaten/import' }, { label: job.label }]} title="Importvorschau" badge={<Badge tone={tone}>{lab}</Badge>} meta={[`Quelle: ${job.provider.name}`, `Modus: ${job.mode}`, `Gestartet ${fmtWhen(job.createdAt)}`]} />
      {job.message && <div className={`adm-alert ${job.status === 'FAILED' || job.status === 'PAUSED' ? 'adm-alert-warn' : ''}`} role="status">{job.message}</div>}
      <Kpis>
        <Kpi label="Gefundene Datensätze" value={job.total} />
        <Kpi label={job.status === 'COMPLETED' ? 'Importiert' : 'Neu'} value={job.status === 'COMPLETED' ? job.countImported : job.countNew} href={hrefWith(base, { ergebnis: job.status === 'COMPLETED' ? 'IMPORTED' : 'NEW' })} />
        <Kpi label="Bereits vorhanden" value={job.countExists} href={hrefWith(base, { ergebnis: 'EXISTS' })} />
        <Kpi label="Konflikte" value={job.countConflict} warn={job.countConflict > 0} href={hrefWith(base, { ergebnis: 'CONFLICT' })} />
        <Kpi label="Ungültig" value={job.countInvalid} warn={job.countInvalid > 0} href={hrefWith(base, { ergebnis: 'INVALID' })} />
      </Kpis>
      <JobActions id={id} status={job.status} phase={phase} conflicts={job.countConflict} canImport />
      <nav className="adm-seg" aria-label="Ergebnis" style={{ marginTop: 16 }}>
        {OUTCOMES.map(([k, l]) => <Link key={k} href={hrefWith(base, { ergebnis: k || undefined })} aria-current={(outcome ?? '') === k ? 'page' : undefined}>{l}</Link>)}
      </nav>
      <Section title="Datensätze">
        {rows.length === 0 ? <EmptyState icon="doc" title="Keine Zeilen in dieser Ansicht" /> : (
          <div className="dt-wrap"><table className="dt"><thead><tr><th>#</th><th>HSN / TSN</th><th>Fahrzeug</th><th>Leistung</th><th>Hubraum</th><th>Ergebnis</th><th>Hinweis</th></tr></thead><tbody>
            {rows.map((r) => {
              const p = r.payload;
              const diff = r.outcome === 'CONFLICT' && r.record ? diffRecords(r.record, p) : [];
              return (
                <tr key={r.id}>
                  <td data-slot="hide" className="t-3">{r.position + 1}</td>
                  <td data-slot="title" className="mono">{r.hsn ? `${r.hsn} / ${r.tsn}` : <span className="t-3">–</span>}</td>
                  <td data-slot="sub">{r.hsn ? <>{p.vehicleNameRaw ?? [p.manufacturer, p.model].filter(Boolean).join(' ')}</> : <span className="t-2">{(p as unknown as { text?: string }).text}</span>}</td>
                  <td data-slot="meta" className="nowrap">{r.hsn ? fmtPower(p.powerKw, p.powerHp) ?? '–' : ''}</td>
                  <td data-slot="hide" className="nowrap">{r.hsn ? fmtCc(p.displacementCc) ?? '–' : ''}</td>
                  <td data-slot="badge"><Badge tone={O_TONE[r.outcome]}>{OUTCOMES.find(([k]) => k === r.outcome)?.[1]}</Badge></td>
                  <td data-slot="hide" style={{ fontSize: 12.5 }}>
                    {diff.length > 0 ? diff.map((f) => <div key={f}><b>{COMPARE_LABELS[f]}:</b> Bestand {fieldVal(f, r.record!) ?? 'n. v.'} ↔ Import {fieldVal(f, p) ?? 'n. v.'} <span className="t-3">({sourceLabel(r.record!.source)})</span></div>) : r.error ?? ''}
                  </td>
                </tr>
              );
            })}
          </tbody></table></div>
        )}
        <Pagination total={total} page={page} pageSize={pageSize} basePath={base} params={{ ergebnis: outcome }} noun="Zeilen" />
      </Section>
    </>
  );
}
