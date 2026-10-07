import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { caseStatusCounts, listCases, listExperts } from '@/server/pipeline/cases';
import { caseRefOptions } from '@/server/pipeline/masterdata';
import { PAGE_SIZE } from '@/server/pipeline/leads';
import { CASE_LABELS, CASE_SHORT, CASE_STATUSES, CLAIM_LABELS, PRIORITY_LABELS, SERVICE_LABELS, type CaseStatusActive, type ClaimTypeKey, type PriorityKey } from '@/lib/workflow';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { AutoForm } from '@/components/admin/AutoForm';
import { ColumnPicker, type ColumnDef } from '@/components/admin/ColumnPicker';
import { PriorityBadge } from '@/components/admin/case-ui';
import { EmptyState, FilterChips, PageHeader, Pagination, SortTh, StatusPill, fmtWhen, hrefWith, qp, qpage, type Chip } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Fälle' };

const COLUMNS: ColumnDef[] = [
  { key: 'fahrzeug', label: 'Fahrzeug', defaultOn: true },
  { key: 'kennzeichen', label: 'Kennzeichen', defaultOn: false },
  { key: 'schadenart', label: 'Schadenart', defaultOn: true },
  { key: 'versicherung', label: 'Versicherung', defaultOn: true },
  { key: 'schadennr', label: 'Schadennummer', defaultOn: false },
  { key: 'gutachter', label: 'Gutachter', defaultOn: true },
  { key: 'standort', label: 'Standort', defaultOn: false },
  { key: 'termin', label: 'Besichtigung', defaultOn: true },
  { key: 'erstellt', label: 'Erstellt', defaultOn: false },
  { key: 'aktiv', label: 'Letzte Aktivität', defaultOn: true },
];
const OFF = new Set(COLUMNS.filter((c) => !c.defaultOn).map((c) => c.key));

