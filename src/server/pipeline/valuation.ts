import 'server-only';
import { z } from 'zod';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import type { AuthUser } from '@/server/auth/session-types';
import { ForbiddenError } from '@/server/auth/errors';
import { DomainError, notFoundError } from '@/server/errors';
import { IS_MONEY, VALUATION_TYPES, TYPE_LABELS, comparableStats, decide, usageLossTotal, type DecisionResult, type TaxModeKey, type ValuationTypeKey } from '@/lib/valuation';
import { canOnCase, loadCaseFor } from './case-access';
import { listCalculations } from './calculations';

async function readable(user: AuthUser, caseId: string) {
  const c = await loadCaseFor(user, caseId, 'read');
  if (!canOnCase(user, 'valuations', 'read', c)) throw new ForbiddenError();
  return c;
}
async function writable(user: AuthUser, caseId: string) {
  const c = await loadCaseFor(user, caseId, 'write');
  if (!canOnCase(user, 'valuations', 'write', c)) throw new ForbiddenError();
  return c;
}

export type EntryDto = {
  id: string; type: ValuationTypeKey; label: string | null; amountCents: number | null; days: number | null; taxMode: TaxModeKey; source: string; sourceRef: string | null;
  referenceDate: string | null; validUntil: string | null; note: string | null; selected: boolean; createdAt: Date; withdrawn: boolean; byName: string | null;
};
export type ComparableDto = { id: string; title: string; priceCents: number; mileage: number | null; firstReg: string | null; location: string | null; sourceRef: string | null; seenOn: string | null; note: string | null; included: boolean };

const d10 = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function caseValuation(user: AuthUser, caseId: string) {
  await readable(user, caseId);
  const [entries, comps, calcs, vatRow] = await Promise.all([
    db.valuationEntry.findMany({ where: { caseId }, orderBy: [{ createdAt: 'desc' }], include: {} }),
    db.valuationComparable.findMany({ where: { caseId, deletedAt: null }, orderBy: { createdAt: 'asc' } }),
    listCalculations(user, caseId).catch(() => []),
    Promise.resolve(null),
  ]);
  void vatRow;
  const users = await db.user.findMany({ where: { id: { in: [...new Set(entries.map((e) => e.createdById).filter(Boolean) as string[])] } }, select: { id: true, firstName: true, lastName: true } });
  const name = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
  const dto: EntryDto[] = entries.map((e) => ({
    id: e.id, type: e.type, label: e.label, amountCents: e.amountCents, days: e.days, taxMode: e.taxMode, source: e.source, sourceRef: e.sourceRef, referenceDate: d10(e.referenceDate), validUntil: d10(e.validUntil),
    note: e.note, selected: e.selected && !e.withdrawnAt, createdAt: e.createdAt, withdrawn: Boolean(e.withdrawnAt), byName: e.createdById ? name.get(e.createdById) ?? null : null,
  }));
  const comparables: ComparableDto[] = comps.map((c) => ({ id: c.id, title: c.title, priceCents: c.priceCents, mileage: c.mileage, firstReg: d10(c.firstReg), location: c.location, sourceRef: c.sourceRef, seenOn: d10(c.seenOn), note: c.note, included: c.included }));
  const sel = (t: ValuationTypeKey) => dto.find((e) => e.type === t && e.selected) ?? null;
  // Reparaturkosten: die neueste freigegebene Kalkulation, sonst der Entwurf (dann ausdrücklich als vorläufig gekennzeichnet)
  const finals = calcs.filter((c) => c.status === 'FINAL');
  const calc = finals.at(-1) ?? calcs.at(-1) ?? null;
  return { entries: dto, comparables, stats: comparableStats(comps), selected: Object.fromEntries(VALUATION_TYPES.map((t) => [t, sel(t)])) as Record<ValuationTypeKey, EntryDto | null>, calc: calc ? { version: calc.version, status: calc.status, netCents: calc.totals.net, grossCents: calc.totals.gross, vatBp: calc.head.vatBp, minutes: calc.totals.minutes } : null };
}

