import 'server-only';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import type { AuthUser } from '@/server/auth/session-types';
import { ForbiddenError } from '@/server/auth/errors';
import { DomainError, notFoundError } from '@/server/errors';
import { getSetting } from '@/server/settings';
import { fmtEuro } from '@/lib/money';
import { DUNNING_LABELS, addDays, csvCell, deDate, invoiceState, invoiceTotals, itemNet, nextDunningLevel, openCents, type InvoiceState } from '@/lib/invoice';
import { ReportPdf, pdfSafe } from '@/server/reports/pdf';
import { has } from './access';
import { systemCaseStatus } from './cases';

const berlinToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const dateOf = (s: string) => new Date(`${s}T00:00:00Z`);

function need(user: AuthUser, p: 'invoices.read' | 'invoices.write' | 'payments.write' | 'dunning.write' | 'invoices.export') {
  if (!has(user, p)) throw new ForbiddenError();
}

/* ------------------------------------------------------------ Lesen */

const invoiceInclude = { items: { orderBy: { position: 'asc' } }, payments: { orderBy: { createdAt: 'asc' } }, dunnings: { orderBy: { level: 'asc' } }, case: { select: { caseNumber: true, insuranceClaimNumber: true } } } satisfies Prisma.InvoiceInclude;
type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

export type InvoiceDto = ReturnType<typeof toDto>;
function toDto(r: InvoiceRow) {
  const items = r.items.map((i) => ({ id: i.id, position: i.position, description: i.description, quantityX100: i.quantityX100, unit: i.unit, unitPriceCents: i.unitPriceCents, vatBp: i.vatBp, serviceId: i.serviceId, netCents: itemNet(i) }));
  const totals = r.status === 'DRAFT' ? invoiceTotals(items) : { netCents: r.netCents, vatCents: r.vatCents, grossCents: r.grossCents, groups: invoiceTotals(items).groups };
  const paid = r.payments.filter((p) => !p.reversedAt).reduce((n, p) => n + p.amountCents, 0);
  const state: InvoiceState = invoiceState({ status: r.status, grossCents: totals.grossCents, paidCents: paid, dueDate: ymd(r.dueDate) }, berlinToday());
  return {
    id: r.id, caseId: r.caseId, caseNumber: r.case?.caseNumber ?? null, customerId: r.customerId, number: r.number, status: r.status, state,
    recipient: { name: r.recipientName, street: r.recipientStreet, postalCode: r.recipientPostalCode, city: r.recipientCity, orgId: r.recipientOrgId, ref: r.recipientRef },
    serviceDate: ymd(r.serviceDate), issueDate: ymd(r.issueDate), dueDate: ymd(r.dueDate), paymentTermsDays: r.paymentTermsDays, introText: r.introText, footerText: r.footerText,
    items, totals, paidCents: paid, openCents: openCents({ grossCents: totals.grossCents, paidCents: paid }),
    payments: r.payments.map((p) => ({ id: p.id, amountCents: p.amountCents, paidOn: ymd(p.paidOn)!, method: p.method, reference: p.reference, note: p.note, createdAt: p.createdAt, reversed: Boolean(p.reversedAt), reverseReason: p.reverseReason })),
    dunnings: r.dunnings.map((d) => ({ id: d.id, level: d.level, status: d.status, issueDate: ymd(d.issueDate), dueDate: ymd(d.dueDate), feeCents: d.feeCents, interestCents: d.interestCents, text: d.text })),
    cancelReason: r.cancelReason, cancelledAt: r.cancelledAt, issuedAt: r.issuedAt, createdAt: r.createdAt, updatedAt: r.updatedAt,
  };
}

export async function getInvoice(user: AuthUser, id: string) {
  need(user, 'invoices.read');
  const r = await db.invoice.findUnique({ where: { id }, include: invoiceInclude });
  if (!r) throw notFoundError('Rechnung');
  return toDto(r);
}

export async function caseInvoices(user: AuthUser, caseId: string) {
  need(user, 'invoices.read');
  const rows = await db.invoice.findMany({ where: { caseId }, orderBy: { createdAt: 'asc' }, include: invoiceInclude });
  return rows.map(toDto);
}