export default async function CasesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('cases.read.all', 'cases.read.own');
  const sp = await searchParams;
  const f = {
    q: qp(sp.q), status: qp(sp.status), expert: qp(sp.sv), archiv: qp(sp.archiv) === '1', sort: qp(sp.sort), dir: qp(sp.dir),
    priority: qp(sp.prio), claimType: qp(sp.art), locationId: qp(sp.standort), insuranceOrgId: qp(sp.vers), from: qp(sp.von), to: qp(sp.bis),
  };
  const seeAll = user.permissions.has('cases.read.all');
  const [list, counts, experts, refs] = await Promise.all([
    listCases(user, { ...f, page: qpage(sp.seite) }),
    caseStatusCounts(user),
    seeAll ? listExperts(user) : Promise.resolve([]),
    caseRefOptions(user),
  ]);
  const base = '/admin/faelle';
  const params = { q: f.q, status: f.status, sv: f.expert, archiv: f.archiv ? '1' : undefined, sort: f.sort, dir: f.dir, prio: f.priority, art: f.claimType, standort: f.locationId, vers: f.insuranceOrgId, von: f.from, bis: f.to };
  const without = (k: keyof typeof params) => hrefWith(base, { ...params, [k]: undefined, seite: undefined });
  const expertName = f.expert === 'me' ? 'Meine' : f.expert === 'none' ? 'Nicht zugewiesen' : experts.find((e) => e.id === f.expert) ? `${experts.find((e) => e.id === f.expert)!.firstName} ${experts.find((e) => e.id === f.expert)!.lastName}` : f.expert;
  const chips: Chip[] = [
    f.q && { label: 'Suche', value: f.q, href: without('q') },
    f.status && { label: 'Status', value: f.status === 'open' ? 'Offen' : CASE_LABELS[f.status as CaseStatusActive] ?? f.status, href: without('status') },
    f.expert && { label: 'Gutachter', value: expertName ?? '', href: without('sv') },
    f.priority && { label: 'Priorität', value: PRIORITY_LABELS[f.priority as PriorityKey] ?? f.priority, href: without('prio') },
    f.claimType && { label: 'Schadenart', value: CLAIM_LABELS[f.claimType as ClaimTypeKey] ?? f.claimType, href: without('art') },
    f.locationId && { label: 'Standort', value: refs.locations.find((l) => l.id === f.locationId)?.name ?? '', href: without('standort') },
    f.insuranceOrgId && { label: 'Versicherung', value: refs.insurances.find((l) => l.id === f.insuranceOrgId)?.name ?? '', href: without('vers') },
    f.from && { label: 'Von', value: f.from, href: without('von') },
    f.to && { label: 'Bis', value: f.to, href: without('bis') },
    f.archiv && { label: 'Archiv', value: 'anzeigen', href: without('archiv') },
  ].filter(Boolean) as Chip[];
  const open = CASE_STATUSES.filter((s) => s !== 'CLOSED' && s !== 'CANCELLED').reduce((n, s) => n + (counts[s] ?? 0), 0);
  const sortProps = { sort: f.sort ?? 'eingang', dir: f.dir ?? 'desc', basePath: base, params };
  const hidden = Object.fromEntries([...OFF].map((k) => [`data-hide-${k}`, '1']));

  return (
    <>
      <PageHeader
        title="Fälle"
        intro={seeAll ? undefined : 'Sie sehen die Ihnen zugewiesenen Fälle.'}
        actions={user.permissions.has('cases.write.all') ? <Link href="/admin/faelle/neu/" className="adm-btn"><AdminIcon name="plus" />Neuer Fall</Link> : null}
      />

      <nav aria-label="Status" className="adm-seg">
        <Link href={hrefWith(base, { ...params, status: undefined, seite: undefined })} aria-current={!f.status ? 'page' : undefined}>Alle</Link>
        <Link href={hrefWith(base, { ...params, status: 'open', seite: undefined })} aria-current={f.status === 'open' ? 'page' : undefined}>Offen <span className="n">{open}</span></Link>
        {CASE_STATUSES.map((s) => (counts[s] ? (
          <Link key={s} href={hrefWith(base, { ...params, status: s, seite: undefined })} aria-current={f.status === s ? 'page' : undefined}>{CASE_SHORT[s]} <span className="n">{counts[s]}</span></Link>
        ) : null))}
      </nav>

      <AutoForm action={base}>
        {f.status && <input type="hidden" name="status" value={f.status} />}
        {f.sort && <input type="hidden" name="sort" value={f.sort} />}
        {f.dir && <input type="hidden" name="dir" value={f.dir} />}
        <div className="grow adm-input-group">
          <AdminIcon name="search" />
          <input name="q" defaultValue={f.q} className="adm-input" placeholder="Fallnummer, Kunde, Kennzeichen, FIN, Schadennummer, Telefon, E-Mail" autoComplete="off" aria-label="Suche" />
        </div>
        {seeAll && (
          <select name="sv" defaultValue={f.expert ?? ''} className="adm-input" aria-label="Gutachter">
            <option value="">Alle Gutachter</option>
            <option value="me">Meine</option>
            <option value="none">Nicht zugewiesen</option>
            {experts.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
          </select>
        )}
        <select name="prio" defaultValue={f.priority ?? ''} className="adm-input" aria-label="Priorität">
          <option value="">Alle Prioritäten</option>
          {Object.entries(PRIORITY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <details className="spacer" style={{ position: 'relative' }}>
          <summary className="adm-btn adm-btn-secondary" style={{ listStyle: 'none' }}><AdminIcon name="filter" />Weitere Filter</summary>
          <div className="adm-menu" data-align="right" style={{ padding: 14, width: 'min(340px, 92vw)', display: 'grid', gap: 12 }}>
            <label className="adm-field"><span className="adm-label">Schadenart</span>
              <select name="art" defaultValue={f.claimType ?? ''} className="adm-input"><option value="">Alle</option>{Object.entries(CLAIM_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </label>
            {refs.insurances.length > 0 && (
              <label className="adm-field"><span className="adm-label">Versicherung</span>
                <select name="vers" defaultValue={f.insuranceOrgId ?? ''} className="adm-input"><option value="">Alle</option>{refs.insurances.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
              </label>
            )}
            {refs.locations.length > 1 && (
              <label className="adm-field"><span className="adm-label">Standort</span>
                <select name="standort" defaultValue={f.locationId ?? ''} className="adm-input"><option value="">Alle</option>{refs.locations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
              </label>
            )}
            <div className="adm-form-grid">
              <label className="adm-field"><span className="adm-label">Erstellt von</span><input type="date" name="von" defaultValue={f.from} className="adm-input" /></label>
              <label className="adm-field"><span className="adm-label">bis</span><input type="date" name="bis" defaultValue={f.to} className="adm-input" /></label>
            </div>
            {user.permissions.has('cases.delete') && <label className="adm-check"><input type="checkbox" name="archiv" value="1" defaultChecked={f.archiv} /> Archiv anzeigen</label>}
            <button type="submit" className="adm-btn">Anwenden</button>
          </div>
        </details>
        <ColumnPicker tableId="cases-table" columns={COLUMNS} />
      </AutoForm>

      <FilterChips chips={chips} clearHref={base} />

      {list.rows.length === 0 ? (
        <EmptyState icon="case" title={chips.length ? 'Keine Fälle für diese Filter' : seeAll ? 'Noch keine Fälle' : 'Ihnen ist noch kein Fall zugewiesen'}
          action={chips.length ? <Link href={base} className="adm-btn adm-btn-secondary">Filter zurücksetzen</Link> : seeAll ? <Link href="/admin/anfragen" className="adm-btn adm-btn-secondary">Zu den Anfragen</Link> : undefined}>
          {chips.length ? 'Passen Sie die Filter an oder setzen Sie sie zurück.' : seeAll ? 'Sobald eine Anfrage in einen Fall umgewandelt wird, erscheint er hier.' : 'Sobald das Büro Ihnen einen Fall zuweist, erscheint er hier.'}
        </EmptyState>
      ) : (
        <div className="dt-wrap dt-cols" id="cases-table" {...hidden}>
          <table className="dt">
            <thead>
              <tr>
                <SortTh label="Fallnummer" field="nr" {...sortProps} />
                <SortTh label="Status" field="status" {...sortProps} />
                <SortTh label="Kunde" field="kunde" {...sortProps} />
                <th className="col-fahrzeug">Fahrzeug</th>
                <th className="col-kennzeichen">Kennzeichen</th>
                <th className="col-schadenart">Schadenart</th>
                <SortTh label="Versicherung" field="vers" {...sortProps} className="col-versicherung" />
                <th className="col-schadennr">Schadennr.</th>
                <th className="col-gutachter">Gutachter</th>
                <th className="col-standort">Standort</th>
                <th className="col-termin">Besichtigung</th>
                <SortTh label="Erstellt" field="eingang" {...sortProps} className="col-erstellt" />
                <SortTh label="Letzte Aktivität" field="aktiv" {...sortProps} className="col-aktiv" />
              </tr>
            </thead>
            <tbody>
              {list.rows.map((c) => (
                <tr key={c.id} className={c.deletedAt ? 'muted-row' : undefined}>
                  <td data-slot="title" className="nowrap">
                    <Link href={`/admin/faelle/${c.caseNumber}/`} className="primary stretch mono">{c.caseNumber}</Link>
                    <span className="secondary">{SERVICE_LABELS[c.serviceType]} {c.priority !== 'NORMAL' && <PriorityBadge priority={c.priority as PriorityKey} />}</span>
                  </td>
                  <td data-slot="badge"><StatusPill kind="case" status={c.status} label={CASE_LABELS[c.status]} />{c.deletedAt && <span className="adm-badge adm-badge-danger" style={{ marginLeft: 6 }}>Archiv</span>}</td>
                  <td data-slot="sub">{c.customer.company || `${c.customer.firstName} ${c.customer.lastName}`.trim()}</td>
                  <td data-slot="meta" className="col-fahrzeug">{c.vehicle.manufacturer} {c.vehicle.model}{c.vehicle.licensePlate ? <span className="secondary mono">{c.vehicle.licensePlate}</span> : null}</td>
                  <td data-slot="hide" className="col-kennzeichen nowrap">{c.vehicle.licensePlate ? <span className="mono">{c.vehicle.licensePlate}</span> : <span className="t-3">–</span>}</td>
                  <td data-slot="hide" className="col-schadenart">{c.claimType ? CLAIM_LABELS[c.claimType as ClaimTypeKey] : <span className="t-3">–</span>}</td>
                  <td data-slot="meta" className="col-versicherung">{c.insuranceOrg?.name ?? c.insuranceName ?? <span className="t-3">–</span>}</td>
                  <td data-slot="hide" className="col-schadennr mono" style={{ fontSize: 12 }}>{c.insuranceClaimNumber ?? <span className="t-3">–</span>}</td>
                  <td data-slot="meta" className="col-gutachter">{c.assignedExpert ? `${c.assignedExpert.firstName} ${c.assignedExpert.lastName}` : <span className="t-3">Nicht zugewiesen</span>}</td>
                  <td data-slot="hide" className="col-standort">{c.location?.name ?? <span className="t-3">–</span>}</td>
                  <td data-slot="hide" className="col-termin nowrap">{c.appointments[0] ? fmtWhen(c.appointments[0].startsAt) : <span className="t-3">–</span>}</td>
                  <td data-slot="hide" className="col-erstellt nowrap t-2">{fmtWhen(c.createdAt)}</td>
                  <td data-slot="meta" className="col-aktiv nowrap t-2">{fmtWhen(c.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination total={list.total} page={list.page} pageSize={PAGE_SIZE} basePath={base} params={params} noun="Fälle" />
    </>
  );
}
