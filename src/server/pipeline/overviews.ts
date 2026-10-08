import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import type { AuthUser } from '@/server/auth/session-types';
import { ForbiddenError } from '@/server/auth/errors';
import { has } from './access';
import { toDto as calcDto } from './calculations';

/**
 * Fallübergreifende Übersichten (Kalkulationen, Bewertungen, Besichtigungen, Dokumente, Fotos).
 * Jede Liste folgt denselben Rechten wie der Reiter im Fall: `.all` = alles, `.own` = nur Fälle, die dem Benutzer zugewiesen sind.
 */
type Base = 'calculations' | 'valuations' | 'appointments' | 'documents' | 'photos';
function caseFilter(user: AuthUser, base: Base): Prisma.CaseWhereInput {
  if (has(user, `${base}.read.all` as never)) return { deletedAt: null };
  if (has(user, `${base}.read.own` as never)) return { deletedAt: null, assignedExpertId: user.id };
  throw new ForbiddenError();
}
const page = (n?: number) => Math.max(1, n ?? 1);
const SIZE = 25;
const personOf = (c: { company: string | null; firstName: string; lastName: string }) => c.company || `${c.firstName} ${c.lastName}`.trim();
const caseSel = { select: { caseNumber: true, customer: { select: { company: true, firstName: true, lastName: true } }, vehicle: { select: { manufacturer: true, model: true, licensePlate: true } } } } as const;
const caseLine = (c: { caseNumber: string; customer: { company: string | null; firstName: string; lastName: string }; vehicle: { manufacturer: string; model: string; licensePlate: string | null } }) =>
  ({ caseNumber: c.caseNumber, customer: personOf(c.customer), vehicle: `${c.vehicle.manufacturer} ${c.vehicle.model}`.trim(), plate: c.vehicle.licensePlate });
const qWhere = (q?: string): Prisma.CaseWhereInput => (q?.trim() ? { OR: [{ caseNumber: { contains: q.trim(), mode: 'insensitive' } }, { customer: { OR: [{ lastName: { contains: q.trim(), mode: 'insensitive' } }, { company: { contains: q.trim(), mode: 'insensitive' } }] } }, { vehicle: { licensePlate: { contains: q.trim(), mode: 'insensitive' } } }] } : {});

export async function calculationsOverview(user: AuthUser, q: { q?: string; status?: 'DRAFT' | 'FINAL'; page?: number }) {
  const caseWhere = { AND: [caseFilter(user, 'calculations'), qWhere(q.q)] };
  const where: Prisma.CalculationWhereInput = { case: caseWhere, ...(q.status ? { status: q.status } : {}) };
  const [rows, total] = await Promise.all([
    db.calculation.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: (page(q.page) - 1) * SIZE, take: SIZE, include: { items: true, case: caseSel } }),
    db.calculation.count({ where }),
  ]);
  return { total, page: page(q.page), pageSize: SIZE, rows: rows.map((r) => { const d = calcDto(r); return { id: r.id, version: r.version, status: r.status, title: r.title, netCents: d.totals.net, grossCents: d.totals.gross, positions: r.items.length, updatedAt: r.updatedAt, ...caseLine(r.case) }; }) };
}

export async function valuationsOverview(user: AuthUser, q: { types: string[]; q?: string; page?: number }) {
  const caseWhere = { AND: [caseFilter(user, 'valuations'), qWhere(q.q)] };
  const where: Prisma.ValuationEntryWhereInput = { case: caseWhere, type: { in: q.types as never[] }, selected: true };
  const [rows, total] = await Promise.all([
    db.valuationEntry.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page(q.page) - 1) * SIZE, take: SIZE, include: { case: caseSel } }),
    db.valuationEntry.count({ where }),
  ]);
  return { total, page: page(q.page), pageSize: SIZE, rows: rows.map((e) => ({ id: e.id, type: e.type, label: e.label, amountCents: e.amountCents, days: e.days, taxMode: e.taxMode, source: e.source, referenceDate: e.referenceDate?.toISOString().slice(0, 10) ?? null, validUntil: e.validUntil?.toISOString().slice(0, 10) ?? null, ...caseLine(e.case) })) };
}