export type InvoiceListQuery = { status?: string; q?: string; page?: number; limit?: number; from?: string; to?: string };
export async function listInvoices(user: AuthUser, query: InvoiceListQuery = {}) {
  need(user, 'invoices.read');
  const page = Math.max(1, query.page ?? 1), size = Math.min(query.limit ?? 25, 200);
  const today = dateOf(berlinToday());
  const where: Prisma.InvoiceWhereInput = {
    ...(query.status === 'DRAFT' ? { status: 'DRAFT' } : query.status === 'CANCELLED' ? { status: 'CANCELLED' } : query.status === 'OVERDUE' ? { status: 'ISSUED', dueDate: { lt: today } } : query.status === 'ISSUED' ? { status: 'ISSUED' } : {}),
    ...(query.q?.trim() ? { OR: [{ number: { contains: query.q.trim(), mode: 'insensitive' } }, { recipientName: { contains: query.q.trim(), mode: 'insensitive' } }, { case: { caseNumber: { contains: query.q.trim(), mode: 'insensitive' } } }] } : {}),
    ...(query.from || query.to ? { issueDate: { ...(query.from ? { gte: dateOf(query.from) } : {}), ...(query.to ? { lte: dateOf(query.to) } : {}) } } : {}),
  };
  const [rows, total] = await Promise.all([
    db.invoice.findMany({ where, orderBy: [{ createdAt: 'desc' }], skip: (page - 1) * size, take: size, include: invoiceInclude }),
    db.invoice.count({ where }),
  ]);
  let dtos = rows.map(toDto);
  if (query.status === 'OVERDUE') dtos = dtos.filter((d) => d.state === 'OVERDUE');
  return { rows: dtos, total, page, pageSize: size };
}

export async function financeStats(user: AuthUser) {
  need(user, 'invoices.read');
  const today = dateOf(berlinToday());
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const issued = await db.invoice.findMany({ where: { status: 'ISSUED' }, select: { grossCents: true, netCents: true, dueDate: true, issueDate: true, payments: { where: { reversedAt: null }, select: { amountCents: true } } } });
  let open = 0, overdue = 0, overdueCount = 0, openCount = 0, revenueMonth = 0;
  for (const i of issued) {
    const paid = i.payments.reduce((n, p) => n + p.amountCents, 0);
    const o = Math.max(0, i.grossCents - paid);
    if (o > 0) { open += o; openCount++; if (i.dueDate && i.dueDate < today) { overdue += o; overdueCount++; } }
    if (i.issueDate && i.issueDate >= monthStart) revenueMonth += i.netCents;
  }
  const paidMonth = await db.payment.aggregate({ where: { reversedAt: null, paidOn: { gte: monthStart } }, _sum: { amountCents: true } });
  const drafts = await db.invoice.count({ where: { status: 'DRAFT' } });
  return { open, openCount, overdue, overdueCount, revenueMonth, paidMonth: paidMonth._sum.amountCents ?? 0, drafts };
}

export async function listPayments(user: AuthUser, query: { page?: number; q?: string } = {}) {
  need(user, 'invoices.read');
  const page = Math.max(1, query.page ?? 1);
  const where: Prisma.PaymentWhereInput = query.q?.trim() ? { OR: [{ reference: { contains: query.q.trim(), mode: 'insensitive' } }, { invoice: { number: { contains: query.q.trim(), mode: 'insensitive' } } }, { invoice: { recipientName: { contains: query.q.trim(), mode: 'insensitive' } } }] } : {};
  const [rows, total] = await Promise.all([
    db.payment.findMany({ where, orderBy: [{ paidOn: 'desc' }, { createdAt: 'desc' }], skip: (page - 1) * 25, take: 25, include: { invoice: { select: { id: true, number: true, recipientName: true, case: { select: { caseNumber: true } } } } } }),
    db.payment.count({ where }),
  ]);
  return { rows: rows.map((p) => ({ id: p.id, amountCents: p.amountCents, paidOn: ymd(p.paidOn)!, method: p.method, reference: p.reference, reversed: Boolean(p.reversedAt), invoiceId: p.invoice.id, invoiceNumber: p.invoice.number, recipient: p.invoice.recipientName, caseNumber: p.invoice.case?.caseNumber ?? null })), total, page, pageSize: 25 };
}

/** Überfällige, noch offene Rechnungen mit der nächsten möglichen Mahnstufe. */
export async function dunningOverview(user: AuthUser) {
  need(user, 'invoices.read');
  const rows = await db.invoice.findMany({ where: { status: 'ISSUED', dueDate: { lt: dateOf(berlinToday()) } }, orderBy: { dueDate: 'asc' }, include: invoiceInclude });
  return rows.map(toDto).filter((d) => d.state === 'OVERDUE' || d.state === 'PARTIAL').filter((d) => d.openCents > 0 && d.dueDate && d.dueDate < berlinToday()).map((d) => ({ ...d, nextLevel: nextDunningLevel(d.dunnings), daysOverdue: Math.round((Date.parse(berlinToday()) - Date.parse(d.dueDate!)) / 86_400_000) }));
}

/* ------------------------------------------------------------ Entwurf anlegen/speichern */

