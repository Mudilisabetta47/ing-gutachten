import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import type { AuthUser } from '@/server/auth/session-types';
import { ForbiddenError } from '@/server/auth/errors';
import { DomainError, notFoundError } from '@/server/errors';
import { berlinDayRange } from '@/lib/berlin';
import { formatPlate, normalizePhone, normalizePlate, phoneNeedle } from '@/lib/normalize';
import { LEAD_CONVERTIBLE, LEAD_STATUSES, canLeadTransition, initialCaseStatus, type LeadStatusKey } from '@/lib/workflow';
import { has, leadAccess } from './access';
import { createCaseTx, createCustomerTx, createVehicleTx } from './core';
import { changedKeys, leadUpdateSchema, noteSchema, type CaseInput, type CustomerInput, type VehicleInput } from './schemas';

export const PAGE_SIZE = 25;

function need(user: AuthUser, mode: 'read' | 'write' | 'convert') {
  if (!leadAccess(user, mode)) throw new ForbiddenError();
}

/* ------------------------------------------------------------------ Liste */

export type LeadListQuery = { limit?: number;
  status?: string;
  from?: string;
  to?: string;
  source?: string;
  place?: string;
  service?: string;
  q?: string;
  mail?: string;
  sort?: string;
  dir?: string;
  page?: number;
};

/** Erlaubte Sortierfelder (Whitelist) – nie ungeprüfte Eingaben als Spaltennamen verwenden. */
export function leadOrder(sort?: string, dir?: string): Prisma.LeadOrderByWithRelationInput[] {
  const d: 'asc' | 'desc' = dir === 'asc' ? 'asc' : 'desc';
  switch (sort) {
    case 'name': return [{ name: d }, { createdAt: 'desc' }];
    case 'status': return [{ status: d }, { createdAt: 'desc' }];
    case 'ort': return [{ location: d }, { createdAt: 'desc' }];
    case 'aktion': return [{ nextActionAt: { sort: d, nulls: 'last' } }, { createdAt: 'desc' }];
    default: return [{ createdAt: sort === 'eingang' ? d : 'desc' }];
  }
}

export function leadWhere(q: LeadListQuery): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [{ deletedAt: null }];
  if (q.status && (LEAD_STATUSES as readonly string[]).includes(q.status)) and.push({ status: q.status as LeadStatusKey });
  if (q.source) and.push({ source: q.source });
  if (q.service) and.push({ reason: q.service });
  if (q.place) and.push({ location: { contains: q.place, mode: 'insensitive' } });
  if (q.mail === 'failed') and.push({ notificationStatus: 'FAILED' });
  const from = q.from ? berlinDayRange(q.from) : null;
  const to = q.to ? berlinDayRange(q.to) : null;
  if (from || to) and.push({ createdAt: { ...(from ? { gte: from.start } : {}), ...(to ? { lt: to.end } : {}) } });
  const term = q.q?.trim();
  if (term) {
    const phone = phoneNeedle(term);
    const plate = normalizePlate(term);
    and.push({
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        ...(phone ? [{ phoneNorm: { contains: phone } }] : []),
        ...(plate && plate.length >= 3 ? [{ licensePlateNorm: { contains: plate } }] : []),
      ],
    });
  }
  return { AND: and };
}

export async function listLeads(user: AuthUser, query: LeadListQuery) {
  need(user, 'read');
  const page = Math.max(1, query.page ?? 1);
  const size = Math.min(query.limit ?? PAGE_SIZE, 100);
  const where = leadWhere(query);
  const [rows, total] = await Promise.all([
    db.lead.findMany({
      where,
      orderBy: leadOrder(query.sort, query.dir),
      skip: (page - 1) * size,
      take: size,
      select: {
        id: true, name: true, phone: true, email: true, location: true, reason: true, vehicleKind: true, licensePlate: true,
        status: true, source: true, createdAt: true, notificationStatus: true, convertedCaseId: true, nextActionAt: true,
        assignedTo: { select: { firstName: true, lastName: true } },
        inquiry: { select: { _count: { select: { attachments: true } } } },
      },
    }),
    db.lead.count({ where }),
  ]);
  return { rows, total, page, pageSize: size };
}