/** Auswertung aus den gewählten Einträgen und der Kalkulation. `basis` = Steuerbasis des Vergleichs. */
export async function evaluate(user: AuthUser, caseId: string, basis: TaxModeKey = 'GROSS', limitBp = 13000): Promise<{ decision: DecisionResult; usageTotal: number | null; calcVersion: number | null; calcDraft: boolean }> {
  const v = await caseValuation(user, caseId);
  const s = v.selected;
  const repair = v.calc ? (basis === 'NET' ? v.calc.netCents : v.calc.grossCents) : null;
  const wbw = s.REPLACEMENT_VALUE?.amountCents != null ? { cents: s.REPLACEMENT_VALUE.amountCents, tax: s.REPLACEMENT_VALUE.taxMode } : null;
  const rw = s.RESIDUAL_VALUE?.amountCents != null ? { cents: s.RESIDUAL_VALUE.amountCents, tax: s.RESIDUAL_VALUE.taxMode } : null;
  return {
    decision: decide({ repairCents: repair, replacement: wbw, residual: rw, basis, vatBp: v.calc?.vatBp ?? 1900, limitBp }),
    usageTotal: usageLossTotal(s.REPAIR_DURATION?.days ?? null, s.USAGE_LOSS?.amountCents ?? null),
    calcVersion: v.calc?.version ?? null, calcDraft: v.calc?.status === 'DRAFT',
  };
}

const entrySchema = z.object({
  type: z.enum(VALUATION_TYPES),
  label: z.string().trim().max(120).optional().nullable().transform((v) => v || null),
  amountCents: z.number().int().min(0).max(100_000_000_000).nullable().optional(),
  days: z.number().int().min(0).max(3650).nullable().optional(),
  taxMode: z.enum(['GROSS', 'NET', 'NONE']).default('GROSS'),
  source: z.string().trim().min(1).max(40).default('MANUAL'),
  sourceRef: z.string().trim().max(300).optional().nullable().transform((v) => v || null),
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal('')).transform((v) => v || null),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal('')).transform((v) => v || null),
  note: z.string().trim().max(1000).optional().nullable().transform((v) => v || null),
  select: z.boolean().optional(),
}).superRefine((v, ctx) => {
  if (IS_MONEY[v.type] && v.amountCents == null) ctx.addIssue({ code: 'custom', path: ['amountCents'], message: 'Bitte einen Betrag angeben.' });
  if (!IS_MONEY[v.type] && v.days == null) ctx.addIssue({ code: 'custom', path: ['days'], message: 'Bitte die Dauer in Tagen angeben.' });
  if (v.type === 'RESIDUAL_OFFER' && !v.label) ctx.addIssue({ code: 'custom', path: ['label'], message: 'Bitte den Bieter angeben.' });
  if (v.type === 'REPLACEMENT_VALUE' && v.source === 'MANUAL' && !v.referenceDate) ctx.addIssue({ code: 'custom', path: ['referenceDate'], message: 'Bitte das Stichtagsdatum der Bewertung angeben.' });
});

/** Neuer Wert. Standardmäßig wird er für seinen Typ „gewählt“ (der bisher gewählte bleibt als Verlauf erhalten, ist aber nicht mehr gewählt). */
export async function addEntry(user: AuthUser, caseId: string, raw: unknown) {
  await writable(user, caseId);
  const data = entrySchema.parse(raw);
  const { select, ...rest } = data;
  const choose = select ?? data.type !== 'RESIDUAL_OFFER';
  return db.$transaction(async (tx) => {
    if (choose) await tx.valuationEntry.updateMany({ where: { caseId, type: data.type, selected: true }, data: { selected: false } });
    const e = await tx.valuationEntry.create({
      data: { caseId, type: rest.type, label: rest.label, amountCents: rest.amountCents ?? null, days: rest.days ?? null, taxMode: rest.taxMode, source: rest.source, sourceRef: rest.sourceRef,
        referenceDate: rest.referenceDate ? new Date(`${rest.referenceDate}T00:00:00Z`) : null, validUntil: rest.validUntil ? new Date(`${rest.validUntil}T00:00:00Z`) : null, note: rest.note, selected: choose, createdById: user.id },
    });
    await writeAudit({ actorId: user.id, action: 'valuation.add', entityType: 'Case', entityId: caseId, summary: `${TYPE_LABELS[data.type]} erfasst`, after: { entryId: e.id, type: data.type, amountCents: e.amountCents, days: e.days, source: e.source } }, tx);
    return e;
  });
}

