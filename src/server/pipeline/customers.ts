import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import type { AuthUser } from '@/server/auth/session-types';
import { ForbiddenError } from '@/server/auth/errors';
import { DomainError, notFoundError } from '@/server/errors';
import { normalizePhone, normalizePlate, phoneNeedle } from '@/lib/normalize';
import { CASE_TERMINAL } from '@/lib/workflow';
import { caseScope, customerScope, has } from './access';
import { createCustomerTx } from './core';
import { PAGE_SIZE } from './leads';
import { changedKeys, customerSchema, noteSchema } from './schemas';

function scopeOrThrow(user: AuthUser) {
  const scope = customerScope(user);
  if (!scope) throw new ForbiddenError();
  return scope;
}
function needWrite(user: AuthUser) {
  if (!has(user, 'customers.write')) throw new ForbiddenError();
}

export type CustomerListQuery = { limit?: number; q?: string; page?: number; archiv?: boolean; sort?: string; dir?: string };

export function customerOrder(sort?: string, dir?: string): Prisma.CustomerOrderByWithRelationInput[] {
  const d: 'asc' | 'desc' = dir === 'desc' ? 'desc' : 'asc';
  switch (sort) {
    case 'ort': return [{ city: d }, { lastName: 'asc' }];
    case 'neu': return [{ createdAt: dir === 'asc' ? 'asc' : 'desc' }];
    case 'aktiv': return [{ updatedAt: dir === 'asc' ? 'asc' : 'desc' }];
    default: return [{ lastName: d }, { firstName: d }];
  }
}

export async function listCustomers(user: AuthUser, query: CustomerListQuery) {
  const scope = scopeOrThrow(user);
  const page = Math.max(1, query.page ?? 1);
  const size = Math.min(query.limit ?? PAGE_SIZE, 100);
  const term = query.q?.trim();
  const phone = term ? phoneNeedle(term) : null;
  const plate = term ? normalizePlate(term) : null;
  const archiv = Boolean(query.archiv) && has(user, 'customers.delete');
  const where: Prisma.CustomerWhereInput = {
    AND: [
      scope,
      archiv ? { deletedAt: { not: null } } : { deletedAt: null },
      ...(term
        ? [{
            OR: [
              { lastName: { contains: term, mode: 'insensitive' as const } },
              { firstName: { contains: term, mode: 'insensitive' as const } },
              { company: { contains: term, mode: 'insensitive' as const } },
              { email: { contains: term, mode: 'insensitive' as const } },
              ...(phone ? [{ phoneNorm: { contains: phone } }] : []),
              ...(plate && plate.length >= 3 ? [{ vehicles: { some: { licensePlateNorm: { contains: plate } } } }] : []),
            ],
          }]
        : []),
    ],
  };
  const [rows, total] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: customerOrder(query.sort, query.dir),
      skip: (page - 1) * size,
      take: size,
      select: { id: true, firstName: true, lastName: true, company: true, email: true, phone: true, city: true, createdAt: true, updatedAt: true, deletedAt: true, _count: { select: { cases: { where: { deletedAt: null } }, vehicles: { where: { deletedAt: null } } } } },
    }),
    db.customer.count({ where }),
  ]);
  return { rows, total, page, pageSize: size };
}

export async function getCustomer(user: AuthUser, id: string) {
  const scope = scopeOrThrow(user);
  const customer = await db.customer.findFirst({
    where: { AND: [{ id }, scope] },
    include: { _count: { select: { cases: { where: { deletedAt: null } }, vehicles: { where: { deletedAt: null } }, notes: true } } },
  });
  if (!customer) throw notFoundError('Kunde');
  return customer;
}

export async function customerVehicles(user: AuthUser, customerId: string) {
  await getCustomer(user, customerId);
  return db.vehicle.findMany({
    where: { customerId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, manufacturer: true, model: true, variant: true, licensePlate: true, vin: true, firstRegistration: true, mileage: true },
  });
}

export async function customerCases(user: AuthUser, customerId: string) {
  await getCustomer(user, customerId);
  const scope = caseScope(user, 'read');
  if (!scope) return [];
  return db.case.findMany({
    where: { AND: [{ customerId, deletedAt: null }, scope] },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, caseNumber: true, status: true, serviceType: true, createdAt: true, vehicle: { select: { manufacturer: true, model: true, licensePlate: true } }, assignedExpert: { select: { firstName: true, lastName: true } } },
  });
}

/** Interne Notizen am Kunden: nur Rollen mit Schreibrecht am Kunden (nicht Experten, nicht Buchhaltung). */
export async function customerNotes(user: AuthUser, customerId: string) {
  await getCustomer(user, customerId);
  if (!has(user, 'customers.write')) return [];
  return db.note.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' }, take: 100, include: { author: { select: { firstName: true, lastName: true } } } });
}

export async function createCustomer(user: AuthUser, raw: unknown) {
  needWrite(user);
  const data = customerSchema.parse(raw);
  return db.$transaction((tx) => createCustomerTx(tx, user.id, data));
}