const itemSchema = z.object({
  description: z.string().trim().min(1, 'Bitte jede Position bezeichnen.').max(300),
  quantityX100: z.number().int().min(1, 'Menge muss größer 0 sein.').max(100_000_000),
  unit: z.string().trim().max(20).nullable().optional().transform((v) => v || null),
  unitPriceCents: z.number().int().min(-1_000_000_000).max(1_000_000_000),
  vatBp: z.number().int().min(0).max(3000),
  serviceId: z.string().trim().max(40).nullable().optional().transform((v) => v || null),
});
const draftSchema = z.object({
  recipient: z.object({
    name: z.string().trim().min(1, 'Bitte den Empfänger angeben.').max(160),
    street: z.string().trim().max(160).nullable().optional().transform((v) => v || null),
    postalCode: z.string().trim().max(10).nullable().optional().transform((v) => v || null),
    city: z.string().trim().max(120).nullable().optional().transform((v) => v || null),
    ref: z.string().trim().max(120).nullable().optional().transform((v) => v || null),
    orgId: z.string().trim().max(40).nullable().optional().transform((v) => v || null),
  }),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal('')).transform((v) => v || null),
  paymentTermsDays: z.number().int().min(0).max(365).default(14),
  introText: z.string().trim().max(3000).nullable().optional().transform((v) => v || null),
  footerText: z.string().trim().max(3000).nullable().optional().transform((v) => v || null),
  items: z.array(itemSchema).max(100, 'Höchstens 100 Positionen.'),
});
export type DraftInput = z.input<typeof draftSchema>;

/** Vorschläge für den Rechnungsempfänger eines Falls (Kunde, Versicherung, Anwalt – aus den Stammdaten). */
export async function recipientOptions(user: AuthUser, caseId: string) {
  need(user, 'invoices.read');
  const c = await db.case.findUnique({ where: { id: caseId }, select: { insuranceClaimNumber: true, customer: true, insuranceOrg: true, lawyerOrg: true, workshopOrg: true } });
  if (!c) throw notFoundError('Fall');
  const cust = c.customer;
  const opts = [{ key: 'customer', label: `Kunde: ${cust.company || `${cust.firstName} ${cust.lastName}`.trim()}`, name: cust.company || `${cust.firstName} ${cust.lastName}`.trim(), street: cust.street, postalCode: cust.postalCode, city: cust.city, orgId: null as string | null, ref: c.insuranceClaimNumber }];
  for (const [k, o, l] of [['insurance', c.insuranceOrg, 'Versicherung'], ['lawyer', c.lawyerOrg, 'Rechtsanwalt']] as const) if (o) opts.push({ key: k, label: `${l}: ${o.name}`, name: o.name, street: o.street, postalCode: o.postalCode, city: o.city, orgId: o.id, ref: c.insuranceClaimNumber });
  return opts;
}

export async function createInvoice(user: AuthUser, args: { caseId?: string | null; customerId?: string; recipientKey?: string }) {
  need(user, 'invoices.write');
  return db.$transaction(async (tx) => {
    let customerId = args.customerId ?? null;
    let rcp: { name: string; street: string | null; postalCode: string | null; city: string | null; orgId: string | null; ref: string | null } | null = null;
    let serviceDate: Date | null = null;
    if (args.caseId) {
      const c = await tx.case.findFirst({ where: { id: args.caseId, deletedAt: null }, select: { customerId: true, insuranceClaimNumber: true, customer: true, insuranceOrg: true, lawyerOrg: true, appointments: { where: { kind: 'INSPECTION', status: 'DONE' }, orderBy: { startsAt: 'desc' }, take: 1, select: { startsAt: true } } } });
      if (!c) throw notFoundError('Fall');
      customerId = c.customerId;
      const cust = c.customer;
      const org = args.recipientKey === 'insurance' ? c.insuranceOrg : args.recipientKey === 'lawyer' ? c.lawyerOrg : null;
      rcp = org
        ? { name: org.name, street: org.street, postalCode: org.postalCode, city: org.city, orgId: org.id, ref: c.insuranceClaimNumber }
        : { name: cust.company || `${cust.firstName} ${cust.lastName}`.trim(), street: cust.street, postalCode: cust.postalCode, city: cust.city, orgId: null, ref: c.insuranceClaimNumber };
      const appt = c.appointments[0]?.startsAt;
      if (appt) serviceDate = dateOf(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(appt));
    } else {
      if (!customerId) throw new DomainError('Bitte einen Kunden angeben.');
      const cust = await tx.customer.findFirst({ where: { id: customerId, deletedAt: null } });
      if (!cust) throw notFoundError('Kunde');
      rcp = { name: cust.company || `${cust.firstName} ${cust.lastName}`.trim(), street: cust.street, postalCode: cust.postalCode, city: cust.city, orgId: null, ref: null };
    }
    const inv = await tx.invoice.create({
      data: { caseId: args.caseId ?? null, customerId: customerId!, createdById: user.id, recipientName: rcp.name, recipientStreet: rcp.street, recipientPostalCode: rcp.postalCode, recipientCity: rcp.city, recipientOrgId: rcp.orgId, recipientRef: rcp.ref, serviceDate },
    });
    await writeAudit({ actorId: user.id, action: 'invoice.create', entityType: 'Invoice', entityId: inv.id, summary: 'Rechnungsentwurf angelegt', after: { caseId: args.caseId ?? null } }, tx);
    return inv;
  });
}

