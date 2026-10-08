import 'server-only';
import { z } from 'zod';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import type { AuthUser } from '@/server/auth/session-types';
import { ForbiddenError } from '@/server/auth/errors';
import { notFoundError } from '@/server/errors';
import { canSeeCaseInternals } from './access';
import { loadCaseFor } from './case-access';
import { DAMAGE_KINDS, PART_BY_ID, SEVERITIES, VIEW_KEYS } from '@/lib/vehicle-model';

export const DAMAGE_AREAS = ['FRONT', 'REAR', 'LEFT', 'RIGHT', 'ROOF', 'UNDERBODY', 'WHEELS', 'GLASS', 'INTERIOR', 'OTHER'] as const;
export const AREA_LABELS: Record<string, string> = { FRONT: 'Front', REAR: 'Heck', LEFT: 'Links', RIGHT: 'Rechts', ROOF: 'Dach', UNDERBODY: 'Unterboden', WHEELS: 'Räder/Fahrwerk', GLASS: 'Scheiben', INTERIOR: 'Innenraum', OTHER: 'Sonstiges' };
export const DAMAGE_TYPES = ['Kratzer', 'Delle', 'Riss', 'Bruch', 'Verformung', 'Lackschaden', 'Abriss', 'Wasserschaden', 'Sonstiges'] as const;
export const REPAIR_KINDS = ['Instandsetzen', 'Lackieren', 'Ersetzen', 'Ausbeulen', 'Richten', 'Keine Reparatur', 'Zu prüfen'] as const;

const optStr = (n: number) => z.string().trim().max(n).optional().nullable().transform((v) => v || null);

/** Fehlt das Feld ganz (undefined), bleibt der gespeicherte Wert unverändert; leer ("") löscht ihn. */
const keep = (n: number) => z.string().trim().max(n).optional().nullable().transform((v) => (v === undefined ? undefined : v || null));

const base = z.object({
  area: z.preprocess((v) => (v === '' ? undefined : v), z.enum(DAMAGE_AREAS).optional()),
  component: z.string().trim().max(120).optional().nullable().transform((v) => v || null),
  damageType: optStr(60),
  description: optStr(2000),
  repairKind: optStr(60),
  /** Karte: Bauteil, Ansicht, Zustand, Schwere */
  partId: keep(40).refine((v) => v == null || v in PART_BY_ID, 'Unbekanntes Bauteil.'),
  view: keep(20).refine((v) => v == null || (VIEW_KEYS as string[]).includes(v), 'Unbekannte Ansicht.'),
  kind: z.preprocess((v) => (v === '' ? undefined : v), z.enum(DAMAGE_KINDS).optional()),
  severity: z.union([z.enum(SEVERITIES), z.literal('')]).optional().nullable().transform((v) => (v === undefined ? undefined : v || null)),
  priorNote: keep(500),
});

/** Bauteil aus der Karte liefert Name und Bereich; Freitext-Bauteile brauchen beides selbst. */
const schema = base.transform((v, ctx) => {
  const part = v.partId ? PART_BY_ID[v.partId] : null;
  const component = v.component ?? part?.label ?? null;
  const area = v.area ?? (part ? part.area : undefined);
  if (!component) ctx.addIssue({ code: 'custom', path: ['component'], message: 'Bitte das Bauteil angeben.' });
  if (!area) ctx.addIssue({ code: 'custom', path: ['area'], message: 'Bitte den Bereich angeben.' });
  return { ...v, component: component ?? '', area: area ?? 'OTHER' };
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
    await writeAudit({ actorId: user.id, action: 'damage.add', entityType: 'Case', entityId: caseId, summary: `Schaden erfasst (${data.component})`, after: { damageId: d.id, area: data.area, partId: data.partId, kind: data.kind } }, tx);
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
    await writeAudit({ actorId: user.id, action: 'damage.update', entityType: 'Case', entityId: d.caseId, summary: `Schaden bearbeitet (${data.component})`, after: { damageId, kind: data.kind, severity: data.severity } }, tx);
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

/** Verknüpft Fotos mit einem Schaden (ersetzt die bisherige Auswahl). Nur Fotos desselben Falls. */
export async function setDamagePhotos(user: AuthUser, damageId: string, photoIds: string[]) {
  const d = await owned(user, damageId);
  const ids = [...new Set(photoIds)].slice(0, 40);
  return db.$transaction(async (tx) => {
    const valid = ids.length ? await tx.casePhoto.findMany({ where: { id: { in: ids }, caseId: d.caseId, deletedAt: null }, select: { id: true } }) : [];
    await tx.casePhoto.updateMany({ where: { damageId, id: { notIn: valid.map((p) => p.id) } }, data: { damageId: null } });
    if (valid.length) await tx.casePhoto.updateMany({ where: { id: { in: valid.map((p) => p.id) } }, data: { damageId } });
    await writeAudit({ actorId: user.id, action: 'damage.photos', entityType: 'Case', entityId: d.caseId, summary: `Fotos zum Schaden verknüpft (${valid.length})`, after: { damageId, count: valid.length } }, tx);
    return valid.length;
  });
}

export { ForbiddenError };