/** Zähler pro Status für die Filterleiste (ein Query, kein N+1). */
export async function leadStatusCounts(user: AuthUser) {
  need(user, 'read');
  const groups = await db.lead.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } });
  return Object.fromEntries(groups.map((g) => [g.status, g._count._all])) as Partial<Record<LeadStatusKey, number>>;
}

/* ----------------------------------------------------------------- Detail */

export async function getLead(user: AuthUser, id: string) {
  need(user, 'read');
  const lead = await db.lead.findFirst({
    where: { id, deletedAt: null },
    include: {
      inquiry: { include: { attachments: { orderBy: { createdAt: 'asc' } } } },
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
      notes: { orderBy: { createdAt: 'desc' }, include: { author: { select: { firstName: true, lastName: true } } } },
      history: { orderBy: { createdAt: 'desc' }, include: { actor: { select: { firstName: true, lastName: true } } } },
      convertedCase: { select: { caseNumber: true } },
      convertedCustomer: { select: { id: true, firstName: true, lastName: true, company: true } },
      convertedVehicle: { select: { id: true, manufacturer: true, model: true, licensePlate: true } },
    },
  });
  if (!lead) throw notFoundError('Anfrage');
  return lead;
}

/* ------------------------------------------------------------- Bearbeiten */

export async function changeLeadStatus(user: AuthUser, id: string, to: LeadStatusKey, reason?: string | null) {
  need(user, 'write');
  if (to === 'CONVERTED') throw new DomainError('„Umgewandelt“ entsteht nur durch die Umwandlung in einen Fall.');
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({ where: { id, deletedAt: null }, select: { status: true } });
    if (!lead) throw notFoundError('Anfrage');
    if (!canLeadTransition(lead.status, to)) throw new DomainError(`Von „${lead.status}“ ist dieser Statuswechsel nicht möglich.`);
    const cleanReason = reason?.trim().slice(0, 500) || null;
    // Bedingtes Update: wurde der Status inzwischen von jemand anderem geändert, passiert nichts.
    const res = await tx.lead.updateMany({
      where: { id, status: lead.status },
      data: { status: to, closedReason: to === 'CLOSED' || to === 'SPAM' ? cleanReason : null },
    });
    if (res.count !== 1) throw new DomainError('Die Anfrage wurde gerade von jemand anderem geändert. Bitte neu laden.', 'conflict');
    await tx.leadStatusHistory.create({ data: { leadId: id, fromStatus: lead.status, toStatus: to, actorId: user.id, reason: cleanReason } });
    await writeAudit({ actorId: user.id, action: 'lead.status_change', entityType: 'Lead', entityId: id, summary: `Status ${lead.status} → ${to}`, before: { status: lead.status }, after: { status: to } }, tx);
    return to;
  });
}

export async function updateLead(user: AuthUser, id: string, raw: unknown) {
  need(user, 'write');
  const data = leadUpdateSchema.parse(raw);
  if (data.assignedToId) {
    const ok = await db.user.findFirst({ where: { id: data.assignedToId, isActive: true, deletedAt: null }, select: { id: true } });
    if (!ok) throw new DomainError('Dieser Mitarbeiter ist nicht verfügbar.');
  }
  const next = { ...data, phoneNorm: normalizePhone(data.phone), licensePlate: formatPlate(data.licensePlate), licensePlateNorm: normalizePlate(data.licensePlate) };
  return db.$transaction(async (tx) => {
    const before = await tx.lead.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw notFoundError('Anfrage');
    if (before.status === 'CONVERTED') throw new DomainError('Umgewandelte Anfragen sind abgeschlossen – bitte Kunde, Fahrzeug oder Fall bearbeiten.');
    await tx.lead.update({ where: { id }, data: next });
    const keys = changedKeys(before as unknown as Record<string, unknown>, next);
    if (keys.length) {
      // Nur Feldnamen, keine Klartextwerte personenbezogener Daten im Protokoll.
      await writeAudit({ actorId: user.id, action: 'lead.update', entityType: 'Lead', entityId: id, summary: `Anfrage bearbeitet (${keys.join(', ')})`, after: { changed: keys } }, tx);
    }
    if (keys.includes('assignedToId')) {
      await writeAudit({ actorId: user.id, action: 'lead.assign', entityType: 'Lead', entityId: id, summary: 'Zuständigkeit geändert', after: { assignedToId: next.assignedToId } }, tx);
    }
    return keys;
  });
}