export async function saveInvoice(user: AuthUser, id: string, raw: unknown) {
  need(user, 'invoices.write');
  const d = draftSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const cur = await tx.invoice.findUnique({ where: { id }, select: { status: true } });
    if (!cur) throw notFoundError('Rechnung');
    if (cur.status !== 'DRAFT') throw new DomainError('Ausgestellte Rechnungen können nicht mehr geändert werden. Bitte stornieren und neu ausstellen.', 'conflict');
    const t = invoiceTotals(d.items);
    await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
    await tx.invoiceItem.createMany({ data: d.items.map((i, n) => ({ invoiceId: id, position: n + 1, description: i.description, quantityX100: i.quantityX100, unit: i.unit, unitPriceCents: i.unitPriceCents, vatBp: i.vatBp, serviceId: i.serviceId })) });
    const u = await tx.invoice.update({
      where: { id },
      data: { recipientName: d.recipient.name, recipientStreet: d.recipient.street, recipientPostalCode: d.recipient.postalCode, recipientCity: d.recipient.city, recipientRef: d.recipient.ref, recipientOrgId: d.recipient.orgId, serviceDate: d.serviceDate ? dateOf(d.serviceDate) : null, paymentTermsDays: d.paymentTermsDays, introText: d.introText, footerText: d.footerText, netCents: t.netCents, vatCents: t.vatCents, grossCents: t.grossCents },
      include: invoiceInclude,
    });
    return toDto(u);
  });
}

export async function deleteDraft(user: AuthUser, id: string) {
  need(user, 'invoices.write');
  await db.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({ where: { id }, select: { status: true } });
    if (!inv) throw notFoundError('Rechnung');
    if (inv.status !== 'DRAFT') throw new DomainError('Nur Entwürfe können gelöscht werden.', 'conflict');
    await tx.invoice.delete({ where: { id } });
    await writeAudit({ actorId: user.id, action: 'invoice.draft_delete', entityType: 'Invoice', entityId: id, summary: 'Rechnungsentwurf gelöscht' }, tx);
  });
}

/* ------------------------------------------------------------ Ausstellen / Stornieren */

export function companyMissing(c: { name: string; street: string; postalCode: string; city: string; taxId: string }): string[] {
  const m: string[] = [];
  if (!c.name.trim()) m.push('Firmenname');
  if (!c.street.trim() || !c.postalCode.trim() || !c.city.trim()) m.push('Anschrift');
  if (!c.taxId.trim()) m.push('Steuernummer bzw. USt-IdNr.');
  return m;
}

/**
 * Stellt eine Rechnung aus: Pflichtangaben prüfen, lückenlose Nummer vergeben, Datum/Fälligkeit setzen, Beträge festschreiben.
 * Danach ist sie unveränderlich (auch per Datenbank-Trigger). Versendet wird nichts automatisch.
 */
export async function issueInvoice(user: AuthUser, id: string, opts: { issueDate?: string } = {}) {
  need(user, 'invoices.write');
  const company = await getSetting('company');
  const miss = companyMissing(company);
  if (miss.length) throw new DomainError(`Bitte zuerst unter Einstellungen → Unternehmen ergänzen: ${miss.join(', ')}. Diese Angaben sind Pflicht auf Rechnungen.`);
  return db.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({ where: { id }, include: { items: true } });
    if (!inv) throw notFoundError('Rechnung');
    if (inv.status !== 'DRAFT') throw new DomainError('Diese Rechnung ist bereits ausgestellt.', 'conflict');
    if (!inv.items.length) throw new DomainError('Eine Rechnung braucht mindestens eine Position.');
    if (!inv.recipientStreet || !inv.recipientPostalCode || !inv.recipientCity) throw new DomainError('Die Anschrift des Empfängers (Straße, PLZ, Ort) ist unvollständig.');
    const t = invoiceTotals(inv.items);
    if (t.grossCents <= 0) throw new DomainError('Der Rechnungsbetrag muss größer als 0 sein.');
    const issue = opts.issueDate ?? berlinToday();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issue)) throw new DomainError('Ungültiges Rechnungsdatum.');
    const { invoicePrefix, invoiceDigits } = await getSetting('numbering', tx);
    const year = Number(issue.slice(0, 4));
    const rows = await tx.$queryRaw<{ last_value: number }[]>`INSERT INTO invoice_counters (year, last_value, updated_at) VALUES (${year}, 1, now()) ON CONFLICT (year) DO UPDATE SET last_value = invoice_counters.last_value + 1, updated_at = now() RETURNING last_value`;
    const number = `${invoicePrefix}-${year}-${String(Number(rows[0].last_value)).padStart(invoiceDigits, '0')}`;
    const u = await tx.invoice.update({
      where: { id },
      data: { status: 'ISSUED', number, issueDate: dateOf(issue), dueDate: dateOf(addDays(issue, inv.paymentTermsDays)), issuedAt: new Date(), issuedById: user.id, netCents: t.netCents, vatCents: t.vatCents, grossCents: t.grossCents, serviceDate: inv.serviceDate ?? dateOf(issue) },
      include: invoiceInclude,
    });
    let moved = false;
    if (inv.caseId) moved = await systemCaseStatus(tx, user.id, inv.caseId, 'BILLING', `Rechnung ${number} ausgestellt`);
    await writeAudit({ actorId: user.id, action: 'invoice.issue', entityType: 'Invoice', entityId: id, summary: `Rechnung ${number} ausgestellt (${fmtEuro(t.grossCents)})`, after: { number, grossCents: t.grossCents, caseStatusMoved: moved } }, tx);
    return toDto(u);
  });
}