export async function updateCustomer(user: AuthUser, id: string, raw: unknown) {
  needWrite(user);
  const data = customerSchema.parse(raw);
  const next = { ...data, phoneNorm: normalizePhone(data.phone) };
  return db.$transaction(async (tx) => {
    const before = await tx.customer.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw notFoundError('Kunde');
    await tx.customer.update({ where: { id }, data: next });
    const keys = changedKeys(before as unknown as Record<string, unknown>, next);
    if (keys.length) await writeAudit({ actorId: user.id, action: 'customer.update', entityType: 'Customer', entityId: id, summary: `Kunde bearbeitet (${keys.join(', ')})`, after: { changed: keys } }, tx);
    return keys;
  });
}

export async function addCustomerNote(user: AuthUser, id: string, raw: unknown) {
  needWrite(user);
  const { body, kind } = noteSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const c = await tx.customer.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!c) throw notFoundError('Kunde');
    const note = await tx.note.create({ data: { customerId: id, authorId: user.id, body, kind } });
    await writeAudit({ actorId: user.id, action: 'note.add', entityType: 'Customer', entityId: id, summary: 'Notiz hinzugefügt' }, tx);
    return note;
  });
}

/** Archivieren (Soft Delete): nur Leitung; nicht, solange offene Fälle bestehen. */
export async function archiveCustomer(user: AuthUser, id: string) {
  if (!has(user, 'customers.delete')) throw new ForbiddenError();
  return db.$transaction(async (tx) => {
    const c = await tx.customer.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!c) throw notFoundError('Kunde');
    const open = await tx.case.count({ where: { customerId: id, deletedAt: null, status: { notIn: [...CASE_TERMINAL] } } });
    if (open > 0) throw new DomainError(`Der Kunde hat ${open} offene Fälle und kann nicht archiviert werden.`, 'conflict');
    await tx.customer.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAudit({ actorId: user.id, action: 'customer.archive', entityType: 'Customer', entityId: id, summary: 'Kunde archiviert' }, tx);
  });
}

export async function restoreCustomer(user: AuthUser, id: string) {
  if (!has(user, 'customers.delete')) throw new ForbiddenError();
  return db.$transaction(async (tx) => {
    const res = await tx.customer.updateMany({ where: { id, deletedAt: { not: null }, anonymizedAt: null }, data: { deletedAt: null } });
    if (res.count !== 1) throw notFoundError('Archivierter Kunde');
    await writeAudit({ actorId: user.id, action: 'customer.restore', entityType: 'Customer', entityId: id, summary: 'Kunde wiederhergestellt' }, tx);
  });
}

/**
 * DSGVO: Personendaten eines archivierten Kunden unwiderruflich entfernen.
 * Bleibt bewusst erhalten: Fälle, Fahrzeuge und bereits ausgestellte Rechnungen samt Empfängeranschrift – für sie gelten gesetzliche
 * Aufbewahrungsfristen (Buchführungsunterlagen, § 147 AO). Sie werden nach Fristablauf separat bereinigt.
 */
export async function anonymizeCustomer(user: AuthUser, id: string) {
  if (!has(user, 'data.anonymize')) throw new ForbiddenError();
  return db.$transaction(async (tx) => {
    const c = await tx.customer.findFirst({ where: { id }, select: { id: true, deletedAt: true, anonymizedAt: true } });
    if (!c) throw notFoundError('Kunde');
    if (c.anonymizedAt) throw new DomainError('Dieser Kunde ist bereits anonymisiert.', 'conflict');
    if (!c.deletedAt) throw new DomainError('Nur archivierte Kunden können anonymisiert werden. Bitte zuerst archivieren.', 'conflict');
    const open = await tx.case.count({ where: { customerId: id, status: { notIn: [...CASE_TERMINAL] } } });
    if (open > 0) throw new DomainError(`Der Kunde hat noch ${open} offene Fälle.`, 'conflict');
    const unpaid = await tx.invoice.findMany({ where: { customerId: id, status: { in: ['DRAFT', 'ISSUED'] } }, select: { status: true, grossCents: true, payments: { where: { reversedAt: null }, select: { amountCents: true } } } });
    if (unpaid.some((i) => i.status === 'DRAFT' || i.grossCents > i.payments.reduce((n, p) => n + p.amountCents, 0))) throw new DomainError('Es gibt noch Rechnungsentwürfe oder offene Rechnungen zu diesem Kunden.', 'conflict');
    await tx.customer.update({ where: { id }, data: { company: null, firstName: 'Anonymisiert', lastName: 'Anonymisiert', email: null, phone: null, phoneNorm: null, street: null, postalCode: null, city: null, anonymizedAt: new Date() } });
    const notes = await tx.note.updateMany({ where: { customerId: id }, data: { body: '[anonymisiert]' } });
    const docs = await tx.document.findMany({ where: { customerId: id, deletedAt: null }, select: { id: true, mediaId: true } });
    const now = new Date();
    for (const d of docs) { await tx.document.update({ where: { id: d.id }, data: { deletedAt: now } }); await tx.media.update({ where: { id: d.mediaId }, data: { deletedAt: now } }); }
    await tx.task.deleteMany({ where: { customerId: id } });
    await writeAudit({ actorId: user.id, action: 'customer.anonymize', entityType: 'Customer', entityId: id, summary: 'Kunde anonymisiert (DSGVO)', after: { notes: notes.count, documents: docs.length } }, tx);
  });
}