export async function selectEntry(user: AuthUser, entryId: string) {
  const e = await db.valuationEntry.findUnique({ where: { id: entryId } });
  if (!e || e.withdrawnAt) throw notFoundError('Eintrag');
  await writable(user, e.caseId);
  await db.$transaction(async (tx) => {
    await tx.valuationEntry.updateMany({ where: { caseId: e.caseId, type: e.type, selected: true }, data: { selected: false } });
    await tx.valuationEntry.update({ where: { id: entryId }, data: { selected: true } });
    await writeAudit({ actorId: user.id, action: 'valuation.select', entityType: 'Case', entityId: e.caseId, summary: `${TYPE_LABELS[e.type]}: anderen Wert gewählt`, after: { entryId } }, tx);
  });
}

/** „Zurückziehen“ statt Löschen: der Eintrag bleibt im Verlauf sichtbar. */
export async function withdrawEntry(user: AuthUser, entryId: string) {
  const e = await db.valuationEntry.findUnique({ where: { id: entryId } });
  if (!e || e.withdrawnAt) throw notFoundError('Eintrag');
  await writable(user, e.caseId);
  await db.$transaction(async (tx) => {
    await tx.valuationEntry.update({ where: { id: entryId }, data: { withdrawnAt: new Date(), withdrawnById: user.id, selected: false } });
    await writeAudit({ actorId: user.id, action: 'valuation.withdraw', entityType: 'Case', entityId: e.caseId, summary: `${TYPE_LABELS[e.type]} zurückgezogen`, after: { entryId } }, tx);
  });
}

const compSchema = z.object({
  title: z.string().trim().min(2, 'Bitte eine Bezeichnung angeben.').max(160),
  priceCents: z.number().int().min(1, 'Bitte einen Preis angeben.').max(100_000_000_000),
  mileage: z.number().int().min(0).max(3_000_000).nullable().optional(),
  firstReg: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal('')).transform((v) => v || null),
  location: z.string().trim().max(120).optional().nullable().transform((v) => v || null),
  sourceRef: z.string().trim().max(300).optional().nullable().transform((v) => v || null),
  seenOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal('')).transform((v) => v || null),
  note: z.string().trim().max(500).optional().nullable().transform((v) => v || null),
});
export async function addComparable(user: AuthUser, caseId: string, raw: unknown) {
  await writable(user, caseId);
  const d = compSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const c = await tx.valuationComparable.create({ data: { caseId, title: d.title, priceCents: d.priceCents, mileage: d.mileage ?? null, firstReg: d.firstReg ? new Date(`${d.firstReg}T00:00:00Z`) : null, location: d.location, sourceRef: d.sourceRef, seenOn: d.seenOn ? new Date(`${d.seenOn}T00:00:00Z`) : null, note: d.note, createdById: user.id } });
    await writeAudit({ actorId: user.id, action: 'valuation.comparable_add', entityType: 'Case', entityId: caseId, summary: 'Vergleichsfahrzeug erfasst', after: { comparableId: c.id, priceCents: c.priceCents } }, tx);
    return c;
  });
}
export async function setComparable(user: AuthUser, id: string, patch: { included?: boolean; remove?: boolean }) {
  const c = await db.valuationComparable.findUnique({ where: { id } });
  if (!c || c.deletedAt) throw notFoundError('Vergleichsfahrzeug');
  await writable(user, c.caseId);
  await db.$transaction(async (tx) => {
    await tx.valuationComparable.update({ where: { id }, data: patch.remove ? { deletedAt: new Date() } : { included: patch.included ?? c.included } });
    await writeAudit({ actorId: user.id, action: patch.remove ? 'valuation.comparable_remove' : 'valuation.comparable_update', entityType: 'Case', entityId: c.caseId, summary: patch.remove ? 'Vergleichsfahrzeug entfernt' : 'Vergleichsfahrzeug geändert', after: { comparableId: id } }, tx);
  });
}

export { DomainError };