export async function cancelInvoice(user: AuthUser, id: string, reason: string) {
  need(user, 'invoices.write');
  if (!reason?.trim()) throw new DomainError('Bitte eine Begründung für die Stornierung angeben.');
  return db.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({ where: { id }, include: { payments: true } });
    if (!inv) throw notFoundError('Rechnung');
    if (inv.status !== 'ISSUED') throw new DomainError('Nur ausgestellte Rechnungen können storniert werden.', 'conflict');
    if (inv.payments.some((p) => !p.reversedAt)) throw new DomainError('Es gibt noch Zahlungen zu dieser Rechnung. Bitte diese zuerst stornieren.', 'conflict');
    await tx.dunningNotice.updateMany({ where: { invoiceId: id, status: { not: 'CANCELLED' } }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    await tx.invoice.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: user.id, cancelReason: reason.trim().slice(0, 500) } });
    await writeAudit({ actorId: user.id, action: 'invoice.cancel', entityType: 'Invoice', entityId: id, summary: `Rechnung ${inv.number} storniert`, after: { reason: reason.trim().slice(0, 200) } }, tx);
  });
}

/* ------------------------------------------------------------ Zahlungen */

const paySchema = z.object({
  amountCents: z.number().int().min(1, 'Bitte einen Betrag größer 0 angeben.').max(100_000_000_000),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Bitte das Zahlungsdatum angeben.'),
  method: z.enum(['BANK', 'CASH', 'CARD', 'OFFSET', 'OTHER']).default('BANK'),
  reference: z.string().trim().max(200).nullable().optional().transform((v) => v || null),
  note: z.string().trim().max(500).nullable().optional().transform((v) => v || null),
});
export const METHOD_LABELS: Record<string, string> = { BANK: 'Überweisung', CASH: 'Bar', CARD: 'Karte', OFFSET: 'Verrechnung', OTHER: 'Sonstiges' };

export async function addPayment(user: AuthUser, invoiceId: string, raw: unknown) {
  need(user, 'payments.write');
  const d = paySchema.parse(raw);
  if (d.paidOn > berlinToday()) throw new DomainError('Das Zahlungsdatum liegt in der Zukunft.');
  return db.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
    if (!inv) throw notFoundError('Rechnung');
    if (inv.status !== 'ISSUED') throw new DomainError('Zahlungen können nur zu ausgestellten Rechnungen erfasst werden.', 'conflict');
    const paid = inv.payments.filter((p) => !p.reversedAt).reduce((n, p) => n + p.amountCents, 0);
    const open = inv.grossCents - paid;
    if (d.amountCents > open) throw new DomainError(`Der Betrag übersteigt den offenen Betrag (${fmtEuro(open)}).`);
    const p = await tx.payment.create({ data: { invoiceId, amountCents: d.amountCents, paidOn: dateOf(d.paidOn), method: d.method, reference: d.reference, note: d.note, createdById: user.id } });
    let closed = false;
    if (d.amountCents === open && inv.caseId) closed = await systemCaseStatus(tx, user.id, inv.caseId, 'CLOSED', `Rechnung ${inv.number} vollständig bezahlt`);
    await writeAudit({ actorId: user.id, action: 'payment.add', entityType: 'Invoice', entityId: invoiceId, summary: `Zahlung ${fmtEuro(d.amountCents)} zu ${inv.number}`, after: { paymentId: p.id, amountCents: d.amountCents, method: d.method, caseClosed: closed } }, tx);
    return { payment: p, fullyPaid: d.amountCents === open, caseClosed: closed };
  });
}

