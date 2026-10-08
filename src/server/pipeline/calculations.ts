import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import type { AuthUser } from '@/server/auth/session-types';
import { ForbiddenError } from '@/server/auth/errors';
import { DomainError, notFoundError } from '@/server/errors';
import { CALC_KINDS, LABOR_CATEGORIES, totals, type CalcHeader, type CalcKind, type CalcLine, type CalcTotals, type LaborCategory } from '@/lib/calc';
import { PART_BY_ID } from '@/lib/vehicle-model';
import { canOnCase, loadCaseFor } from './case-access';

/* ------------------------------------------------------------ Zugriff */

async function readable(user: AuthUser, caseId: string) {
  const c = await loadCaseFor(user, caseId, 'read');
  if (!canOnCase(user, 'calculations', 'read', c)) throw new ForbiddenError();
  return c;
}
async function writable(user: AuthUser, caseId: string) {
  const c = await loadCaseFor(user, caseId, 'write');
  if (!canOnCase(user, 'calculations', 'write', c)) throw new ForbiddenError();
  return c;
}

export type CalcItemDto = CalcLine & {
  id: string; ref: string; position: number; description: string; partNumber: string | null; partId: string | null; damageId: string | null;
  priceSource: string | null; priceDate: string | null; note: string | null;
};
export type CalcDto = {
  id: string; caseId: string; version: number; status: 'DRAFT' | 'FINAL'; title: string | null; note: string | null; ratesSource: string | null;
  head: CalcHeader; items: CalcItemDto[]; totals: CalcTotals; finalizedAt: Date | null; updatedAt: Date; createdAt: Date;
};

type Row = Prisma.CalculationGetPayload<{ include: { items: true } }>;

export const headOf = (r: Pick<Row, 'vatBp' | 'minutesPerAw' | 'rateBodyCents' | 'rateMechanicCents' | 'rateElectricCents' | 'ratePaintCents' | 'partsMarkupBp' | 'paintMaterialBp'>): CalcHeader => ({
  vatBp: r.vatBp, minutesPerAw: r.minutesPerAw, partsMarkupBp: r.partsMarkupBp, paintMaterialBp: r.paintMaterialBp,
  rates: { body: r.rateBodyCents, mechanic: r.rateMechanicCents, electric: r.rateElectricCents, paint: r.ratePaintCents },
});

export function toDto(r: Row): CalcDto {
  const items: CalcItemDto[] = [...r.items].sort((a, b) => a.position - b.position).map((i) => ({
    id: i.id, ref: i.ref, position: i.position, kind: i.kind, laborCategory: (i.laborCategory as LaborCategory | null), description: i.description, partNumber: i.partNumber,
    partId: i.partId, damageId: i.damageId, quantityX100: i.quantityX100, minutes: i.minutes, unitPriceCents: i.unitPriceCents, discountBp: i.discountBp,
    priceSource: i.priceSource, priceDate: i.priceDate ? i.priceDate.toISOString().slice(0, 10) : null, note: i.note,
  }));
  const head = headOf(r);
  return { id: r.id, caseId: r.caseId, version: r.version, status: r.status, title: r.title, note: r.note, ratesSource: r.ratesSource, head, items, totals: totals(items, head), finalizedAt: r.finalizedAt, updatedAt: r.updatedAt, createdAt: r.createdAt };
}

/* ------------------------------------------------------------ Lesen */

export async function listCalculations(user: AuthUser, caseId: string): Promise<CalcDto[]> {
  await readable(user, caseId);
  const rows = await db.calculation.findMany({ where: { caseId }, orderBy: { version: 'asc' }, include: { items: true } });
  return rows.map(toDto);
}

/** Stundensätze und Aufschläge aus der Werkstatt des Falls (Stammdaten). Es werden keine Marktwerte vorgegeben. */
export async function defaultRates(caseId: string): Promise<Pick<Prisma.CalculationUncheckedCreateInput, 'rateBodyCents' | 'rateMechanicCents' | 'rateElectricCents' | 'ratePaintCents' | 'partsMarkupBp' | 'paintMaterialBp' | 'ratesSource'>> {
  const c = await db.case.findUnique({ where: { id: caseId }, select: { workshopOrg: { select: { name: true, rateBodyCents: true, rateMechanicCents: true, rateElectricCents: true, ratePaintCents: true, partsMarkupBp: true, paintMaterialBp: true } } } });
  const w = c?.workshopOrg;
  if (!w) return { ratesSource: 'manuell' };
  return { rateBodyCents: w.rateBodyCents, rateMechanicCents: w.rateMechanicCents, rateElectricCents: w.rateElectricCents, ratePaintCents: w.ratePaintCents, partsMarkupBp: w.partsMarkupBp ?? 0, paintMaterialBp: w.paintMaterialBp ?? 0, ratesSource: `Werkstatt: ${w.name}` };
}

