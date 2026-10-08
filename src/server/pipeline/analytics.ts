import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import type { AuthUser } from '@/server/auth/session-types';
import { ForbiddenError } from '@/server/auth/errors';
import { csvCell, deDate } from '@/lib/invoice';
import { has, caseScope } from './access';

const MONTH_MS = 31 * 86_400_000;
const monthKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit' }).format(d).slice(0, 7);
function lastMonths(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15))));
  return out;
}

/**
 * Auswertungen – ausschließlich aus vorhandenen Datensätzen, im Sichtbereich des Benutzers:
 * `kpi.all` alle Fälle, `kpi.own` nur eigene, `kpi.revenue` die Umsatzzahlen.
 */
export async function analytics(user: AuthUser) {
  const all = has(user, 'kpi.all'), own = has(user, 'kpi.own'), revenue = all || has(user, 'kpi.revenue');
  if (!all && !own && !revenue) throw new ForbiddenError();
  const months = lastMonths(12);
  const since = new Date(Date.now() - 13 * MONTH_MS);
  const scope: Prisma.CaseWhereInput | null = all ? {} : own ? { assignedExpertId: user.id } : null;

  let cases: { byStatus: { status: string; count: number }[]; created: { month: string; count: number }[]; avgDaysToClose: number | null; closedCount: number; byExpert: { name: string; open: number; closed: number }[] } | null = null;
  if (scope) {
    const base: Prisma.CaseWhereInput = { AND: [scope, { deletedAt: null }] };
    const [grouped, createdRows, closedRows, experts] = await Promise.all([
      db.case.groupBy({ by: ['status'], where: base, _count: { _all: true } }),
      db.case.findMany({ where: { AND: [base, { createdAt: { gte: since } }] }, select: { createdAt: true }, take: 10_000 }),
      db.caseStatusHistory.findMany({ where: { toStatus: 'CLOSED', case: { AND: [base, { status: 'CLOSED' }] } }, orderBy: { createdAt: 'asc' }, select: { caseId: true, createdAt: true, case: { select: { createdAt: true } } }, take: 10_000 }),
      all ? db.case.groupBy({ by: ['assignedExpertId', 'status'], where: { AND: [base, { assignedExpertId: { not: null } }] }, _count: { _all: true } }) : Promise.resolve([]),
    ]);
    const bucket = new Map<string, number>(months.map((m) => [m, 0]));
    for (const r of createdRows) { const k = monthKey(r.createdAt); if (bucket.has(k)) bucket.set(k, (bucket.get(k) ?? 0) + 1); }
    // je Fall zählt nur der letzte Abschluss (Fälle können wieder geöffnet und erneut geschlossen werden)
    const lastClose = new Map(closedRows.map((r) => [r.caseId, r]));
    const durations = [...lastClose.values()].map((r) => (r.createdAt.getTime() - r.case.createdAt.getTime()) / 86_400_000).filter((d) => d >= 0);
    const names = experts.length ? await db.user.findMany({ where: { id: { in: [...new Set(experts.map((e) => e.assignedExpertId!))] } }, select: { id: true, firstName: true, lastName: true } }) : [];
    const per = new Map<string, { name: string; open: number; closed: number }>();
    for (const e of experts) {
      const u = names.find((n) => n.id === e.assignedExpertId);
      const row = per.get(e.assignedExpertId!) ?? { name: u ? `${u.firstName} ${u.lastName}` : 'Unbekannt', open: 0, closed: 0 };
      if (e.status === 'CLOSED') row.closed += e._count._all; else if (e.status !== 'CANCELLED') row.open += e._count._all;
      per.set(e.assignedExpertId!, row);
    }
    cases = {
      byStatus: grouped.map((g) => ({ status: g.status as string, count: g._count._all })),
      created: months.map((month) => ({ month, count: bucket.get(month) ?? 0 })),
      avgDaysToClose: durations.length ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : null,
      closedCount: durations.length,
      byExpert: [...per.values()].sort((a, b) => b.open - a.open),
    };
  }

  let money: { net: { month: string; cents: number }[]; paid: { month: string; cents: number }[]; openCents: number; overdueCents: number; averageNetCents: number | null; issuedCount: number } | null = null;
  if (revenue) {
    const today = new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())}T00:00:00Z`);
    const [inv, pays, issuedAll] = await Promise.all([
      db.invoice.findMany({ where: { status: 'ISSUED', issueDate: { gte: since } }, select: { issueDate: true, netCents: true }, take: 10_000 }),
      db.payment.findMany({ where: { reversedAt: null, paidOn: { gte: since } }, select: { paidOn: true, amountCents: true }, take: 10_000 }),
      db.invoice.findMany({ where: { status: 'ISSUED' }, select: { grossCents: true, netCents: true, dueDate: true, payments: { where: { reversedAt: null }, select: { amountCents: true } } }, take: 20_000 }),
    ]);
    const sum = (rows: { d: Date | null; c: number }[]) => { const m = new Map<string, number>(months.map((k) => [k, 0])); for (const r of rows) if (r.d) { const k = monthKey(r.d); if (m.has(k)) m.set(k, (m.get(k) ?? 0) + r.c); } return months.map((month) => ({ month, cents: m.get(month) ?? 0 })); };
    let open = 0, overdue = 0;
    for (const i of issuedAll) { const o = Math.max(0, i.grossCents - i.payments.reduce((n, p) => n + p.amountCents, 0)); open += o; if (o > 0 && i.dueDate && i.dueDate < today) overdue += o; }
    money = {
      net: sum(inv.map((i) => ({ d: i.issueDate, c: i.netCents }))), paid: sum(pays.map((p) => ({ d: p.paidOn, c: p.amountCents }))),
      openCents: open, overdueCents: overdue, issuedCount: issuedAll.length,
      averageNetCents: issuedAll.length ? Math.round(issuedAll.reduce((n, i) => n + i.netCents, 0) / issuedAll.length) : null,
    };
  }

  let reports: { byStatus: { status: string; count: number }[]; avgDaysToApproval: number | null } | null = null;
  if (scope && (has(user, 'reports.read.all') || has(user, 'reports.read.own'))) {
    const rs = await db.report.findMany({ where: { case: { AND: [scope, { deletedAt: null }] } }, select: { status: true, createdAt: true, approvedAt: true }, take: 10_000 });
    const by = new Map<string, number>();
    for (const r of rs) by.set(r.status, (by.get(r.status) ?? 0) + 1);
    const d = rs.filter((r) => r.approvedAt).map((r) => (r.approvedAt!.getTime() - r.createdAt.getTime()) / 86_400_000);
    reports = { byStatus: [...by.entries()].map(([status, count]) => ({ status, count })), avgDaysToApproval: d.length ? Math.round((d.reduce((a, b) => a + b, 0) / d.length) * 10) / 10 : null };
  }
  return { cases, money, reports, scopeLabel: all ? 'Alle Fälle' : own ? 'Ihre Fälle' : 'Nur Umsatz' };
}

/* ------------------------------------------------------------ Datenexporte (CSV) */

export const EXPORT_KINDS = { faelle: 'Fälle', kunden: 'Kunden' } as const;
export type ExportKind = keyof typeof EXPORT_KINDS;

/** CSV (Semikolon, UTF-8 mit BOM, Formeln neutralisiert); jeder Export wird im Protokoll vermerkt. */
export async function exportCsv(user: AuthUser, kind: ExportKind): Promise<string> {
  if (!has(user, 'data.export')) throw new ForbiddenError();
  let head: string[], lines: string[][];
  if (kind === 'faelle') {
    const scope = caseScope(user, 'read');
    if (!scope) throw new ForbiddenError();
    const rows = await db.case.findMany({ where: { AND: [scope, { deletedAt: null }] }, orderBy: { createdAt: 'desc' }, take: 20_000, include: { customer: { select: { firstName: true, lastName: true, company: true } }, vehicle: { select: { manufacturer: true, model: true, licensePlate: true } }, assignedExpert: { select: { firstName: true, lastName: true } } } });
    head = ['Fallnummer', 'Status', 'Angelegt', 'Kunde', 'Fahrzeug', 'Kennzeichen', 'Gutachter', 'Schadennummer'];
    lines = rows.map((r) => [r.caseNumber, r.status, deDate(r.createdAt.toISOString().slice(0, 10)), r.customer.company || `${r.customer.firstName} ${r.customer.lastName}`.trim(), `${r.vehicle.manufacturer} ${r.vehicle.model}`.trim(), r.vehicle.licensePlate ?? '', r.assignedExpert ? `${r.assignedExpert.firstName} ${r.assignedExpert.lastName}` : '', r.insuranceClaimNumber ?? '']);
  } else {
    if (!has(user, 'customers.read')) throw new ForbiddenError();
    const rows = await db.customer.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 20_000 });
    head = ['Name', 'Firma', 'E-Mail', 'Telefon', 'Straße', 'PLZ', 'Ort', 'Angelegt'];
    lines = rows.map((r) => [`${r.firstName} ${r.lastName}`.trim(), r.company ?? '', r.email ?? '', r.phone ?? '', r.street ?? '', r.postalCode ?? '', r.city ?? '', deDate(r.createdAt.toISOString().slice(0, 10))]);
  }
  await writeAudit({ actorId: user.id, action: 'data.export', entityType: 'Export', entityId: kind, summary: `Export ${EXPORT_KINDS[kind]} (${lines.length} Zeilen)` });
  return `﻿${[head.join(';'), ...lines.map((l) => l.map(csvCell).join(';'))].join('\r\n')}\r\n`;
}

export async function archiveOverview(user: AuthUser) {
  if (!has(user, 'cases.delete') && !has(user, 'data.export')) throw new ForbiddenError();
  const [archivedCases, archivedCustomers] = await Promise.all([db.case.count({ where: { deletedAt: { not: null } } }), db.customer.count({ where: { deletedAt: { not: null } } })]);
  return { archivedCases, archivedCustomers };
}