export async function reversePayment(user: AuthUser, paymentId: string, reason: string) {
  need(user, 'payments.write');
  if (!reason?.trim()) throw new DomainError('Bitte eine Begründung angeben.');
  await db.$transaction(async (tx) => {
    const p = await tx.payment.findUnique({ where: { id: paymentId }, include: { invoice: { select: { number: true, caseId: true } } } });
    if (!p) throw notFoundError('Zahlung');
    if (p.reversedAt) throw new DomainError('Diese Zahlung ist bereits storniert.', 'conflict');
    await tx.payment.update({ where: { id: paymentId }, data: { reversedAt: new Date(), reversedById: user.id, reverseReason: reason.trim().slice(0, 500) } });
    // war der Fall wegen dieser Zahlung geschlossen, geht er zurück in die Abrechnung
    if (p.invoice.caseId) {
      const c = await tx.case.findUnique({ where: { id: p.invoice.caseId }, select: { status: true } });
      if (c?.status === 'CLOSED') await systemCaseStatus(tx, user.id, p.invoice.caseId, 'BILLING', `Zahlung zu ${p.invoice.number} storniert`);
    }
    await writeAudit({ actorId: user.id, action: 'payment.reverse', entityType: 'Invoice', entityId: p.invoiceId, summary: `Zahlung ${fmtEuro(p.amountCents)} zu ${p.invoice.number} storniert`, after: { paymentId, reason: reason.trim().slice(0, 200) } }, tx);
  });
}

/* ------------------------------------------------------------ Mahnwesen */

const dunSchema = z.object({
  feeCents: z.number().int().min(0).max(100_000_000).default(0),
  interestCents: z.number().int().min(0).max(100_000_000).default(0),
  text: z.string().trim().max(3000).nullable().optional().transform((v) => v || null),
  dueInDays: z.number().int().min(1).max(60).default(7),
});

export function defaultDunningText(level: number, inv: { number: string | null; issueDate: string | null; grossCents: number; openCents: number }, dueYmd: string): string {
  const intro = `zu unserer Rechnung ${inv.number} vom ${deDate(inv.issueDate)} über ${fmtEuro(inv.grossCents)} ist noch ein Betrag von ${fmtEuro(inv.openCents)} offen.`;
  if (level === 1) return `${intro}\n\nWir bitten Sie, den offenen Betrag bis zum ${deDate(dueYmd)} zu überweisen. Sollte sich Ihre Zahlung mit diesem Schreiben überschnitten haben, betrachten Sie es bitte als gegenstandslos.`;
  return `${intro}\n\nTrotz Fälligkeit ist der Betrag nicht bei uns eingegangen. Wir fordern Sie auf, den offenen Betrag bis zum ${deDate(dueYmd)} zu überweisen.`;
}

export async function createDunning(user: AuthUser, invoiceId: string, raw: unknown) {
  need(user, 'dunning.write');
  const d = dunSchema.parse(raw ?? {});
  return db.$transaction(async (tx) => {
    const r = await tx.invoice.findUnique({ where: { id: invoiceId }, include: invoiceInclude });
    if (!r) throw notFoundError('Rechnung');
    const inv = toDto(r);
    if (inv.status !== 'ISSUED' || inv.openCents <= 0) throw new DomainError('Mahnungen sind nur für offene, ausgestellte Rechnungen möglich.', 'conflict');
    if (!inv.dueDate || inv.dueDate >= berlinToday()) throw new DomainError('Die Rechnung ist noch nicht überfällig.');
    if (inv.dunnings.some((x) => x.status === 'DRAFT')) throw new DomainError('Es gibt bereits einen Mahnungsentwurf zu dieser Rechnung.', 'conflict');
    const level = nextDunningLevel(inv.dunnings);
    if (level == null) throw new DomainError('Die höchste Mahnstufe ist bereits erreicht.');
    const dueDate = addDays(berlinToday(), d.dueInDays);
    const n = await tx.dunningNotice.create({ data: { invoiceId, level, feeCents: d.feeCents, interestCents: d.interestCents, dueDate: dateOf(dueDate), text: d.text ?? defaultDunningText(level, { number: inv.number, issueDate: inv.issueDate, grossCents: inv.totals.grossCents, openCents: inv.openCents }, dueDate), createdById: user.id } });
    await writeAudit({ actorId: user.id, action: 'dunning.create', entityType: 'Invoice', entityId: invoiceId, summary: `${DUNNING_LABELS[level]} zu ${inv.number} angelegt`, after: { dunningId: n.id, level } }, tx);
    return n;
  });
}

export async function issueDunning(user: AuthUser, id: string) {
  need(user, 'dunning.write');
  await db.$transaction(async (tx) => {
    const n = await tx.dunningNotice.findUnique({ where: { id }, include: { invoice: { select: { number: true, status: true } } } });
    if (!n) throw notFoundError('Mahnung');
    if (n.status !== 'DRAFT') throw new DomainError('Diese Mahnung ist bereits ausgestellt oder storniert.', 'conflict');
    if (n.invoice.status !== 'ISSUED') throw new DomainError('Die Rechnung ist nicht mehr offen.', 'conflict');
    await tx.dunningNotice.update({ where: { id }, data: { status: 'ISSUED', issueDate: dateOf(berlinToday()), issuedAt: new Date(), issuedById: user.id } });
    await writeAudit({ actorId: user.id, action: 'dunning.issue', entityType: 'Invoice', entityId: n.invoiceId, summary: `${DUNNING_LABELS[n.level]} zu ${n.invoice.number} ausgestellt`, after: { dunningId: id } }, tx);
  });
}