/* ------------------------------------------------------------ Vorschlag aus Schäden */

export type SuggestedItem = Pick<CalcLine, 'kind' | 'laborCategory' | 'quantityX100' | 'minutes' | 'unitPriceCents' | 'discountBp'> & { description: string; partId: string | null; damageId: string; note: string | null };

/**
 * Aus den erfassten Schäden werden Positionen VORGESCHLAGEN – ohne Zeiten und Preise (die kommen vom Gutachter bzw. aus Quellen).
 * Nur aktuelle Schäden mit Maßnahme; Vorschäden, Gebrauchsspuren und Repariertes werden nicht berechnet.
 */
export function suggestItems(damages: { id: string; component: string; partId: string | null; kind: string; repairKind: string | null }[]): SuggestedItem[] {
  const out: SuggestedItem[] = [];
  const base = { quantityX100: 100, minutes: 0, unitPriceCents: 0, discountBp: 0 };
  for (const d of damages) {
    if (d.kind !== 'CURRENT' || !d.repairKind) continue;
    const label = d.partId ? PART_BY_ID[d.partId]?.label ?? d.component : d.component;
    const mk = (kind: CalcKind, text: string, laborCategory: LaborCategory | null = null): SuggestedItem => ({ ...base, kind, laborCategory, description: text, partId: d.partId, damageId: d.id, note: null });
    switch (d.repairKind) {
      case 'Ersetzen': out.push(mk('PART', label), mk('LABOR', `${label} aus-/einbauen`, 'BODY'), mk('PAINT', `${label} lackieren`)); break;
      case 'Lackieren': out.push(mk('PAINT', `${label} lackieren`)); break;
      case 'Instandsetzen': case 'Ausbeulen': case 'Richten': out.push(mk('LABOR', `${label} ${d.repairKind === 'Instandsetzen' ? 'instandsetzen' : d.repairKind === 'Ausbeulen' ? 'ausbeulen' : 'richten'}`, 'BODY'), mk('PAINT', `${label} lackieren`)); break;
      default: break; // „Keine Reparatur“, „Zu prüfen“
    }
  }
  return out;
}

/* ------------------------------------------------------------ Schreiben */

const int = (min: number, max: number) => z.number().int().min(min).max(max);
const itemSchema = z.object({
  ref: z.string().trim().min(8).max(60).optional(),
  kind: z.enum(CALC_KINDS),
  laborCategory: z.enum(LABOR_CATEGORIES).nullable().optional(),
  description: z.string().trim().min(1, 'Bitte jede Position bezeichnen.').max(200),
  partNumber: z.string().trim().max(60).nullable().optional().transform((v) => v || null),
  partId: z.string().trim().max(40).nullable().optional().transform((v) => v || null),
  damageId: z.string().trim().max(40).nullable().optional().transform((v) => v || null),
  quantityX100: int(0, 10_000_000), minutes: int(0, 100_000), unitPriceCents: int(0, 1_000_000_000), discountBp: int(0, 10_000),
  priceSource: z.string().trim().max(80).nullable().optional().transform((v) => v || null),
  priceDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal('')).transform((v) => v || null),
  note: z.string().trim().max(500).nullable().optional().transform((v) => v || null),
});
const rate = int(0, 100_000).nullable();
export const calcSchema = z.object({
  title: z.string().trim().max(120).nullable().optional().transform((v) => v || null),
  note: z.string().trim().max(2000).nullable().optional().transform((v) => v || null),
  vatBp: int(0, 3000), minutesPerAw: int(1, 60), rateBodyCents: rate, rateMechanicCents: rate, rateElectricCents: rate, ratePaintCents: rate,
  partsMarkupBp: int(0, 10_000), paintMaterialBp: int(0, 10_000), ratesSource: z.string().trim().max(120).nullable().optional().transform((v) => v || null),
  items: z.array(itemSchema).max(300, 'Höchstens 300 Positionen.'),
});
export type CalcInput = z.input<typeof calcSchema>;

