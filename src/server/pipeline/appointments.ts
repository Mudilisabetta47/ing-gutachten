import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import type { AuthUser } from '@/server/auth/session-types';
import { ForbiddenError } from '@/server/auth/errors';
import { DomainError, notFoundError } from '@/server/errors';
import { z } from 'zod';
import { has } from './access';
import { canOnCase, loadCaseFor } from './case-access';
import { assertAssignableExpert, type Tx } from './core';

export const APPOINTMENT_KINDS = ['INSPECTION', 'CONSULTATION', 'OTHER'] as const;
export const KIND_LABELS: Record<string, string> = { INSPECTION: 'Besichtigung', CONSULTATION: 'Beratung', OTHER: 'Sonstiger Termin' };
export const APPT_LABELS: Record<string, string> = { PLANNED: 'Geplant', CONFIRMED: 'Bestätigt', DONE: 'Erledigt', CANCELLED: 'Abgesagt', NO_SHOW: 'Nicht wahrgenommen' };
const ACTIVE = ['PLANNED', 'CONFIRMED'] as const;

const MAX_HOURS = 12;

const createSchema = z.object({
  expertId: z.string().trim().min(1, 'Bitte einen Sachverständigen wählen.'),
  kind: z.enum(APPOINTMENT_KINDS).default('INSPECTION'),
  startsAt: z.date(),
  endsAt: z.date(),
  location: z.string().trim().max(200).optional().nullable().transform((v) => v || null),
  notes: z.string().trim().max(1000).optional().nullable().transform((v) => v || null),
});
export type AppointmentInput = z.input<typeof createSchema>;

function checkTimes(starts: Date, ends: Date) {
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) throw new DomainError('Bitte Beginn und Ende angeben.');
  if (ends <= starts) throw new DomainError('Das Ende muss nach dem Beginn liegen.');
  if (ends.getTime() - starts.getTime() > MAX_HOURS * 3_600_000) throw new DomainError(`Ein Termin dauert höchstens ${MAX_HOURS} Stunden.`);
  if (starts.getFullYear() < 2020 || starts.getFullYear() > 2100) throw new DomainError('Das Datum ist unplausibel.');
}

/** Überschneidungen verhindert die Datenbank selbst (EXCLUDE-Constraint) – hier nur die verständliche Meldung. */
function mapConflict(e: unknown): never {
  const msg = e instanceof Error ? `${e.message} ${JSON.stringify((e as { meta?: unknown }).meta ?? '')}` : '';
  if (msg.includes('appointments_no_overlap_per_expert')) throw new DomainError('Der Sachverständige hat in dieser Zeit bereits einen Termin.', 'conflict');
  // Zwei gleichzeitige Buchungen können sich im Index gegenseitig sperren (Deadlock): eine gewinnt, die andere bekommt diese Meldung.
  if (msg.includes('write conflict or a deadlock') || (e as { code?: string })?.code === 'P2034') throw new DomainError('Der Termin wurde gerade parallel gebucht. Bitte erneut versuchen.', 'conflict');
  throw e;
}

/** Ein aktiver Besichtigungstermin bedeutet „Termin vereinbart“; ohne ihn fällt der Fall auf „Termin offen“ zurück. */
async function syncCaseStatus(tx: Tx, user: AuthUser, caseId: string, reason: string) {
  const c = await tx.case.findUnique({ where: { id: caseId }, select: { status: true } });
  if (!c) return;
  const active = await tx.appointment.count({ where: { caseId, kind: 'INSPECTION', status: { in: [...ACTIVE] } } });
  let to: 'APPOINTMENT_SET' | 'APPOINTMENT_PENDING' | null = null;
  if (active > 0 && (c.status === 'NEW' || c.status === 'APPOINTMENT_PENDING')) to = 'APPOINTMENT_SET';
  if (active === 0 && c.status === 'APPOINTMENT_SET') to = 'APPOINTMENT_PENDING';
  if (!to) return;
  await tx.case.update({ where: { id: caseId }, data: { status: to } });
  await tx.caseStatusHistory.create({ data: { caseId, fromStatus: c.status, toStatus: to, actorId: user.id, reason } });
  await writeAudit({ actorId: user.id, action: 'case.status_change', entityType: 'Case', entityId: caseId, summary: `Status ${c.status} → ${to} (${reason})`, before: { status: c.status }, after: { status: to } }, tx);
}

