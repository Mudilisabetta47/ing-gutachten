import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { catalogStats, searchCatalog } from '@/server/vehicledata/catalog';
import { FUEL_LABELS, VERIFICATION_LABELS, fmtCc, fmtPower, sourceLabel, type FuelKey } from '@/lib/vehicle-data';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { AutoForm } from '@/components/admin/AutoForm';
import { StatusBadge } from '@/components/admin/VehicleIdentify';
import { EmptyState, FilterChips, Kpi, Kpis, PageHeader, Pagination, fmtWhen, hrefWith, qp, qpage, type Chip } from '@/components/admin/ui';
import { DataNav } from './DataNav';

export const metadata: Metadata = { title: 'HSN/TSN-Datenbank' };

export default async function VehicleDataPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('vehicledata.manage');
  const sp = await searchParams;
  const q = qp(sp.q), status = qp(sp.status), source = qp(sp.quelle);
  const [stats, list] = await Promise.all([catalogStats(user), searchCatalog(user, { q, status, source, page: qpage(sp.seite) })]);
  const base = '/admin/fahrzeugdaten';
  const params = { q, status, quelle: source };
  const chips: Chip[] = [
    q && { label: 'Suche', value: q, href: hrefWith(base, { ...params, q: undefined }) },
    status && { label: 'Status', value: VERIFICATION_LABELS[status as keyof typeof VERIFICATION_LABELS] ?? status, href: hrefWith(base, { ...params, status: undefined }) },
    source && { label: 'Quelle', value: sourceLabel(source), href: hrefWith(base, { ...params, quelle: undefined }) },
  ].filter(Boolean) as Chip[];

  return (
    <>
      <PageHeader title="Fahrzeugdaten" intro="Eigene HSN/TSN-Datenbank: Fahrzeuge werden zuerst hier gesucht. Externe Quellen sind nur Zulieferer und optional." actions={<Link href="/admin/fahrzeuge/identifizieren/" className="adm-btn adm-btn-secondary"><AdminIcon name="search" />Fahrzeug identifizieren</Link>} />
      <DataNav active="db" conflicts={stats.conflicts} />
      <Kpis>
        <Kpi label="Datensätze insgesamt" value={stats.total.toLocaleString('de-DE')} />
        <Kpi label="Hersteller" value={stats.makes} />
        <Kpi label="Modelle" value={stats.models} />
        <Kpi label="HSN / TSN" value={`${stats.hsn} / ${stats.tsn}`} note="verschiedene Werte" />
        <Kpi label="Verifiziert" value={stats.verified} href={hrefWith(base, { status: 'VERIFIED' })} />
        <Kpi label="Unvollständig" value={stats.incomplete} href={hrefWith(base, { status: 'PARTIAL' })} note="nicht verifiziert oder Werte fehlen" />
        <Kpi label="Konflikte" value={stats.conflicts} href="/admin/fahrzeugdaten/konflikte" warn={stats.conflicts > 0} />
        <Kpi label="Letzte Synchronisierung" value={stats.lastSync ? fmtWhen(stats.lastSync) : '–'} note={stats.lastSync ? undefined : 'noch keine externe Quelle genutzt'} />
      </Kpis>

      <AutoForm action={base}>
        <div className="grow adm-input-group"><AdminIcon name="search" /><input name="q" defaultValue={q} className="adm-input" placeholder="HSN, TSN, 0588/ABC, Hersteller, Modell, Motor, kW, PS, Hubraum, Kraftstoff" autoComplete="off" aria-label="Suche" /></div>
        <select name="status" defaultValue={status ?? ''} className="adm-input" aria-label="Status"><option value="">Alle Status</option>{Object.entries(VERIFICATION_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select name="quelle" defaultValue={source ?? ''} className="adm-input" aria-label="Quelle"><option value="">Alle Quellen</option>{Object.keys(stats.bySource).map((k) => <option key={k} value={k}>{sourceLabel(k)} ({stats.bySource[k]})</option>)}</select>
      </AutoForm>
      <FilterChips chips={chips} clearHref={base} />

      {list.rows.length === 0 ? (
        <EmptyState icon="car" title={chips.length ? 'Keine Datensätze für diese Suche' : 'Die Fahrzeugdatenbank ist noch leer'} action={chips.length ? <Link href={base} className="adm-btn adm-btn-secondary">Filter zurücksetzen</Link> : <Link href="/admin/fahrzeugdaten/import" className="adm-btn">Import starten</Link>}>
          {chips.length ? 'Passen Sie die Suche an.' : 'Datensätze entstehen durch Import (CSV/JSON), freigegebene externe Anbieter oder manuelle Erfassung beim Identifizieren. Es werden keine Fahrzeugdaten vorgegeben.'}
        </EmptyState>
      ) : (
        <div className="dt-wrap">
          <table className="dt">
            <thead><tr><th>HSN / TSN</th><th>Fahrzeug</th><th>Motor</th><th>Leistung</th><th>Hubraum</th><th>Kraftstoff</th><th>Quelle</th><th>Status</th><th>Geprüft</th></tr></thead>
            <tbody>
              {list.rows.map((r) => (
                <tr key={r.id}>
                  <td data-slot="title"><Link href={`${base}/${r.id}/`} className="primary stretch mono">{r.hsn} / {r.tsn}</Link></td>
                  <td data-slot="sub"><b>{r.manufacturer ?? '–'}</b> {r.model ?? r.vehicleNameRaw ?? ''}{r.variant ? ` ${r.variant}` : ''}</td>
                  <td data-slot="meta">{r.engineName ?? <span className="t-3">–</span>}</td>
                  <td data-slot="meta" className="nowrap">{fmtPower(r.powerKw, r.powerHp) ?? <span className="t-3">–</span>}</td>
                  <td data-slot="hide" className="nowrap">{fmtCc(r.displacementCc) ?? <span className="t-3">–</span>}</td>
                  <td data-slot="hide">{r.fuelType ? FUEL_LABELS[r.fuelType as FuelKey] : <span className="t-3">–</span>}</td>
                  <td data-slot="hide">{sourceLabel(r.source)}</td>
                  <td data-slot="badge"><StatusBadge status={r.verificationStatus} /></td>
                  <td data-slot="hide" className="nowrap t-2">{r.lastCheckedAt ? fmtWhen(new Date(r.lastCheckedAt)) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination total={list.total} page={list.page} pageSize={list.pageSize} basePath={base} params={params} noun="Datensätze" />
    </>
  );
}