export async function createCalculation(user: AuthUser, caseId: string, opts: { fromVersion?: number } = {}) {
  await writable(user, caseId);
  return db.$transaction(async (tx) => {
    const all = await tx.calculation.findMany({ where: { caseId }, orderBy: { version: 'desc' }, include: { items: true } });
    if (all.some((c) => c.status === 'DRAFT')) throw new DomainError('Es gibt bereits einen Entwurf. Bitte zuerst diesen bearbeiten oder freigeben.', 'conflict');
    const src = opts.fromVersion ? all.find((c) => c.version === opts.fromVersion) : all[0];
    if (opts.fromVersion && !src) throw notFoundError('Version');
    const version = (all[0]?.version ?? 0) + 1;
    const defaults = src ? null : await defaultRates(caseId);
    const calc = await tx.calculation.create({
      data: src
        ? {
            caseId, version, status: 'DRAFT', createdById: user.id, title: src.title, note: src.note, vatBp: src.vatBp, minutesPerAw: src.minutesPerAw, rateBodyCents: src.rateBodyCents, rateMechanicCents: src.rateMechanicCents,
            rateElectricCents: src.rateElectricCents, ratePaintCents: src.ratePaintCents, partsMarkupBp: src.partsMarkupBp, paintMaterialBp: src.paintMaterialBp, ratesSource: src.ratesSource,
            items: { create: src.items.map((i) => ({ ref: i.ref, position: i.position, kind: i.kind, laborCategory: i.laborCategory, description: i.description, partNumber: i.partNumber, partId: i.partId, damageId: i.damageId, quantityX100: i.quantityX100, minutes: i.minutes, unitPriceCents: i.unitPriceCents, discountBp: i.discountBp, priceSource: i.priceSource, priceDate: i.priceDate, note: i.note })) },
          }
        : { caseId, version, status: 'DRAFT', createdById: user.id, ...defaults },
      include: { items: true },
    });
    await writeAudit({ actorId: user.id, action: 'calculation.create', entityType: 'Case', entityId: caseId, summary: `Kalkulation Version ${version} angelegt${src ? ` (Kopie von V${src.version})` : ''}`, after: { calculationId: calc.id, version } }, tx);
    return toDto(calc);
  });
}

/** Speichert den Entwurf komplett (Kopf + alle Positionen) in einer Transaktion. `token` = `updatedAt` aus dem Laden; veraltete Stände werden abgewiesen. */
export async function saveCalculation(user: AuthUser, calcId: string, raw: unknown, token?: string) {
  const c = await db.calculation.findUnique({ where: { id: calcId }, select: { id: true, caseId: true, status: true, updatedAt: true, version: true } });
  if (!c) throw notFoundError('Kalkulation');
  await writable(user, c.caseId);
  const data = calcSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const cur = await tx.calculation.findUniqueOrThrow({ where: { id: calcId }, select: { status: true, updatedAt: true } });
    if (cur.status !== 'DRAFT') throw new DomainError('Diese Version ist freigegeben und kann nicht mehr geändert werden. Bitte eine neue Version anlegen.', 'conflict');
    if (token && new Date(token).getTime() !== cur.updatedAt.getTime()) throw new DomainError('Die Kalkulation wurde zwischenzeitlich geändert (anderes Fenster oder anderer Benutzer). Bitte die Seite neu laden.', 'conflict');
    const { items, ...head } = data;
    const damageIds = [...new Set(items.map((i) => i.damageId).filter(Boolean) as string[])];
    const valid = damageIds.length ? new Set((await tx.damage.findMany({ where: { id: { in: damageIds }, caseId: c.caseId }, select: { id: true } })).map((d) => d.id)) : new Set<string>();
    await tx.calculationItem.deleteMany({ where: { calculationId: calcId } });
    await tx.calculationItem.createMany({
      data: items.map((i, idx) => ({
        calculationId: calcId, ref: i.ref ?? randomUUID(), position: idx + 1, kind: i.kind, laborCategory: i.kind === 'LABOR' ? i.laborCategory ?? 'BODY' : null,
        description: i.description, partNumber: i.partNumber, partId: i.partId && i.partId in PART_BY_ID ? i.partId : null, damageId: i.damageId && valid.has(i.damageId) ? i.damageId : null,
        quantityX100: i.quantityX100, minutes: i.kind === 'LABOR' || i.kind === 'PAINT' ? i.minutes : 0, unitPriceCents: i.kind === 'LABOR' || i.kind === 'PAINT' ? 0 : i.unitPriceCents, discountBp: i.discountBp,
        priceSource: i.priceSource, priceDate: i.priceDate ? new Date(`${i.priceDate}T00:00:00Z`) : null, note: i.note,
      })),
    });
    const updated = await tx.calculation.update({ where: { id: calcId }, data: head, include: { items: true } });
    return toDto(updated);
  });
}