export async function createAppointment(user: AuthUser, caseId: string, raw: AppointmentInput) {
  const c = await loadCaseFor(user, caseId, 'write');
  const data = createSchema.parse(raw);
  checkTimes(data.startsAt, data.endsAt);
  // Wer nur eigene Termine darf, plant sich selbst – für fremde Gutachter braucht es das Recht „alle“.
  const canAll = has(user, 'appointments.write.all');
  if (!canAll && !(has(user, 'appointments.write.own') && data.expertId === user.id && c.assignedExpertId === user.id)) throw new ForbiddenError();
  return db.$transaction(async (tx) => {
    await assertAssignableExpert(tx, data.expertId);
    let appt;
    try {
      appt = await tx.appointment.create({ data: { ...data, caseId, createdById: user.id } });
    } catch (e) {
      mapConflict(e);
    }
    await writeAudit({ actorId: user.id, action: 'appointment.create', entityType: 'Case', entityId: caseId, summary: `${KIND_LABELS[data.kind]} geplant`, after: { appointmentId: appt.id, startsAt: appt.startsAt, expertId: data.expertId } }, tx);
    // Ohne zugewiesenen Gutachter übernimmt der Terminpartner den Fall.
    if (!c.assignedExpertId) {
      await tx.case.update({ where: { id: caseId }, data: { assignedExpertId: data.expertId } });
      await writeAudit({ actorId: user.id, action: 'case.assign', entityType: 'Case', entityId: caseId, summary: 'Sachverständiger über Termin zugewiesen', after: { assignedExpertId: data.expertId } }, tx);
    }
    if (data.kind === 'INSPECTION') await syncCaseStatus(tx, user, caseId, 'Termin angelegt');
    return appt;
  });
}

async function loadForWrite(user: AuthUser, id: string) {
  const a = await db.appointment.findUnique({ where: { id }, select: { id: true, caseId: true, expertId: true, kind: true, status: true, startsAt: true, endsAt: true } });
  if (!a) throw notFoundError('Termin');
  const c = await loadCaseFor(user, a.caseId, 'write');
  const ok = has(user, 'appointments.write.all') || (has(user, 'appointments.write.own') && a.expertId === user.id && canOnCase(user, 'appointments', 'write', c));
  if (!ok) throw notFoundError('Termin');
  return a;
}

export async function rescheduleAppointment(user: AuthUser, id: string, raw: AppointmentInput) {
  const a = await loadForWrite(user, id);
  if (a.status !== 'PLANNED' && a.status !== 'CONFIRMED') throw new DomainError('Dieser Termin kann nicht mehr geändert werden.');
  const data = createSchema.parse(raw);
  checkTimes(data.startsAt, data.endsAt);
  if (data.expertId !== a.expertId && !has(user, 'appointments.write.all')) throw new ForbiddenError();
  return db.$transaction(async (tx) => {
    if (data.expertId !== a.expertId) await assertAssignableExpert(tx, data.expertId);
    try {
      await tx.appointment.update({ where: { id }, data });
    } catch (e) {
      mapConflict(e);
    }
    await writeAudit({ actorId: user.id, action: 'appointment.update', entityType: 'Case', entityId: a.caseId, summary: 'Termin geändert', after: { appointmentId: id, startsAt: data.startsAt, expertId: data.expertId } }, tx);
  });
}