export async function cancelDunning(user: AuthUser, id: string) {
  need(user, 'dunning.write');
  await db.$transaction(async (tx) => {
    const n = await tx.dunningNotice.findUnique({ where: { id } });
    if (!n || n.status === 'CANCELLED') throw notFoundError('Mahnung');
    await tx.dunningNotice.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    await writeAudit({ actorId: user.id, action: 'dunning.cancel', entityType: 'Invoice', entityId: n.invoiceId, summary: 'Mahnung storniert', after: { dunningId: id } }, tx);
  });
}

/* ------------------------------------------------------------ Leistungskatalog */

const serviceSchema = z.object({
  name: z.string().trim().min(2, 'Bitte eine Bezeichnung angeben.').max(160),
  description: z.string().trim().max(500).nullable().optional().transform((v) => v || null),
  unit: z.string().trim().max(20).nullable().optional().transform((v) => v || null),
  unitPriceCents: z.number().int().min(-1_000_000_000).max(1_000_000_000),
  vatBp: z.number().int().min(0).max(3000),
});
export async function listServices(user: AuthUser) {
  if (!has(user, 'invoices.read') && !has(user, 'invoices.write')) throw new ForbiddenError();
  return db.serviceItem.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
}
export async function saveService(user: AuthUser, id: string | null, raw: unknown) {
  need(user, 'invoices.write');
  const d = serviceSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const s = id ? await tx.serviceItem.update({ where: { id }, data: d }) : await tx.serviceItem.create({ data: d });
    await writeAudit({ actorId: user.id, action: id ? 'service.update' : 'service.create', entityType: 'ServiceItem', entityId: s.id, summary: `Leistung „${d.name}“ ${id ? 'geändert' : 'angelegt'}` }, tx);
    return s;
  });
}
export async function archiveService(user: AuthUser, id: string) {
  need(user, 'invoices.write');
  await db.$transaction(async (tx) => {
    await tx.serviceItem.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAudit({ actorId: user.id, action: 'service.archive', entityType: 'ServiceItem', entityId: id, summary: 'Leistung archiviert' }, tx);
  });
}

/* ------------------------------------------------------------ Export */

/** CSV (Semikolon, UTF-8 mit BOM) der Rechnungen – Formelzeichen werden neutralisiert. */
export async function invoicesCsv(user: AuthUser, query: InvoiceListQuery = {}): Promise<string> {
  need(user, 'invoices.export');
  const all = await listInvoices(user, { ...query, page: 1, limit: 200 });
  const eur = (c: number) => (c / 100).toFixed(2).replace('.', ',');
  const head = ['Rechnungsnummer', 'Status', 'Fall', 'Empfänger', 'Rechnungsdatum', 'Fällig am', 'Netto', 'MwSt', 'Brutto', 'Bezahlt', 'Offen'];
  const lines = all.rows.map((r) => [r.number ?? '', r.state, r.caseNumber ?? '', r.recipient.name, deDate(r.issueDate), deDate(r.dueDate), eur(r.totals.netCents), eur(r.totals.vatCents), eur(r.totals.grossCents), eur(r.paidCents), eur(r.openCents)].map(csvCell).join(';'));
  await writeAudit({ actorId: user.id, action: 'invoice.export', entityType: 'Invoice', entityId: null, summary: `Rechnungsexport (${lines.length} Zeilen)` });
  return `﻿${[head.join(';'), ...lines].join('\r\n')}\r\n`;
}

/* ------------------------------------------------------------ PDF */

async function pdfBase(label: string, number: string, title: string, draft: boolean, footerLeft: string) {
  const company = await getSetting('company');
  return ReportPdf.create({ label, number, caseNumber: '', title, draft, footerLeft, company: { name: company.name, lines: [], footer: [company.street, [company.postalCode, company.city].filter(Boolean).join(' '), company.phone, company.email, company.footer].filter(Boolean).join(', ') } }).then((p) => ({ p, company }));
}

