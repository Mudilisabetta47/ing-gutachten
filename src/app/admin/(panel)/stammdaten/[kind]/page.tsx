import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePagePermission } from '@/server/auth/guards';
import { listOrganizations } from '@/server/pipeline/masterdata';
import { PAGE_SIZE } from '@/server/pipeline/leads';
import { ORG_LABELS, orgKindFromSlug } from '@/lib/workflow';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { AutoForm } from '@/components/admin/AutoForm';
import { Menu } from '@/components/admin/Overlay';
import { Badge, EmptyState, FilterChips, PageHeader, Pagination, SortTh, fmtWhen, hrefWith, phoneHref, qp, qpage, type Chip } from '@/components/admin/ui';

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }): Promise<Metadata> {
  const k = orgKindFromSlug((await params).kind);
  return { title: k ? ORG_LABELS[k].many : 'Stammdaten' };
}

export default async function OrganizationsPage({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePagePermission('masterdata.read', 'masterdata.write');
  const kind = orgKindFromSlug((await params).kind);
  if (!kind) notFound();
  const L = ORG_LABELS[kind];
  const sp = await searchParams;
  const f = { q: qp(sp.q), archiv: qp(sp.archiv) === '1', sort: qp(sp.sort), dir: qp(sp.dir) };
  const list = await listOrganizations(user, { kind, ...f, page: qpage(sp.seite) });
  const canWrite = user.permissions.has('masterdata.write');
  const base = `/admin/stammdaten/${L.slug}`;
  const params2 = { q: f.q, archiv: f.archiv ? '1' : undefined, sort: f.sort, dir: f.dir };
  const chips: Chip[] = [
    f.q && { label: 'Suche', value: f.q, href: hrefWith(base, { ...params2, q: undefined }) },
    f.archiv && { label: 'Archiv', value: 'anzeigen', href: hrefWith(base, { ...params2, archiv: undefined }) },
  ].filter(Boolean) as Chip[];
  const sortProps = { sort: f.sort ?? 'name', dir: f.dir ?? 'asc', basePath: base, params: params2 };
  const caseCount = (o: (typeof list.rows)[number]) => ({ INSURANCE: o._count.casesInsurance, LAWYER: o._count.casesLawyer, WORKSHOP: o._count.casesWorkshop, DEALERSHIP: o._count.casesDealership, PARTNER: o._count.casesPartner })[kind];

  return (
    <>
      <PageHeader
        title={L.many}
        intro={kind === 'PARTNER' ? 'Vermittler und Partner. Zuordnung zum Fall nur zur Nachvollziehbarkeit der Herkunft – keine Vergütungsfunktion (siehe Finanzen → Provisionen).' : undefined}
        actions={canWrite ? <Link href={`${base}/neu/`} className="adm-btn"><AdminIcon name="plus" />{L.one} anlegen</Link> : null}
      />
      <AutoForm action={base}>
        {f.sort && <input type="hidden" name="sort" value={f.sort} />}
        {f.dir && <input type="hidden" name="dir" value={f.dir} />}
        <div className="grow adm-input-group">
          <AdminIcon name="search" />
          <input name="q" defaultValue={f.q} className="adm-input" placeholder="Name, Ansprechpartner, Ort, E-Mail" autoComplete="off" aria-label="Suche" />
        </div>
        {canWrite && <label className="adm-check"><input type="checkbox" name="archiv" value="1" defaultChecked={f.archiv} /> Archiv</label>}
      </AutoForm>
      <FilterChips chips={chips} clearHref={base} />

      {list.rows.length === 0 ? (
        <EmptyState icon="building" title={chips.length ? 'Nichts gefunden' : `Noch keine ${L.many}`} action={chips.length ? <Link href={base} className="adm-btn adm-btn-secondary">Suche zurücksetzen</Link> : canWrite ? <Link href={`${base}/neu/`} className="adm-btn">{L.one} anlegen</Link> : undefined}>
          {chips.length ? 'Passen Sie die Suche an.' : `Legen Sie hier ${L.many} an, damit sie im Fall mit einem Klick zugeordnet werden können.`}
        </EmptyState>
      ) : (
        <div className="dt-wrap">
          <table className="dt">
            <thead>
              <tr>
                <SortTh label="Name" field="name" {...sortProps} />
                <th>Ansprechpartner</th>
                <SortTh label="Ort" field="ort" {...sortProps} />
                <th>Telefon</th>
                <th>E-Mail</th>
                <th className="num">Fälle</th>
                <th aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {list.rows.map((o) => (
                <tr key={o.id} className={o.deletedAt ? 'muted-row' : undefined}>
                  <td data-slot="title"><Link href={`${base}/${o.id}/`} className="primary stretch">{o.name}</Link>{o.deletedAt && <Badge tone="danger">Archiv</Badge>}</td>
                  <td data-slot="sub">{o.contactName ?? <span className="t-3">–</span>}</td>
                  <td data-slot="meta">{o.city ?? <span className="t-3">–</span>}</td>
                  <td data-slot="hide" className="nowrap">{o.phone ?? <span className="t-3">–</span>}</td>
                  <td data-slot="hide" className="truncate-1" style={{ maxWidth: 240 }}>{o.email ?? <span className="t-3">–</span>}</td>
                  <td data-slot="badge" className="num">{caseCount(o) ? <Badge tone="muted">{caseCount(o)} {caseCount(o) === 1 ? 'Fall' : 'Fälle'}</Badge> : <span className="t-3">–</span>}</td>
                  <td data-slot="hide" className="menu-cell">
                    <Menu label={`Aktionen für ${o.name}`} triggerClassName="adm-btn adm-btn-quiet adm-btn-icon adm-btn-sm" trigger={<AdminIcon name="more" />}
                      entries={[
                        { kind: 'link', label: 'Öffnen', href: `${base}/${o.id}/`, icon: 'external' },
                        ...(phoneHref(o.phone) ? [{ kind: 'link' as const, label: 'Anrufen', href: phoneHref(o.phone)!, icon: 'phone' as const }] : []),
                        ...(o.email ? [{ kind: 'link' as const, label: 'E-Mail schreiben', href: `mailto:${o.email}`, icon: 'mail' as const }] : []),
                      ]} />
                    <span className="sr-only-adm">{fmtWhen(o.updatedAt)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination total={list.total} page={list.page} pageSize={PAGE_SIZE} basePath={base} params={params2} noun={L.many} />
    </>
  );
}
