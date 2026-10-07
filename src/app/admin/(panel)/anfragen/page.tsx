import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePagePermission } from '@/server/auth/guards';
import { listLeads, leadStatusCounts, PAGE_SIZE } from '@/server/pipeline/leads';
import { LEAD_LABELS, LEAD_STATUSES } from '@/lib/workflow';
import { REQUEST_REASONS } from '@/lib/request-schema';
import { berlinToday } from '@/lib/berlin';
import { AdminIcon } from '@/components/admin/AdminIcon';
import { AutoForm } from '@/components/admin/AutoForm';
import { Menu } from '@/components/admin/Overlay';
import { EmptyState, FilterChips, PageHeader, Pagination, SortTh, StatusPill, fmtWhen, hrefWith, phoneHref, qp, qpage, shortRef, type Chip } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Anfragen' };

type SP = Promise<Record<string, string | string[] | undefined>>;
const SOURCES: Record<string, string> = { website_form: 'Website-Formular' };
const PERIODS: Record<string, string> = { '1': 'Heute', '7': 'Letzte 7 Tage', '30': 'Letzte 30 Tage' };

const daysAgo = (n: number) => new Date(new Date(`${berlinToday()}T12:00:00Z`).getTime() - n * 86_400_000).toISOString().slice(0, 10);

