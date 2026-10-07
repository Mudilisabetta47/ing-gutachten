import 'server-only';
import { z } from 'zod';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import type { AuthUser } from '@/server/auth/session-types';
import { ForbiddenError } from '@/server/auth/errors';
import { DomainError, notFoundError } from '@/server/errors';
import { has } from './access';
import { canOnCase, loadCaseFor } from './case-access';

const metaSchema = z.object({
  weather: z.string().trim().max(120).optional().nullable().transform((v) => v || null),
  odometer: z.union([z.string(), z.number()]).optional().nullable().transform((v) => (v === '' || v == null ? null : Number(String(v).replace(/\./g, '')))).refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 3_000_000), 'Bitte einen gültigen Kilometerstand angeben.'),
  note: z.string().trim().max(4000).optional().nullable().transform((v) => v || null),
});

async function loadAppointment(user: AuthUser, appointmentId: string) {
  const a = await db.appointment.findUnique({ where: { id: appointmentId }, select: { id: true, caseId: true, expertId: true, kind: true, status: true } });
  if (!a) throw notFoundError('Termin');
  const c = await loadCaseFor(user, a.caseId, 'write');
  const ok = has(user, 'appointments.write.all') || (has(user, 'appointments.write.own') && a.expertId === user.id && canOnCase(user, 'appointments', 'write', c));
  if (!ok) throw notFoundError('Termin');
  return a;
}

/** Besichtigung beginnen (idempotent): legt das Protokoll an, falls es noch keines gibt. */
export async function startInspection(user: AuthUser, appointmentId: string) {
  const a = await loadAppointment(user, appointmentId);
  if (a.kind !== 'INSPECTION') throw new DomainError('Nur Besichtigungstermine haben ein Protokoll.');
  if (a.status === 'CANCELLED' || a.status === 'NO_SHOW') throw new DomainError('Dieser Termin ist abgesagt.');
  const existing = await db.inspection.findUnique({ where: { appointmentId } });
  if (existing) return existing;
  return db.$transaction(async (tx) => {
    const ins = await tx.inspection.create({ data: { appointmentId, caseId: a.caseId, startedById: user.id } });
    await writeAudit({ actorId: user.id, action: 'inspection.start', entityType: 'Case', entityId: a.caseId, summary: 'Besichtigung begonnen', after: { inspectionId: ins.id } }, tx);
    return ins;
  });
}

export async function updateInspection(user: AuthUser, appointmentId: string, raw: unknown) {
  await loadAppointment(user, appointmentId);
  const data = metaSchema.parse(raw);
  const ins = await db.inspection.findUnique({ where: { appointmentId } });
  if (!ins) throw notFoundError('Besichtigung');
  if (ins.status === 'FINISHED') throw new DomainError('Die Besichtigung ist bereits abgeschlossen.');
  await db.inspection.update({ where: { id: ins.id }, data });
}

/**
 * Besichtigung abschließen: Protokoll fertig, Termin erledigt, Fall „Besichtigt“ (wenn er auf „Termin vereinbart“ stand).
 * Alles in einer Transaktion.
 */
export async function finishInspection(user: AuthUser, appointmentId: string, raw?: unknown) {
  const a = await loadAppointment(user, appointmentId);
  const data = raw ? metaSchema.parse(raw) : {};
  return db.$transaction(async (tx) => {
    const ins = await tx.inspection.findUnique({ where: { appointmentId } });
    if (!ins) throw new DomainError('Die Besichtigung wurde noch nicht begonnen.');
    if (ins.status === 'FINISHED') throw new DomainError('Die Besichtigung ist bereits abgeschlossen.', 'conflict');
    await tx.inspection.update({ where: { id: ins.id }, data: { ...data, status: 'FINISHED', finishedAt: new Date() } });
    await tx.appointment.updateMany({ where: { id: appointmentId, status: { in: ['PLANNED', 'CONFIRMED'] } }, data: { status: 'DONE' } });
    const c = await tx.case.findUnique({ where: { id: a.caseId }, select: { status: true } });
    if (c?.status === 'APPOINTMENT_SET') {
      await tx.case.update({ where: { id: a.caseId }, data: { status: 'INSPECTED' } });
      await tx.caseStatusHistory.create({ data: { caseId: a.caseId, fromStatus: 'APPOINTMENT_SET', toStatus: 'INSPECTED', actorId: user.id, reason: 'Besichtigung abgeschlossen' } });
      await writeAudit({ actorId: user.id, action: 'case.status_change', entityType: 'Case', entityId: a.caseId, summary: 'Status APPOINTMENT_SET → INSPECTED (Besichtigung abgeschlossen)', before: { status: 'APPOINTMENT_SET' }, after: { status: 'INSPECTED' } }, tx);
    }
    await writeAudit({ actorId: user.id, action: 'inspection.finish', entityType: 'Case', entityId: a.caseId, summary: 'Besichtigung abgeschlossen', after: { inspectionId: ins.id } }, tx);
  });
}

export async function getInspection(user: AuthUser, appointmentId: string) {
  const a = await db.appointment.findUnique({ where: { id: appointmentId }, select: { caseId: true } });
  if (!a) throw notFoundError('Termin');
  const c = await loadCaseFor(user, a.caseId, 'read');
  if (!canOnCase(user, 'appointments', 'read', c)) throw new ForbiddenError();
  return db.inspection.findUnique({ where: { appointmentId } });
}