export async function finalizeCalculation(user: AuthUser, calcId: string) {
  const c = await db.calculation.findUnique({ where: { id: calcId }, include: { items: true } });
  if (!c) throw notFoundError('Kalkulation');
  await writable(user, c.caseId);
  if (c.status === 'FINAL') throw new DomainError('Diese Version ist bereits freigegeben.', 'conflict');
  if (!c.items.length) throw new DomainError('Eine leere Kalkulation kann nicht freigegeben werden.');
  const dto = toDto(c);
  if (dto.totals.missingRates > 0) throw new DomainError('Für Arbeitspositionen fehlt der Stundensatz. Bitte die Stundensätze eintragen.');
  return db.$transaction(async (tx) => {
    const u = await tx.calculation.update({ where: { id: calcId }, data: { status: 'FINAL', finalizedAt: new Date(), finalizedById: user.id }, include: { items: true } });
    await writeAudit({ actorId: user.id, action: 'calculation.finalize', entityType: 'Case', entityId: c.caseId, summary: `Kalkulation Version ${c.version} freigegeben`, after: { calculationId: calcId, net: dto.totals.net, gross: dto.totals.gross } }, tx);
    return toDto(u);
  });
}

export async function deleteDraft(user: AuthUser, calcId: string) {
  const c = await db.calculation.findUnique({ where: { id: calcId }, select: { id: true, caseId: true, status: true, version: true } });
  if (!c) throw notFoundError('Kalkulation');
  await writable(user, c.caseId);
  if (c.status !== 'DRAFT') throw new DomainError('Freigegebene Versionen können nicht gelöscht werden.', 'conflict');
  await db.$transaction(async (tx) => {
    await tx.calculation.delete({ where: { id: calcId } });
    await writeAudit({ actorId: user.id, action: 'calculation.delete', entityType: 'Case', entityId: c.caseId, summary: `Kalkulationsentwurf Version ${c.version} verworfen` }, tx);
  });
}

/** Schäden → Vorschlagspositionen an den Entwurf anhängen (bereits übernommene Schäden werden nicht doppelt aufgenommen). */
export async function appendFromDamages(user: AuthUser, calcId: string) {
  const c = await db.calculation.findUnique({ where: { id: calcId }, include: { items: true } });
  if (!c) throw notFoundError('Kalkulation');
  await writable(user, c.caseId);
  if (c.status !== 'DRAFT') throw new DomainError('Nur ein Entwurf kann ergänzt werden.', 'conflict');
  const damages = await db.damage.findMany({ where: { caseId: c.caseId, deletedAt: null }, orderBy: { sortOrder: 'asc' }, select: { id: true, component: true, partId: true, kind: true, repairKind: true } });
  const have = new Set(c.items.map((i) => i.damageId).filter(Boolean));
  const add = suggestItems(damages.filter((d) => !have.has(d.id)));
  if (!add.length) return { added: 0, newItems: [] as CalcItemDto[], calc: toDto(c) };
  return db.$transaction(async (tx) => {
    let pos = c.items.reduce((m, i) => Math.max(m, i.position), 0);
    await tx.calculationItem.createMany({ data: add.map((i) => ({ calculationId: calcId, ref: randomUUID(), position: ++pos, kind: i.kind, laborCategory: i.laborCategory, description: i.description, partId: i.partId, damageId: i.damageId, quantityX100: i.quantityX100, minutes: i.minutes, unitPriceCents: i.unitPriceCents, discountBp: i.discountBp })) });
    const u = await tx.calculation.update({ where: { id: calcId }, data: {}, include: { items: true } });
    await writeAudit({ actorId: user.id, action: 'calculation.suggest', entityType: 'Case', entityId: c.caseId, summary: `${add.length} Positionen aus Schäden vorgeschlagen`, after: { calculationId: calcId, count: add.length } }, tx);
    const have2 = new Set(c.items.map((i) => i.id));
    const dto = toDto(u);
    return { added: add.length, newItems: dto.items.filter((i) => !have2.has(i.id)), calc: dto };
  });
}

export { CALC_KINDS };
