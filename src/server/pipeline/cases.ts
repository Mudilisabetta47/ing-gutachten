import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import type { AuthUser } from '@/server/auth/session-types';
import { ForbiddenError } from '@/server/auth/errors';
import { DomainError, notFoundError } from '@/server/errors';
import { normalizePlate } from '@/lib/normalize';
import { CASE_EXPERT_TARGETS, CASE_STATUSES, CASE_TERMINAL, canCaseTransition, caseReasonRequired, type CaseStatusKey } from '@/lib/workflow';
import { canSeeCaseInternals, caseScope, has, projectCase } from './access';
import { assertAssignableExpert, createCaseTx } from './core';
import { PAGE_SIZE } from './leads';
import { caseSchema, changedKeys, noteSchema } from './schemas';

export type CaseListQuery = { limit?: number; status?: string; q?: string; expert?: string; page?: number; archiv?: boolean; sort?: string; dir?: string };

export function caseOrder(sort?: string, dir?: string): Prisma.CaseOrderByWithRelationInput[] {
  const d: 'asc' | 'desc' = dir === 'asc' ? 'asc' : 'desc';
  switch (sort) {
    case 'nr': return [{ caseNumber: d }];
    case 'kunde': return [{ customer: { lastName: d } }, { createdAt: 'desc' }];
    case 'status': return [{ status: d }, { createdAt: 'desc' }];
    case 'aktiv': return [{ updatedAt: d }];
    default: return [{ createdAt: sort === 'eingang' ? d : 'desc' }];
  }
}

export async function listCases(user: AuthUser, query: CaseListQuery) {
  const scope = caseScope(user, 'read');
  if (!scope) throw new ForbiddenError();
  const page = Math.max(1, query.page ?? 1);
  const size = Math.min(query.limit ?? PAGE_SIZE, 100);
  const term = query.q?.trim();
  const plate = term ? normalizePlate(term) : null;
  const archiv = Boolean(query.archiv) && has(user, 'cases.delete');
  const and: Prisma.CaseWhereInput[] = [scope, archiv ? { deletedAt: { not: null } } : { deletedAt: null }];
  if (query.status === 'open') and.push({ status: { notIn: [...CASE_TERMINAL] } });
  else if (query.status && (CASE_STATUSES as readonly string[]).includes(query.status)) and.push({ status: query.status as CaseStatusKey });
  if (query.expert === 'none') and.push({ assignedExpertId: null });
  else if (query.expert === 'me') and.push({ assignedExpertId: user.id });
  else if (query.expert) and.push({ assignedExpertId: query.expert });
  if (term) {
    and.push({
      OR: [
        { caseNumber: { contains: term, mode: 'insensitive' } },
        { insuranceClaimNumber: { contains: term, mode: 'insensitive' } },
        { customer: { lastName: { contains: term, mode: 'insensitive' } } },
        { customer: { company: { contains: term, mode: 'insensitive' } } },
        ...(plate && plate.length >= 3 ? [{ vehicle: { licensePlateNorm: { contains: plate } } }] : []),
      ],
    });
  }
  const where: Prisma.CaseWhereInput = { AND: and };
  const [rows, total] = await Promise.all([
    db.case.findMany({
      where,
      orderBy: caseOrder(query.sort, query.dir),
      skip: (page - 1) * size,
      take: size,
      select: {
        id: true, caseNumber: true, status: true, serviceType: true, createdAt: true, updatedAt: true, deletedAt: true,
        customer: { select: { id: true, firstName: true, lastName: true, company: true } },
        vehicle: { select: { manufacturer: true, model: true, licensePlate: true } },
        assignedExpert: { select: { firstName: true, lastName: true } },
      },
    }),
    db.case.count({ where }),
  ]);
  return { rows, total, page, pageSize: size };
}

export async function caseStatusCounts(user: AuthUser) {
  const scope = caseScope(user, 'read');
  if (!scope) throw new ForbiddenError();
  const groups = await db.case.groupBy({ by: ['status'], where: { AND: [scope, { deletedAt: null }] }, _count: { _all: true } });
  return Object.fromEntries(groups.map((g) => [g.status, g._count._all])) as Partial<Record<CaseStatusKey, number>>;
}