const TRANSITIONS: Record<string, readonly string[]> = {
  PLANNED: ['CONFIRMED', 'DONE', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['DONE', 'CANCELLED', 'NO_SHOW'],
  DONE: [], CANCELLED: [], NO_SHOW: [],
};

export async function setAppointmentStatus(user: AuthUser, id: string, to: 'CONFIRMED' | 'DONE' | 'CANCELLED' | 'NO_SHOW', reason?: string | null) {
  const a = await loadForWrite(user, id);
  if (!TRANSITIONS[a.status].includes(to)) throw new DomainError('Dieser Statuswechsel ist nicht möglich.');
  const cleanReason = reason?.trim().slice(0, 300) || null;
  if ((to === 'CANCELLED' || to === 'NO_SHOW') && !cleanReason) throw new DomainError('Bitte einen Grund angeben.');
  return db.$transaction(async (tx) => {
    const res = await tx.appointment.updateMany({ where: { id, status: a.status }, data: { status: to, cancelledReason: to === 'CANCELLED' || to === 'NO_SHOW' ? cleanReason : null } });
    if (res.count !== 1) throw new DomainError('Der Termin wurde gerade von jemand anderem geändert. Bitte neu laden.', 'conflict');
    await writeAudit({ actorId: user.id, action: 'appointment.status_change', entityType: 'Case', entityId: a.caseId, summary: `Termin: ${APPT_LABELS[a.status]} → ${APPT_LABELS[to]}`, after: { appointmentId: id, status: to } }, tx);
    if (a.kind === 'INSPECTION' && (to === 'CANCELLED' || to === 'NO_SHOW')) await syncCaseStatus(tx, user, a.caseId, to === 'CANCELLED' ? 'Termin abgesagt' : 'Termin nicht wahrgenommen');
  });
}

/* ------------------------------------------------------------------ Abfragen */

export type AppointmentQuery = { from: Date; to: Date; expertId?: string; caseId?: string; includeCancelled?: boolean };

const select = {
  id: true, kind: true, status: true, startsAt: true, endsAt: true, location: true, notes: true, cancelledReason: true, caseId: true, expertId: true,
  expert: { select: { id: true, firstName: true, lastName: true } },
  case: { select: { id: true, caseNumber: true, status: true, assignedExpertId: true, inspectionLocation: true, customer: { select: { firstName: true, lastName: true, company: true, phone: true } }, vehicle: { select: { manufacturer: true, model: true, licensePlate: true } } } },
  inspection: { select: { id: true, status: true } },
} as const;

export async function listAppointments(user: AuthUser, q: AppointmentQuery) {
  const all = has(user, 'appointments.read.all');
  if (!all && !has(user, 'appointments.read.own')) throw new ForbiddenError();
  const where: Prisma.AppointmentWhereInput = {
    startsAt: { lt: q.to },
    endsAt: { gt: q.from },
    ...(all ? {} : { expertId: user.id }),
    ...(q.expertId && all ? { expertId: q.expertId } : {}),
    ...(q.caseId ? { caseId: q.caseId } : {}),
    ...(q.includeCancelled ? {} : { status: { notIn: ['CANCELLED', 'NO_SHOW'] } }),
    case: { deletedAt: null },
  };
  return db.appointment.findMany({ where, orderBy: { startsAt: 'asc' }, select, take: 500 });
}

export async function caseAppointments(user: AuthUser, caseId: string) {
  const c = await loadCaseFor(user, caseId, 'read');
  if (!canOnCase(user, 'appointments', 'read', c)) throw new ForbiddenError();
  return db.appointment.findMany({ where: { caseId: c.id }, orderBy: { startsAt: 'desc' }, select, take: 100 });
}

export async function getAppointment(user: AuthUser, id: string) {
  const a = await db.appointment.findUnique({ where: { id }, select });
  if (!a) throw notFoundError('Termin');
  const c = await loadCaseFor(user, a.caseId, 'read');
  if (!canOnCase(user, 'appointments', 'read', c)) throw notFoundError('Termin');
  return a;
}

/** Alle Termine der Fälle eines Kunden (Büro: alle, Experte: nur eigene). */
export async function customerAppointments(user: AuthUser, customerId: string) {
  const all = has(user, 'appointments.read.all');
  if (!all && !has(user, 'appointments.read.own')) throw new ForbiddenError();
  return db.appointment.findMany({
    where: { case: { customerId, deletedAt: null }, ...(all ? {} : { expertId: user.id }) },
    orderBy: { startsAt: 'desc' }, select, take: 100,
  });
}