export async function addLeadNote(user: AuthUser, id: string, raw: unknown) {
  need(user, 'write');
  const { body, kind } = noteSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!lead) throw notFoundError('Anfrage');
    const note = await tx.note.create({ data: { leadId: id, authorId: user.id, body, kind } });
    await writeAudit({ actorId: user.id, action: 'note.add', entityType: 'Lead', entityId: id, summary: kind === 'PHONE_CALL' ? 'Telefonnotiz hinzugefügt' : 'Notiz hinzugefügt' }, tx);
    return note;
  });
}

export async function userOptions(user: AuthUser) {
  need(user, 'read');
  return db.user.findMany({ where: { isActive: true, deletedAt: null }, orderBy: [{ firstName: 'asc' }], select: { id: true, firstName: true, lastName: true, role: true } });
}

/* --------------------------------------------------------------- Dubletten */

export type DuplicateHints = Awaited<ReturnType<typeof findLeadDuplicates>>;

/** Hinweise auf bestehende Kunden/Fahrzeuge/Fälle/Anfragen – nur Hinweise, NIE automatisches Zusammenführen. */
export async function findLeadDuplicates(user: AuthUser, leadId: string) {
  need(user, 'read');
  const lead = await db.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true, email: true, phoneNorm: true, licensePlateNorm: true } });
  if (!lead) throw notFoundError('Anfrage');
  const canCustomers = has(user, 'customers.read');
  const canCases = has(user, 'cases.read.all');
  const sameLead: Prisma.LeadWhereInput[] = [
    ...(lead.email ? [{ email: { equals: lead.email, mode: 'insensitive' as const } }] : []),
    ...(lead.phoneNorm ? [{ phoneNorm: lead.phoneNorm }] : []),
    ...(lead.licensePlateNorm ? [{ licensePlateNorm: lead.licensePlateNorm }] : []),
  ];
  const sameCustomer: Prisma.CustomerWhereInput[] = [
    ...(lead.email ? [{ email: { equals: lead.email, mode: 'insensitive' as const } }] : []),
    ...(lead.phoneNorm ? [{ phoneNorm: lead.phoneNorm }] : []),
    ...(lead.licensePlateNorm ? [{ vehicles: { some: { licensePlateNorm: lead.licensePlateNorm, deletedAt: null } } }] : []),
  ];
  if (!sameLead.length) return { customers: [], vehicles: [], cases: [], leads: [] };

  const [leads, customers, vehicles] = await Promise.all([
    db.lead.findMany({
      where: { id: { not: lead.id }, deletedAt: null, status: { not: 'SPAM' }, OR: sameLead },
      orderBy: { createdAt: 'desc' }, take: 5,
      select: { id: true, name: true, status: true, createdAt: true },
    }),
    canCustomers
      ? db.customer.findMany({ where: { deletedAt: null, OR: sameCustomer }, take: 5, orderBy: { createdAt: 'desc' }, select: { id: true, firstName: true, lastName: true, company: true, email: true, phone: true, city: true } })
      : Promise.resolve([]),
    canCustomers && lead.licensePlateNorm
      ? db.vehicle.findMany({ where: { deletedAt: null, licensePlateNorm: lead.licensePlateNorm }, take: 5, select: { id: true, customerId: true, manufacturer: true, model: true, licensePlate: true } })
      : Promise.resolve([]),
  ]);
  const cases = canCases && (customers.length || vehicles.length)
    ? await db.case.findMany({
        where: { deletedAt: null, OR: [{ customerId: { in: customers.map((c) => c.id) } }, { vehicleId: { in: vehicles.map((v) => v.id) } }] },
        orderBy: { createdAt: 'desc' }, take: 5,
        select: { id: true, caseNumber: true, status: true, createdAt: true },
      })
    : [];
  return { customers, vehicles, cases, leads };
}

