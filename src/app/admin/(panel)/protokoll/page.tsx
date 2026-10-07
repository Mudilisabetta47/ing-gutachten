import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { requirePagePermission, can } from '@/server/auth/guards';
import { AutoForm } from '@/components/admin/AutoForm';
import { EmptyState, FilterChips, PageHeader, Pagination, fmtWhen, hrefWith, type Chip } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Protokoll' };

const GROUPS = [
  ['auth.', 'Anmeldung'], ['user.', 'Benutzer'], ['settings.', 'Einstellungen'],
  ['lead.', 'Anfragen'], ['appointment.', 'Termine'], ['photo.', 'Fotos'], ['document.', 'Dokumente'], ['damage.', 'Schäden'], ['inspection.', 'Besichtigung'], ['media.', 'Dateiabrufe'], ['customer.', 'Kunden'], ['vehicle.', 'Fahrzeuge'], ['case.', 'Fälle'], ['note.', 'Notizen'],
] as const;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ gruppe?: string; von?: string; bis?: string; seite?: string }> }) {
  const user = await requirePagePermission('audit.read', 'audit.read.own');
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.seite) || 1);
  const pageSize = 50;
  const group = GROUPS.find(([p]) => p === sp.gruppe)?.[0];
  const from = sp.von && !Number.isNaN(Date.parse(sp.von)) ? new Date(sp.von) : undefined;
  const to = sp.bis && !Number.isNaN(Date.parse(sp.bis)) ? new Date(new Date(sp.bis).getTime() + 86400_000) : undefined;

  const where: Prisma.AuditLogWhereInput = {
    ...(can(user, 'audit.read') ? {} : { actorId: user.id }), // ohne Gesamtrecht nur die eigenen Einträge
    ...(group ? { action: { startsWith: group } } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {}),
  };
  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { actor: { select: { firstName: true, lastName: true } } } }),
  ]);
  const base = '/admin/protokoll';
  const params = { gruppe: group, von: sp.von, bis: sp.bis };
  const chips: Chip[] = [
    group && { label: 'Bereich', value: GROUPS.find(([p]) => p === group)![1], href: hrefWith(base, { ...params, gruppe: undefined }) },
    sp.von && { label: 'Von', value: sp.von, href: hrefWith(base, { ...params, von: undefined }) },
    sp.bis && { label: 'Bis', value: sp.bis, href: hrefWith(base, { ...params, bis: undefined }) },
  ].filter(Boolean) as Chip[];

  return (
    <>
      <PageHeader title="Protokoll" intro="Wer hat wann was geändert. Einträge sind unveränderlich; Geheimnisse (Passwörter, Tokens) werden nie gespeichert." />
      <AutoForm action={base}>
        <select name="gruppe" defaultValue={group ?? ''} className="adm-input" aria-label="Bereich">
          <option value="">Alle Bereiche</option>
          {GROUPS.map(([p, l]) => <option key={p} value={p}>{l}</option>)}
        </select>
        <label className="adm-check">Von <input type="date" name="von" defaultValue={sp.von} className="adm-input" style={{ width: 'auto' }} /></label>
        <label className="adm-check">Bis <input type="date" name="bis" defaultValue={sp.bis} className="adm-input" style={{ width: 'auto' }} /></label>
      </AutoForm>
      <FilterChips chips={chips} clearHref={base} />

      {rows.length === 0 ? (
        <EmptyState icon="log" title="Keine Einträge" action={chips.length ? <Link href={base} className="adm-btn adm-btn-secondary">Filter zurücksetzen</Link> : undefined}>Für diese Auswahl gibt es keine Protokolleinträge.</EmptyState>
      ) : (
        <div className="dt-wrap">
          <table className="dt">
            <thead><tr><th>Zeit</th><th>Wer</th><th>Aktion</th><th>Objekt</th><th>Details</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td data-slot="meta" className="nowrap t-2">{fmtWhen(r.createdAt)}</td>
                  <td data-slot="title">{r.actor ? `${r.actor.firstName} ${r.actor.lastName}` : <span className="t-3">System</span>}</td>
                  <td data-slot="sub"><code className="mono" style={{ fontSize: 12 }}>{r.action}</code></td>
                  <td data-slot="hide" className="t-2">{r.entityType}</td>
                  <td data-slot="meta" style={{ maxWidth: 420 }}>
                    {r.summary ? <span className="t-2">{r.summary}</span> : null}
                    {r.before || r.after ? (
                      <details style={{ marginTop: 4 }}>
                        <summary className="t-3" style={{ cursor: 'pointer', fontSize: 12 }}>Vorher / Nachher</summary>
                        <pre className="mono" style={{ margin: '4px 0 0', maxHeight: 192, overflow: 'auto', padding: 8, borderRadius: 8, background: 'rgb(var(--a-s2))', fontSize: 11 }}>{JSON.stringify({ vorher: r.before, nachher: r.after }, null, 2)}</pre>
                      </details>
                    ) : null}
                    {r.ip ? <span className="mono t-3" style={{ marginLeft: 8, fontSize: 11 }}>{r.ip}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination total={total} page={page} pageSize={pageSize} basePath={base} params={params} noun="Einträge" />
    </>
  );
}
