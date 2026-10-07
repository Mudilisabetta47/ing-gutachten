import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { requirePagePermission, can } from '@/server/auth/guards';
import { PageHeader, Pagination, fmtDateTime } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Protokoll' };

const GROUPS = [
  ['auth.', 'Anmeldung'],
  ['user.', 'Benutzer'],
  ['settings.', 'Einstellungen'],
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
    db.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, include: { actor: { select: { firstName: true, lastName: true, email: true } } } }),
  ]);

  return (
    <>
      <PageHeader title="Protokoll" intro="Wer hat wann was geändert. Einträge sind unveränderlich; Geheimnisse (Passwörter, Tokens) werden nie gespeichert." />
      <form className="mb-4 flex flex-wrap items-end gap-2" role="search">
        <label className="grid gap-0.5">
          <span className="adm-label">Bereich</span>
          <select name="gruppe" defaultValue={group ?? ''} className="adm-input !w-auto">
            <option value="">Alle</option>
            {GROUPS.map(([p, l]) => (
              <option key={p} value={p}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-0.5">
          <span className="adm-label">Von</span>
          <input type="date" name="von" defaultValue={sp.von} className="adm-input !w-auto" />
        </label>
        <label className="grid gap-0.5">
          <span className="adm-label">Bis</span>
          <input type="date" name="bis" defaultValue={sp.bis} className="adm-input !w-auto" />
        </label>
        <button type="submit" className="adm-btn adm-btn-ghost">
          Filtern
        </button>
      </form>

      <div className="adm-card overflow-hidden !p-0">
        <table className="adm-table adm-stack">
          <thead>
            <tr>
              <th>Zeit</th>
              <th>Wer</th>
              <th>Aktion</th>
              <th>Objekt</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-fg-mute">
                  Keine Einträge.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td data-label="Zeit" className="whitespace-nowrap font-mono text-[.76rem] text-fg-mute">
                  {fmtDateTime(r.createdAt)}
                </td>
                <td data-label="Wer">{r.actor ? `${r.actor.firstName} ${r.actor.lastName}` : <span className="text-fg-mute">System / unbekannt</span>}</td>
                <td data-label="Aktion">
                  <code className="font-mono text-[.8rem]">{r.action}</code>
                </td>
                <td data-label="Objekt" className="text-fg-dim">
                  {r.entityType}
                </td>
                <td data-label="Details" className="max-w-[420px]">
                  {r.summary ? <span className="text-fg-dim">{r.summary}</span> : null}
                  {r.before || r.after ? (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-[.78rem] text-fg-mute">Vorher / Nachher</summary>
                      <pre className="mt-1 max-h-48 overflow-auto rounded-[8px] bg-ink-900 p-2 font-mono text-[.7rem] text-fg-dim">{JSON.stringify({ vorher: r.before, nachher: r.after }, null, 2)}</pre>
                    </details>
                  ) : null}
                  {r.ip ? <span className="ml-2 font-mono text-[.66rem] text-fg-mute">{r.ip}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination total={total} page={page} pageSize={pageSize} basePath="/admin/protokoll" params={{ gruppe: group, von: sp.von, bis: sp.bis }} />
    </>
  );
}