/** Fall per Nummer – mit Objektprüfung (Experten sehen nur eigene Fälle) und Feld-Projektion. */
export async function getCase(user: AuthUser, caseNumber: string) {
  const scope = caseScope(user, 'read');
  if (!scope) throw new ForbiddenError();
  // Archivierte Fälle sehen nur Rollen mit Archiv-Recht (zum Wiederherstellen); für alle anderen existieren sie nicht mehr.
  const c = await db.case.findFirst({
    where: { AND: [{ caseNumber }, scope, has(user, 'cases.delete') ? {} : { deletedAt: null }] },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, company: true, email: true, phone: true, street: true, postalCode: true, city: true, deletedAt: true } },
      vehicle: { select: { id: true, manufacturer: true, model: true, variant: true, licensePlate: true, vin: true, firstRegistration: true, mileage: true, fuelType: true, color: true } },
      assignedExpert: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      history: { orderBy: { createdAt: 'desc' }, include: { actor: { select: { firstName: true, lastName: true } } } },
      lead: { select: { id: true, createdAt: true, inquiry: { select: { receivedAt: true, attachments: { select: { id: true, kind: true, status: true, sizeBytes: true } } } } } },
    },
  });
  if (!c) throw notFoundError('Fall');
  const projected = projectCase(user, c);
  return { ...projected, internalsVisible: canSeeCaseInternals(user) };
}

export async function caseNotes(user: AuthUser, caseId: string) {
  if (!canSeeCaseInternals(user)) return [];
  const scope = caseScope(user, 'read');
  if (!scope) return [];
  const ok = await db.case.findFirst({ where: { AND: [{ id: caseId }, scope] }, select: { id: true } });
  if (!ok) return [];
  return db.note.findMany({ where: { caseId }, orderBy: { createdAt: 'desc' }, take: 100, include: { author: { select: { firstName: true, lastName: true } } } });
}

async function writableCase(user: AuthUser, id: string) {
  const scope = caseScope(user, 'write');
  if (!scope) throw new ForbiddenError();
  const c = await db.case.findFirst({ where: { AND: [{ id, deletedAt: null }, scope] }, select: { id: true } });
  if (!c) throw notFoundError('Fall'); // fremder Fall = „nicht gefunden“, nicht „verboten“
  return c;
}

/** Manuelle Anlage (ohne Anfrage), z. B. Stammkunde ruft an. */
export async function createCase(user: AuthUser, args: { customerId: string; vehicleId: string; data: unknown }) {
  if (!has(user, 'cases.write.all')) throw new ForbiddenError();
  const data = caseSchema.parse(args.data);
  if (data.assignedExpertId && !has(user, 'cases.assign')) throw new ForbiddenError();
  return db.$transaction((tx) => createCaseTx(tx, user.id, { customerId: args.customerId, vehicleId: args.vehicleId, data }));
}

export async function updateCase(user: AuthUser, id: string, raw: unknown) {
  await writableCase(user, id);
  const parsed = caseSchema.parse(raw);
  // Zuweisung läuft über assignExpert (eigene Berechtigung + eigener Audit-Eintrag).
  const { assignedExpertId: _ignored, ...data } = parsed;
  return db.$transaction(async (tx) => {
    const before = await tx.case.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw notFoundError('Fall');
    await tx.case.update({ where: { id }, data });
    const keys = changedKeys(before as unknown as Record<string, unknown>, data);
    if (keys.length) await writeAudit({ actorId: user.id, action: 'case.update', entityType: 'Case', entityId: id, summary: `Fall bearbeitet (${keys.join(', ')})`, after: { changed: keys } }, tx);
    return keys;
  });
}

/**
 * Statuswechsel: zentrale Übergangsprüfung + Rechte + Pflichtbegründung + Historie + Audit.
 * Büro/Leitung (`cases.status`) dürfen alles Erlaubte; der zugewiesene Sachverständige nur die
 * fachlichen Schritte seiner Arbeit.
 */
