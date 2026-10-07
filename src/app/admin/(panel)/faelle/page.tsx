import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { caseStatusCounts, listCases, listExperts } from '@/server/pipeline/cases';
import { PAGE_SIZE } from '@/server/pipeline/leads';
import { CASE_LABELS, CASE_STATUSES, SERVICE_LABELS } from '@/lib/workflow';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { AutoForm } from '@/components/admin/AutoForm';
import { EmptyState, FilterChips, PageHeader, Pagination, SortTh, StatusPill, fmtWhen, hrefWith, qp, qpage, type Chip } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Fälle' };

export default async function CasesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('cases.read.all', 'cases.read.own');
  const sp = await searchParams;
  const f = { q: qp(sp.q), status: qp(sp.status), expert: qp(sp.sv), archiv: qp(sp.archiv) === '1', sort: qp(sp.sort), dir: qp(sp.dir) };
  const seeAll = user.permissions.has('cases.read.all');
  const [list, counts, experts] = await Promise.all([
    listCases(user, { ...f, page: qpage(sp.seite) }),
    caseStatusCounts(user),
    seeAll ? listExperts(user) : Promise.resolve([]),
  ]);
  const base = '/admin/faelle';
  const params = { q: f.q, status: f.status, sv: f.expert, archiv: f.archiv ? '1' : undefined, sort: f.sort, dir: f.dir };
  const without = (k: keyof typeof params) => hrefWith(base, { ...params, [k]: undefined, seite: undefined });
  const expertName = f.expert === 'me' ? 'Meine' : f.expert === 'none' ? 'Nicht zugewiesen' : experts.find((e) => e.id === f.expert) ? `${experts.find((e) => e.id === f.expert)!.firstName} ${experts.find((e) => e.id === f.expert)!.lastName}` : f.expert;
  const chips: Chip[] = [
    f.q && { label: 'Suche', value: f.q, href: without('q') },
    f.status && { label: 'Status', value: f.status === 'open' ? 'Offen' : CASE_LABELS[f.status as keyof typeof CASE_LABELS] ?? f.status, href: without('status') },
    f.expert && { label: 'Gutachter', value: expertName ?? '', href: without('sv') },
    f.archiv && { label: 'Archiv', value: 'anzeigen', href: without('archiv') },
  ].filter(Boolean) as Chip[];
  const open = CASE_STATUSES.filter((s) => s !== 'CLOSED' && s !== 'CANCELLED').reduce((n, s) => n + (counts[s] ?? 0), 0);
  const sortProps = { sort: f.sort ?? 'eingang', dir: f.dir ?? 'desc', basePath: base, params };

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
          <Link key={s} href={hrefWith(base, { ...params, status: s, seite: undefined })} aria-current={f.status === s ? 'page' : undefined}>{CASE_LABELS[s]} <span className="n">{counts[s]}</span></Link>
        ) : null))}
      </nav>

      <AutoForm action={base}>
        {f.status && <input type="hidden" name="status" value={f.status} />}
        {f.sort && <input type="hidden" name="sort" value={f.sort} />}
        {f.dir && <input type="hidden" name="dir" value={f.dir} />}
        <div className="grow adm-input-group">
          <AdminIcon name="search" />
          <input name="q" defaultValue={f.q} className="adm-input" placeholder="Fallnummer, Kunde, Kennzeichen, Schadennummer" autoComplete="off" aria-label="Suche" />
        </div>
        {seeAll && (
          <select name="sv" defaultValue={f.expert ?? ''} className="adm-input" aria-label="Gutachter">
            <option value="">Alle Gutachter</option>
            <option value="me">Meine</option>
            <option value="none">Nicht zugewiesen</option>
            {experts.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
          </select>
        )}
        {user.permissions.has('cases.delete') && <label className="adm-check"><input type="checkbox" name="archiv" value="1" defaultChecked={f.archiv} /> Archiv</label>}
      </AutoForm>

      <FilterChips chips={chips} clearHref={base} />

      {list.rows.length === 0 ? (
        <EmptyState icon="case" title={chips.length ? 'Keine Fälle für diese Filter' : seeAll ? 'Noch keine Fälle' : 'Ihnen ist noch kein Fall zugewiesen'}
          action={chips.length ? <Link href={base} className="adm-btn adm-btn-secondary">Filter zurücksetzen</Link> : seeAll ? <Link href="/admin/anfragen" className="adm-btn adm-btn-secondary">Zu den Anfragen</Link> : undefined}>
          {chips.length ? 'Passen Sie die Filter an oder setzen Sie sie zurück.' : seeAll ? 'Sobald eine Anfrage in einen Fall umgewandelt wird, erscheint er hier.' : 'Sobald das Büro Ihnen einen Fall zuweist, erscheint er hier.'}
        </EmptyState>
      ) : (
        <div className="dt-wrap">
          <table className="dt">
            <thead>
              <tr>
                <SortTh label="Fallnummer" field="nr" {...sortProps} />
                <SortTh label="Kunde" field="kunde" {...sortProps} />
                <th>Fahrzeug</th>
                <th>Kennzeichen</th>
                <SortTh label="Status" field="status" {...sortProps} />
                <th>Gutachter</th>
                <SortTh label="Letzte Aktivität" field="aktiv" {...sortProps} />
              </tr>
            </thead>
            <tbody>
              {list.rows.map((c) => (
                <tr key={c.id} className={c.deletedAt ? 'muted-row' : undefined}>
                  <td data-slot="title" className="nowrap"><Link href={`/admin/faelle/${c.caseNumber}/`} className="primary stretch mono">{c.caseNumber}</Link><span className="secondary">{SERVICE_LABELS[c.serviceType]}</span></td>
                  <td data-slot="sub">{c.customer.company || `${c.customer.firstName} ${c.customer.lastName}`.trim()}</td>
                  <td data-slot="hide">{c.vehicle.manufacturer} {c.vehicle.model}</td>
                  <td data-slot="meta" className="nowrap">{c.vehicle.licensePlate ? <span className="mono">{c.vehicle.licensePlate}</span> : <span className="t-3">–</span>}<span className="adm-hide-lg-up"> · {c.vehicle.manufacturer} {c.vehicle.model}</span></td>
                  <td data-slot="badge"><StatusPill kind="case" status={c.status} label={CASE_LABELS[c.status]} />{c.deletedAt && <span className="adm-badge adm-badge-danger" style={{ marginLeft: 6 }}>Archiv</span>}</td>
                  <td data-slot="meta">{c.assignedExpert ? `${c.assignedExpert.firstName} ${c.assignedExpert.lastName}` : <span className="t-3">Nicht zugewiesen</span>}</td>
                  <td data-slot="meta" className="nowrap t-2">{fmtWhen(c.updatedAt)}</td>
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