export async function inspectionsOverview(user: AuthUser, q: { kind: 'INSPECTION' | 'REINSPECTION'; when?: 'upcoming' | 'past'; q?: string; page?: number }) {
  const scope = has(user, 'appointments.read.all') ? {} : has(user, 'appointments.read.own') ? { expertId: user.id } : null;
  if (!scope) throw new ForbiddenError();
  const now = new Date();
  const where: Prisma.AppointmentWhereInput = { ...scope, kind: q.kind, case: { AND: [{ deletedAt: null }, qWhere(q.q)] }, ...(q.when === 'past' ? { startsAt: { lt: now } } : { OR: [{ startsAt: { gte: now } }, { status: { in: ['PLANNED', 'CONFIRMED'] } }] }) };
  const [rows, total] = await Promise.all([
    db.appointment.findMany({ where, orderBy: { startsAt: q.when === 'past' ? 'desc' : 'asc' }, skip: (page(q.page) - 1) * SIZE, take: SIZE, include: { case: caseSel, expert: { select: { firstName: true, lastName: true } }, inspection: { select: { status: true } } } }),
    db.appointment.count({ where }),
  ]);
  return { total, page: page(q.page), pageSize: SIZE, rows: rows.map((a) => ({ id: a.id, startsAt: a.startsAt, status: a.status, location: a.location, expert: a.expert ? `${a.expert.firstName} ${a.expert.lastName}` : null, inspectionStatus: a.inspection?.status ?? null, ...caseLine(a.case) })) };
}

export async function documentsOverview(user: AuthUser, q: { q?: string; category?: string; page?: number }) {
  const all = has(user, 'documents.read.all');
  if (!all && !has(user, 'documents.read.own')) throw new ForbiddenError();
  const where: Prisma.DocumentWhereInput = {
    deletedAt: null, media: { deletedAt: null },
    ...(all ? {} : { case: caseFilter(user, 'documents') }),
    ...(q.category ? { category: q.category as never } : {}),
    ...(q.q?.trim() ? { OR: [{ title: { contains: q.q.trim(), mode: 'insensitive' } }, { case: { caseNumber: { contains: q.q.trim(), mode: 'insensitive' } } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.document.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page(q.page) - 1) * SIZE, take: SIZE, include: { media: { select: { sizeBytes: true, mimeType: true } }, case: { select: { caseNumber: true } }, customer: { select: { id: true, firstName: true, lastName: true, company: true } } } }),
    db.document.count({ where }),
  ]);
  return { total, page: page(q.page), pageSize: SIZE, rows: rows.map((d) => ({ id: d.id, title: d.title, category: d.category, createdAt: d.createdAt, mediaId: d.mediaId, sizeBytes: d.media.sizeBytes, mimeType: d.media.mimeType, caseNumber: d.case?.caseNumber ?? null, customer: d.customer ? personOf(d.customer) : null })) };
}

/** Fotodokumentation: je Fall Anzahl der Fotos nach Kategorie (die Fotos selbst bleiben im Fall). */
export async function photosOverview(user: AuthUser, q: { q?: string; page?: number }) {
  const caseWhere: Prisma.CaseWhereInput = { AND: [caseFilter(user, 'photos'), qWhere(q.q), { photos: { some: { deletedAt: null } } }] };
  const [cases, total] = await Promise.all([
    db.case.findMany({ where: caseWhere, orderBy: { updatedAt: 'desc' }, skip: (page(q.page) - 1) * SIZE, take: SIZE, select: { id: true, ...caseSel.select } }),
    db.case.count({ where: caseWhere }),
  ]);
  const grouped = cases.length ? await db.casePhoto.groupBy({ by: ['caseId', 'category'], where: { caseId: { in: cases.map((c) => c.id) }, deletedAt: null }, _count: { _all: true } }) : [];
  return { total, page: page(q.page), pageSize: SIZE, rows: cases.map((c) => { const mine = grouped.filter((g) => g.caseId === c.id); return { ...caseLine(c), total: mine.reduce((n, g) => n + g._count._all, 0), byCategory: Object.fromEntries(mine.map((g) => [g.category, g._count._all])) as Record<string, number> }; }) };
}