export async function changeCaseStatus(user: AuthUser, id: string, to: CaseStatusKey, reason?: string | null) {
  return db.$transaction(async (tx) => {
    const c = await tx.case.findFirst({ where: { id, deletedAt: null }, select: { status: true, assignedExpertId: true } });
    if (!c) throw notFoundError('Fall');

    const office = has(user, 'cases.status');
    const ownExpert = has(user, 'cases.write.own') && c.assignedExpertId === user.id && CASE_EXPERT_TARGETS.includes(to);
    if (!office && !ownExpert) {
      // Fremde Fälle verraten wir nicht.
      if (!has(user, 'cases.read.all') && c.assignedExpertId !== user.id) throw notFoundError('Fall');
      throw new ForbiddenError();
    }
    if (!canCaseTransition(c.status, to)) throw new DomainError('Dieser Statuswechsel ist nicht erlaubt.');
    const cleanReason = reason?.trim().slice(0, 500) || null;
    if (caseReasonRequired(c.status, to) && !cleanReason) throw new DomainError('Bitte eine Begründung angeben.');

    const terminal = CASE_TERMINAL.includes(to);
    const res = await tx.case.updateMany({
      where: { id, status: c.status },
      data: { status: to, closedAt: terminal ? new Date() : null, cancelledReason: to === 'CANCELLED' ? cleanReason : null },
    });
    if (res.count !== 1) throw new DomainError('Der Fall wurde gerade von jemand anderem geändert. Bitte neu laden.', 'conflict');
    await tx.caseStatusHistory.create({ data: { caseId: id, fromStatus: c.status, toStatus: to, actorId: user.id, reason: cleanReason } });
    await writeAudit({ actorId: user.id, action: 'case.status_change', entityType: 'Case', entityId: id, summary: `Status ${c.status} → ${to}`, before: { status: c.status }, after: { status: to } }, tx);
    return to;
  });
}

export async function assignExpert(user: AuthUser, id: string, expertId: string | null) {
  if (!has(user, 'cases.assign')) throw new ForbiddenError();
  return db.$transaction(async (tx) => {
    const c = await tx.case.findFirst({ where: { id, deletedAt: null }, select: { assignedExpertId: true } });
    if (!c) throw notFoundError('Fall');
    if (expertId) await assertAssignableExpert(tx, expertId);
    if (c.assignedExpertId === expertId) return;
    await tx.case.update({ where: { id }, data: { assignedExpertId: expertId } });
    await writeAudit({ actorId: user.id, action: 'case.assign', entityType: 'Case', entityId: id, summary: expertId ? 'Sachverständiger zugewiesen' : 'Zuweisung entfernt', before: { assignedExpertId: c.assignedExpertId }, after: { assignedExpertId: expertId } }, tx);
  });
}

export async function addCaseNote(user: AuthUser, id: string, raw: unknown) {
  await writableCase(user, id);
  const { body, kind } = noteSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const note = await tx.note.create({ data: { caseId: id, authorId: user.id, body, kind } });
    await writeAudit({ actorId: user.id, action: 'note.add', entityType: 'Case', entityId: id, summary: 'Notiz hinzugefügt' }, tx);
    return note;
  });
}

export async function archiveCase(user: AuthUser, id: string) {
  if (!has(user, 'cases.delete')) throw new ForbiddenError();
  return db.$transaction(async (tx) => {
    const res = await tx.case.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
    if (res.count !== 1) throw notFoundError('Fall');
    await writeAudit({ actorId: user.id, action: 'case.archive', entityType: 'Case', entityId: id, summary: 'Fall archiviert' }, tx);
  });
}

export async function restoreCase(user: AuthUser, id: string) {
  if (!has(user, 'cases.delete')) throw new ForbiddenError();
  return db.$transaction(async (tx) => {
    const res = await tx.case.updateMany({ where: { id, deletedAt: { not: null } }, data: { deletedAt: null } });
    if (res.count !== 1) throw notFoundError('Archivierter Fall');
    await writeAudit({ actorId: user.id, action: 'case.restore', entityType: 'Case', entityId: id, summary: 'Fall wiederhergestellt' }, tx);
  });
}

/** Auswahl für „Sachverständiger zuweisen“. */
export async function listExperts(user: AuthUser) {
  if (!has(user, 'cases.assign') && !has(user, 'leads.read') && !has(user, 'cases.read.all')) throw new ForbiddenError();
  return db.user.findMany({
    where: { isActive: true, deletedAt: null, employee: { isExpert: true } },
    orderBy: { firstName: 'asc' },
    select: { id: true, firstName: true, lastName: true },
  });
}
