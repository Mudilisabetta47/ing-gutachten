import 'server-only';
import { z } from 'zod';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import type { AuthUser } from '@/server/auth/session-types';
import { ForbiddenError } from '@/server/auth/errors';
import { notFoundError } from '@/server/errors';
import { canSeeCaseInternals } from './access';
import { loadCaseFor } from './case-access';

export const DAMAGE_AREAS = ['FRONT', 'REAR', 'LEFT', 'RIGHT', 'ROOF', 'UNDERBODY', 'WHEELS', 'GLASS', 'INTERIOR', 'OTHER'] as const;
export const AREA_LABELS: Record<string, string> = { FRONT: 'Front', REAR: 'Heck', LEFT: 'Links', RIGHT: 'Rechts', ROOF: 'Dach', UNDERBODY: 'Unterboden', WHEELS: 'Räder/Fahrwerk', GLASS: 'Scheiben', INTERIOR: 'Innenraum', OTHER: 'Sonstiges' };
export const DAMAGE_TYPES = ['Kratzer', 'Delle', 'Riss', 'Bruch', 'Verformung', 'Lackschaden', 'Abriss', 'Wasserschaden', 'Sonstiges'] as const;
export const REPAIR_KINDS = ['Instandsetzen', 'Lackieren', 'Ersetzen', 'Ausbeulen', 'Richten', 'Keine Reparatur', 'Zu prüfen'] as const;

const schema = z.object({
  area: z.enum(DAMAGE_AREAS),
  component: z.string().trim().min(1, 'Bitte das Bauteil angeben.').max(120),
  damageType: z.string().trim().max(60).optional().nullable().transform((v) => v || null),
  description: z.string().trim().max(2000).optional().nullable().transform((v) => v || null),
  repairKind: z.string().trim().max(60).optional().nullable().transform((v) => v || null),
});

/** Schäden sind Interna des Falls (wie Unfallhergang): nur mit Bearbeitungsrecht am Fall sichtbar. */
async function writable(user: AuthUser, caseId: string) {
  return loadCaseFor(user, caseId, 'write');
}

export async function listDamages(user: AuthUser, caseId: string) {
  await loadCaseFor(user, caseId, 'read');
  if (!canSeeCaseInternals(user)) return [];
  return db.damage.findMany({ where: { caseId, deletedAt: null }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], include: { _count: { select: { photos: { where: { deletedAt: null } } } } } });
}

export async function addDamage(user: AuthUser, caseId: string, raw: unknown) {
  await writable(user, caseId);
  const data = schema.parse(raw);
  return db.$transaction(async (tx) => {
    const last = await tx.damage.aggregate({ where: { caseId }, _max: { sortOrder: true } });
    const d = await tx.damage.create({ data: { ...data, caseId, sortOrder: (last._max.sortOrder ?? 0) + 1, createdById: user.id } });
    await writeAudit({ actorId: user.id, action: 'damage.add', entityType: 'Case', entityId: caseId, summary: `Schaden erfasst (${AREA_LABELS[data.area]})`, after: { damageId: d.id, area: data.area } }, tx);
    return d;
  });
}

async function owned(user: AuthUser, damageId: string) {
  const d = await db.damage.findFirst({ where: { id: damageId, deletedAt: null }, select: { id: true, caseId: true } });
  if (!d) throw notFoundError('Schaden');
  await writable(user, d.caseId);
  return d;
}

export async function updateDamage(user: AuthUser, damageId: string, raw: unknown) {
  const d = await owned(user, damageId);
  const data = schema.parse(raw);
  await db.$transaction(async (tx) => {
    await tx.damage.update({ where: { id: damageId }, data });
    await writeAudit({ actorId: user.id, action: 'damage.update', entityType: 'Case', entityId: d.caseId, summary: 'Schaden bearbeitet', after: { damageId } }, tx);
  });
}

export async function deleteDamage(user: AuthUser, damageId: string) {
  const d = await owned(user, damageId);
  await db.$transaction(async (tx) => {
    await tx.damage.update({ where: { id: damageId }, data: { deletedAt: new Date() } });
    await tx.casePhoto.updateMany({ where: { damageId }, data: { damageId: null } });
    await writeAudit({ actorId: user.id, action: 'damage.delete', entityType: 'Case', entityId: d.caseId, summary: 'Schaden gelöscht', after: { damageId } }, tx);
  });
}

export { ForbiddenError };
