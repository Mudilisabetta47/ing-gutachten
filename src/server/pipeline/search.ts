import 'server-only';
import type { AuthUser } from '@/server/auth/session-types';
import { ForbiddenError } from '@/server/auth/errors';
import { CASE_LABELS, LEAD_LABELS, type CaseStatusKey, type LeadStatusKey } from '@/lib/workflow';
import { db } from '@/server/db';
import { caseScope, customerScope, has, vehicleScope } from './access';
import { listCases } from './cases';
import { listCustomers } from './customers';
import { listLeads } from './leads';
import { listVehicles } from './vehicles';

export type SearchHit = { id: string; label: string; sub: string; href: string };
export type SearchResult = { query: string; cases: SearchHit[]; customers: SearchHit[]; vehicles: SearchHit[]; leads: SearchHit[]; invoices: SearchHit[]; reports: SearchHit[]; tasks: SearchHit[] };

const LIMIT = 5;
const who = (c: { firstName: string; lastName: string; company: string | null }) => c.company || `${c.firstName} ${c.lastName}`.trim();

/**
 * Globale Suche (⌘K): Fallnummer, Kunde, Telefon, E-Mail, Kennzeichen, FIN, Schadennummer.
 * Nutzt dieselben Listenabfragen wie die Seiten – damit gelten exakt dieselben Zugriffsregeln
 * (Experten: nur eigene Fälle; Buchhaltung: keine Fahrzeuge/Anfragen; Website-Rolle: nichts).
 */
export async function globalSearch(user: AuthUser, raw: string): Promise<SearchResult> {
  if (!has(user, 'search.global')) throw new ForbiddenError();
  const q = raw.trim().slice(0, 80);
  const empty: SearchResult = { query: q, cases: [], customers: [], vehicles: [], leads: [], invoices: [], reports: [], tasks: [] };
  if (q.length < 2) return empty;

  const ci = { contains: q, mode: 'insensitive' as const };
  const reportScope = has(user, 'reports.read.all') ? {} : has(user, 'reports.read.own') ? { case: { assignedExpertId: user.id } } : null;
  const taskScope = has(user, 'tasks.read.all') ? {} : has(user, 'tasks.read.own') ? { OR: [{ assigneeId: user.id }, { createdById: user.id }] } : null;
  const [cases, customers, vehicles, leads, invoices, reports, tasks] = await Promise.all([
    caseScope(user, 'read') ? listCases(user, { q, limit: LIMIT }) : null,
    customerScope(user) ? listCustomers(user, { q, limit: LIMIT }) : null,
    vehicleScope(user) ? listVehicles(user, { q, limit: LIMIT }) : null,
    has(user, 'leads.read') ? listLeads(user, { q, limit: LIMIT }) : null,
    has(user, 'invoices.read') ? db.invoice.findMany({ where: { status: { not: 'DRAFT' }, OR: [{ number: ci }, { recipientName: ci }] }, orderBy: { createdAt: 'desc' }, take: LIMIT, select: { id: true, number: true, recipientName: true, grossCents: true, case: { select: { caseNumber: true } } } }) : null,
    reportScope ? db.report.findMany({ where: { AND: [reportScope, { case: { deletedAt: null } }, { OR: [{ number: ci }, { case: { caseNumber: ci } }] }] }, orderBy: { createdAt: 'desc' }, take: LIMIT, select: { id: true, number: true, status: true, case: { select: { caseNumber: true } } } }) : null,
    taskScope ? db.task.findMany({ where: { AND: [taskScope, { status: 'OPEN' }, { title: ci }] }, orderBy: { dueDate: 'asc' }, take: LIMIT, select: { id: true, title: true, dueDate: true, case: { select: { caseNumber: true } } } }) : null,
  ]);

  return {
    query: q,
    cases: (cases?.rows ?? []).map((c) => ({
      id: c.id, label: c.caseNumber, href: `/admin/faelle/${c.caseNumber}/`,
      sub: `${who(c.customer)} · ${c.vehicle.licensePlate ?? c.vehicle.model} · ${CASE_LABELS[c.status as CaseStatusKey]}`,
    })),
    customers: (customers?.rows ?? []).map((c) => ({ id: c.id, label: who(c), href: `/admin/kunden/${c.id}/`, sub: [c.email, c.phone, c.city].filter(Boolean).join(' · ') || '–' })),
    vehicles: (vehicles?.rows ?? []).map((v) => ({ id: v.id, label: v.licensePlate ?? `${v.manufacturer} ${v.model}`, href: `/admin/fahrzeuge/${v.id}/`, sub: `${v.manufacturer} ${v.model} · ${who(v.customer)}` })),
    invoices: (invoices ?? []).map((i) => ({ id: i.id, label: i.number ?? 'Rechnung', href: i.case ? `/admin/faelle/${i.case.caseNumber}/?tab=rechnung&rechnung=${i.id}` : '/admin/rechnungen/', sub: `${i.recipientName} · ${(i.grossCents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}` })),
    reports: (reports ?? []).map((r) => ({ id: r.id, label: r.number, href: `/admin/faelle/${r.case.caseNumber}/?tab=gutachten&bericht=${r.id}`, sub: `Gutachten · ${r.case.caseNumber}` })),
    tasks: (tasks ?? []).map((t) => ({ id: t.id, label: t.title, href: t.case ? `/admin/faelle/${t.case.caseNumber}/?tab=aufgaben` : '/admin/aufgaben/', sub: `Aufgabe${t.dueDate ? ` · fällig ${t.dueDate.toISOString().slice(0, 10).split('-').reverse().join('.')}` : ''}${t.case ? ` · ${t.case.caseNumber}` : ''}` })),
    leads: (leads?.rows ?? []).map((l) => ({ id: l.id, label: l.name, href: `/admin/anfragen/${l.id}/`, sub: `${LEAD_LABELS[l.status as LeadStatusKey]} · ${l.reason}${l.phone ? ` · ${l.phone}` : ''}` })),
  };
}