export async function invoicePdf(user: AuthUser, id: string): Promise<{ bytes: Uint8Array; fileName: string }> {
  const inv = await getInvoice(user, id);
  const num = inv.number ?? 'ENTWURF';
  const { p, company } = await pdfBase('Rechnung', num, `Rechnung ${num}`, inv.status === 'DRAFT', `${company_ref(inv.caseNumber)}`);
  p.paragraph(pdfSafe([company.name, [company.street, [company.postalCode, company.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')].filter(Boolean).join(' · ')), { size: 7.5 });
  p.spacer(6);
  p.paragraph([inv.recipient.name, inv.recipient.street, [inv.recipient.postalCode, inv.recipient.city].filter(Boolean).join(' ')].filter(Boolean).join('\n'), { size: 10.5 });
  p.spacer(10);
  p.title(inv.status === 'CANCELLED' ? `Rechnung ${num} (storniert)` : 'Rechnung', inv.number ? `Nr. ${inv.number}` : 'Entwurf');
  p.keyValues([
    ['Rechnungsdatum', deDate(inv.issueDate)], ['Leistungsdatum', deDate(inv.serviceDate)], ['Fällig am', deDate(inv.dueDate)],
    ...(inv.caseNumber ? ([['Fall', inv.caseNumber]] as [string, string][]) : []), ...(inv.recipient.ref ? ([['Ihr Zeichen / Schadennummer', inv.recipient.ref]] as [string, string][]) : []),
  ], 160);
  if (inv.introText) p.paragraph(inv.introText);
  p.table([{ w: 26 }, { w: 215 }, { w: 55, align: 'r' }, { w: 70, align: 'r' }, { w: 40, align: 'r' }, { w: 74, align: 'r' }], ['Pos.', 'Leistung', 'Menge', 'Einzelpreis netto', 'MwSt', 'Netto'],
    inv.items.map((i) => [String(i.position), i.description, `${(i.quantityX100 / 100).toLocaleString('de-DE')}${i.unit ? ` ${i.unit}` : ''}`, fmtEuro(i.unitPriceCents), `${(i.vatBp / 100).toLocaleString('de-DE')} %`, fmtEuro(i.netCents)]),
    { totals: [['', 'Zwischensumme (netto)', '', '', '', fmtEuro(inv.totals.netCents)], ...inv.totals.groups.map((g) => ['', `zzgl. ${(g.vatBp / 100).toLocaleString('de-DE')} % MwSt auf ${fmtEuro(g.netCents)}`, '', '', '', fmtEuro(g.vatCents)]), ['', 'Gesamtbetrag (brutto)', '', '', '', fmtEuro(inv.totals.grossCents)]] });
  if (inv.paidCents > 0) p.paragraph(`Bereits gezahlt: ${fmtEuro(inv.paidCents)} · Offen: ${fmtEuro(inv.openCents)}`, { bold: true });
  if (inv.footerText) p.paragraph(inv.footerText);
  if (inv.status !== 'DRAFT') p.paragraph(`Bitte überweisen Sie den Betrag bis zum ${deDate(inv.dueDate)} unter Angabe der Rechnungsnummer.${company.bank ? `\nBankverbindung: ${company.bank}` : ''}`);
  if (company.taxId) p.paragraph(`Steuernummer / USt-IdNr.: ${company.taxId}`, { size: 9 });
  if (inv.status === 'CANCELLED') p.paragraph(`Diese Rechnung wurde am ${deDate(inv.cancelledAt?.toISOString().slice(0, 10))} storniert. Grund: ${inv.cancelReason ?? ''}`, { bold: true });
  return { bytes: await p.finish(), fileName: `${num}.pdf` };
}
const company_ref = (nr: string | null) => (nr ? `Fall ${nr}` : '');

export async function dunningPdf(user: AuthUser, id: string): Promise<{ bytes: Uint8Array; fileName: string }> {
  need(user, 'invoices.read');
  const n = await db.dunningNotice.findUnique({ where: { id } });
  if (!n) throw notFoundError('Mahnung');
  const inv = await getInvoice(user, n.invoiceId);
  const label = DUNNING_LABELS[n.level];
  const { p, company } = await pdfBase(label, inv.number ?? '', `${label} zu ${inv.number}`, n.status === 'DRAFT', `Rechnung ${inv.number}`);
  p.paragraph(pdfSafe([company.name, [company.street, [company.postalCode, company.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')].filter(Boolean).join(' · ')), { size: 7.5 });
  p.spacer(6);
  p.paragraph([inv.recipient.name, inv.recipient.street, [inv.recipient.postalCode, inv.recipient.city].filter(Boolean).join(' ')].filter(Boolean).join('\n'), { size: 10.5 });
  p.spacer(10);
  p.title(label, `zu Rechnung ${inv.number} · ${deDate(n.issueDate?.toISOString().slice(0, 10) ?? berlinToday())}`);
  if (n.text) p.paragraph(n.text);
  const open = inv.openCents;
  p.table([{ w: 300 }, { w: 120, align: 'r' }], ['Position', 'Betrag'], [['Offener Rechnungsbetrag', fmtEuro(open)], ...(n.feeCents ? [['Mahngebühr', fmtEuro(n.feeCents)]] : []), ...(n.interestCents ? [['Verzugszinsen', fmtEuro(n.interestCents)]] : [])], { totals: [['Zu zahlen bis ' + deDate(n.dueDate?.toISOString().slice(0, 10)), fmtEuro(open + n.feeCents + n.interestCents)]] });
  if (company.bank) p.paragraph(`Bankverbindung: ${company.bank}`);
  return { bytes: await p.finish(), fileName: `${label.replace(/\W+/g, '-')}-${inv.number}.pdf` };
}