export default async function LeadsPage({ searchParams }: { searchParams: SP }) {
  const user = await requirePagePermission('leads.read');
  const sp = await searchParams;
  const f = { q: qp(sp.q), status: qp(sp.status), service: qp(sp.anlass), source: qp(sp.quelle), place: qp(sp.ort), from: qp(sp.von), to: qp(sp.bis), mail: qp(sp.mail), zeit: qp(sp.zeit), sort: qp(sp.sort), dir: qp(sp.dir) };
  const page = qpage(sp.seite);
  const from = f.zeit && PERIODS[f.zeit] ? daysAgo(Number(f.zeit) - 1) : f.from;

  const [list, counts] = await Promise.all([listLeads(user, { ...f, from, page }), leadStatusCounts(user)]);
  const params = { q: f.q, status: f.status, anlass: f.service, quelle: f.source, ort: f.place, von: f.from, bis: f.to, mail: f.mail, zeit: f.zeit, sort: f.sort, dir: f.dir };
  const base = '/admin/anfragen';
  const without = (k: keyof typeof params) => hrefWith(base, { ...params, [k]: undefined, seite: undefined });
  const chips: Chip[] = [
    f.q && { label: 'Suche', value: f.q, href: without('q') },
    f.status && { label: 'Status', value: LEAD_LABELS[f.status as keyof typeof LEAD_LABELS] ?? f.status, href: without('status') },
    f.service && { label: 'Anliegen', value: f.service, href: without('anlass') },
    f.zeit && PERIODS[f.zeit] && { label: 'Zeitraum', value: PERIODS[f.zeit], href: without('zeit') },
    f.source && { label: 'Quelle', value: SOURCES[f.source] ?? f.source, href: without('quelle') },
    f.place && { label: 'Ort', value: f.place, href: without('ort') },
    f.from && { label: 'Von', value: f.from, href: without('von') },
    f.to && { label: 'Bis', value: f.to, href: without('bis') },
    f.mail && { label: 'Mail', value: 'fehlgeschlagen', href: without('mail') },
  ].filter(Boolean) as Chip[];
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  const sortProps = { sort: f.sort ?? 'eingang', dir: f.dir ?? 'desc', basePath: base, params };

  return (
    <>
      <PageHeader title="Anfragen" intro="Eingänge aus dem Formular auf ing-gutachten.de. Die Originalangaben bleiben unverändert gespeichert." />

      <nav aria-label="Status" className="adm-seg">
        <Link href={hrefWith(base, { ...params, status: undefined, seite: undefined })} aria-current={!f.status ? 'page' : undefined}>Alle <span className="n">{total}</span></Link>
        {LEAD_STATUSES.map((s) => (
          <Link key={s} href={hrefWith(base, { ...params, status: s, seite: undefined })} aria-current={f.status === s ? 'page' : undefined}>
            {LEAD_LABELS[s]} <span className="n">{counts[s] ?? 0}</span>
          </Link>
        ))}
      </nav>

      <AutoForm action={base}>
        {f.status && <input type="hidden" name="status" value={f.status} />}
        {f.sort && <input type="hidden" name="sort" value={f.sort} />}
        {f.dir && <input type="hidden" name="dir" value={f.dir} />}
        <div className="grow adm-input-group">
          <AdminIcon name="search" />
          <input name="q" defaultValue={f.q} className="adm-input" placeholder="Name, Telefon, E-Mail, Kennzeichen suchen" autoComplete="off" aria-label="Suche" />
        </div>
        <select name="anlass" defaultValue={f.service ?? ''} className="adm-input" aria-label="Anliegen">
          <option value="">Alle Anliegen</option>
          {REQUEST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select name="zeit" defaultValue={f.zeit ?? ''} className="adm-input" aria-label="Zeitraum">
          <option value="">Alle Zeiträume</option>
          {Object.entries(PERIODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <details className="spacer" style={{ position: 'relative' }}>
          <summary className="adm-btn adm-btn-secondary" style={{ listStyle: 'none' }}><AdminIcon name="filter" />Weitere Filter</summary>
          <div className="adm-menu" data-align="right" style={{ padding: 14, width: 'min(320px, 90vw)', display: 'grid', gap: 12 }}>
            <label className="adm-field"><span className="adm-label">Quelle</span>
              <select name="quelle" defaultValue={f.source ?? ''} className="adm-input"><option value="">Alle</option>{Object.entries(SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
            <label className="adm-field"><span className="adm-label">Ort</span><input name="ort" defaultValue={f.place} className="adm-input" placeholder="z. B. Hannover" /></label>
            <div className="adm-form-grid">
              <label className="adm-field"><span className="adm-label">Von</span><input type="date" name="von" defaultValue={f.from} className="adm-input" /></label>
              <label className="adm-field"><span className="adm-label">Bis</span><input type="date" name="bis" defaultValue={f.to} className="adm-input" /></label>
            </div>
            <label className="adm-check"><input type="checkbox" name="mail" value="failed" defaultChecked={f.mail === 'failed'} /> Nur mit fehlgeschlagener Mail</label>
            <button type="submit" className="adm-btn">Anwenden</button>
          </div>
        </details>
      </AutoForm>

      <FilterChips chips={chips} clearHref={base} />

      {list.rows.length === 0 ? (
        <EmptyState icon="inbox" title={chips.length ? 'Keine Anfragen für diese Filter' : 'Noch keine Anfragen'} action={chips.length ? <Link href={base} className="adm-btn adm-btn-secondary">Filter zurücksetzen</Link> : undefined}>
          {chips.length ? 'Passen Sie die Filter an oder setzen Sie sie zurück.' : 'Sobald jemand auf der Website „Schaden melden“ nutzt, erscheint die Anfrage hier – mit allen Angaben und Fotos.'}
        </EmptyState>
      ) : (
        <div className="dt-wrap">
          <table className="dt">
            <thead>
              <tr>
                <SortTh label="Status" field="status" {...sortProps} />
                <SortTh label="Name" field="name" {...sortProps} />
                <SortTh label="Ort" field="ort" {...sortProps} />
                <th>Leistung</th>
                <SortTh label="Eingang" field="eingang" {...sortProps} />
                <th>Bearbeiter</th>
                <SortTh label="Nächste Aktion" field="aktion" {...sortProps} />
                <th aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {list.rows.map((l) => (
                <tr key={l.id}>
                  <td data-slot="badge"><StatusPill kind="lead" status={l.status} label={LEAD_LABELS[l.status]} /></td>
                  <td data-slot="title">
                    <Link href={`/admin/anfragen/${l.id}/`} className="primary stretch">{l.name}</Link>
                    <span className="secondary">{[l.phone, l.email].filter(Boolean).join(' · ') || '–'}</span>
                    {l.notificationStatus === 'FAILED' && <span className="adm-badge adm-badge-warn" style={{ marginTop: 4 }}>Mail fehlgeschlagen</span>}
                  </td>
                  <td data-slot="sub">{l.location ?? <span className="t-3">–</span>}</td>
                  <td data-slot="sub">{l.reason}<span className="secondary">{l.vehicleKind}{l.licensePlate ? ` · ${l.licensePlate}` : ''}{l.inquiry?._count.attachments ? ` · ${l.inquiry._count.attachments} Fotos` : ''}</span></td>
                  <td data-slot="meta" className="nowrap t-2">{fmtWhen(l.createdAt)}</td>
                  <td data-slot="hide">{l.assignedTo ? `${l.assignedTo.firstName} ${l.assignedTo.lastName}` : <span className="t-3">–</span>}</td>
                  <td data-slot="hide" className="nowrap">{l.nextActionAt ? fmtWhen(l.nextActionAt) : <span className="t-3">–</span>}</td>
                  <td data-slot="hide" className="menu-cell">
                    <Menu
                      label={`Aktionen für ${l.name}`}
                      trigger={<AdminIcon name="more" />}
                      triggerClassName="adm-btn adm-btn-quiet adm-btn-icon adm-btn-sm"
                      entries={[
                        { kind: 'link', label: 'Öffnen', href: `/admin/anfragen/${l.id}/`, icon: 'external' },
                        ...(phoneHref(l.phone) ? [{ kind: 'link' as const, label: 'Anrufen', href: phoneHref(l.phone)!, icon: 'phone' as const }] : []),
                        ...(l.email ? [{ kind: 'link' as const, label: 'E-Mail schreiben', href: `mailto:${l.email}`, icon: 'mail' as const }] : []),
                      ]}
                    />
                    <span className="sr-only-adm">{shortRef(l.id, 'ANF')}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination total={list.total} page={list.page} pageSize={PAGE_SIZE} basePath={base} params={params} noun="Anfragen" />
    </>
  );
}