/* -------------------------------------------------------------- Umwandlung */

export type ConvertInput = {
  customer: { mode: 'new'; data: CustomerInput } | { mode: 'existing'; id: string };
  vehicle: { mode: 'new'; data: VehicleInput } | { mode: 'existing'; id: string };
  case: CaseInput;
};

/**
 * Anfrage → Kunde + Fahrzeug + Fall in EINER Transaktion: alles oder nichts.
 * Die Zeilensperre auf dem Lead verhindert, dass zwei Mitarbeiter denselben Lead gleichzeitig umwandeln.
 */
export async function convertLead(user: AuthUser, leadId: string, input: ConvertInput) {
  need(user, 'convert');
  for (const p of ['customers.write', 'vehicles.write', 'cases.write.all'] as const) if (!has(user, p)) throw new ForbiddenError();

  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM leads WHERE id = ${leadId} FOR UPDATE`;
      const lead = await tx.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true, status: true } });
      if (!lead) throw notFoundError('Anfrage');
      if (lead.status === 'CONVERTED') throw new DomainError('Diese Anfrage wurde bereits umgewandelt.', 'conflict');
      if (!LEAD_CONVERTIBLE.includes(lead.status)) throw new DomainError('Diese Anfrage kann nicht umgewandelt werden (Status: abgeschlossen oder Spam).');

      let customerId: string;
      if (input.customer.mode === 'existing') {
        const c = await tx.customer.findFirst({ where: { id: input.customer.id, deletedAt: null }, select: { id: true } });
        if (!c) throw notFoundError('Kunde');
        customerId = c.id;
      } else {
        customerId = (await createCustomerTx(tx, user.id, input.customer.data)).id;
      }

      let vehicleId: string;
      if (input.vehicle.mode === 'existing') {
        const v = await tx.vehicle.findFirst({ where: { id: input.vehicle.id, deletedAt: null }, select: { id: true } });
        if (!v) throw notFoundError('Fahrzeug');
        vehicleId = v.id;
      } else {
        vehicleId = (await createVehicleTx(tx, user.id, customerId, input.vehicle.data)).id;
      }

      const created = await createCaseTx(tx, user.id, { customerId, vehicleId, data: input.case, status: initialCaseStatus(lead.status), fromLeadId: leadId });

      const now = new Date();
      await tx.lead.update({
        where: { id: leadId },
        data: { status: 'CONVERTED', convertedAt: now, convertedById: user.id, convertedCustomerId: customerId, convertedVehicleId: vehicleId, convertedCaseId: created.id },
      });
      await tx.leadStatusHistory.create({ data: { leadId, fromStatus: lead.status, toStatus: 'CONVERTED', actorId: user.id, reason: `Fall ${created.caseNumber}` } });
      await writeAudit(
        { actorId: user.id, action: 'lead.convert', entityType: 'Lead', entityId: leadId, summary: `Anfrage in Fall ${created.caseNumber} umgewandelt`, after: { caseId: created.id, caseNumber: created.caseNumber, customerId, vehicleId } },
        tx,
      );
      return { caseId: created.id, caseNumber: created.caseNumber, customerId, vehicleId };
    },
    { timeout: 15_000 },
  );
}
