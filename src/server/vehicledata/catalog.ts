import 'server-only';
import { createHash } from 'node:crypto';
import type { Prisma, VehicleHsnTsn } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import type { AuthUser } from '@/server/auth/session-types';
import { ForbiddenError } from '@/server/auth/errors';
import { DomainError, notFoundError } from '@/server/errors';
import { has } from '@/server/pipeline/access';
import {
  buildSearchText, diffRecords, fillMissing, normalizeFuel, normalizeHsn, normalizeManufacturer, normalizeTsn, parseSearchQuery,
  splitVehicleName, verificationFor, COMPARE_LABELS, type CompareField, type LicenseKey, type VerificationKey,
} from '@/lib/vehicle-data';
import { IMPORTER_VERSION, type NormalizedVehicle } from './html-parser';

type Tx = Prisma.TransactionClient;
export const STALE_DAYS = 365;

/* ------------------------------------------------------------ Hilfen */

export const requireRead = (u: AuthUser) => { if (!has(u, 'vehicledata.read')) throw new ForbiddenError(); };
export const requireWrite = (u: AuthUser) => { if (!has(u, 'vehicledata.write')) throw new ForbiddenError(); };
export const requireManage = (u: AuthUser) => { if (!has(u, 'vehicledata.manage')) throw new ForbiddenError(); };

/** Für den Browser: nur Anzeigefelder, Datumswerte als ISO-Text. */
export type RecordDto = {
  id: string; hsn: string; tsn: string; manufacturer: string | null; model: string | null; generation: string | null; variant: string | null;
  vehicleNameRaw: string | null; bodyStyle: string | null; engineName: string | null; engineCode: string | null; fuelType: string | null;
  displacementCc: number | null; powerKw: number | null; powerHp: number | null; torqueNm: number | null; transmission: string | null; driveType: string | null;
  productionFrom: string | null; productionTo: string | null; vehicleClass: string | null; typeApproval: string | null;
  source: string; sourceUrl: string | null; verificationStatus: VerificationKey; lastCheckedAt: string | null; stale: boolean;
  openConflicts?: { id: string; fields: CompareField[]; incomingSource: string; own: Partial<Record<CompareField, string | null>>; incoming: Partial<Record<CompareField, string | null>> }[];
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const dateOnly = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export function toDto(r: VehicleHsnTsn): RecordDto {
  const checked = r.sourceLastCheckedAt ?? r.sourceImportedAt ?? r.updatedAt;
  const stale = r.source !== 'MANUAL' && Date.now() - checked.getTime() > STALE_DAYS * 86_400_000;
  return {
    id: r.id, hsn: r.hsn, tsn: r.tsn, manufacturer: r.manufacturer, model: r.model, generation: r.generation, variant: r.variant,
    vehicleNameRaw: r.vehicleNameRaw, bodyStyle: r.bodyStyle, engineName: r.engineName, engineCode: r.engineCode, fuelType: r.fuelType,
    displacementCc: r.displacementCc, powerKw: r.powerKw, powerHp: r.powerHp, torqueNm: r.torqueNm, transmission: r.transmission, driveType: r.driveType,
    productionFrom: dateOnly(r.productionFrom), productionTo: dateOnly(r.productionTo), vehicleClass: r.vehicleClass, typeApproval: r.typeApproval,
    source: r.source, sourceUrl: r.sourceUrl, verificationStatus: stale && r.verificationStatus !== 'CONFLICT' ? 'OUTDATED' : (r.verificationStatus as VerificationKey), lastCheckedAt: iso(checked), stale,
  };
}

const hashOf = (v: Pick<NormalizedVehicle, 'hsn' | 'tsn' | 'manufacturerNameRaw' | 'vehicleNameRaw' | 'powerKw' | 'powerHp' | 'displacementCc' | 'fuelType'>) =>
  createHash('sha256').update(JSON.stringify([v.hsn, v.tsn, v.manufacturerNameRaw, v.vehicleNameRaw, v.powerKw, v.powerHp, v.displacementCc, v.fuelType])).digest('hex');

/** Namen aus dem Katalog holen oder anlegen (Groß-/Kleinschreibung egal). Race-sicher über die eindeutigen Schlüssel. */
async function ensureCatalog(tx: Tx, nv: { manufacturer: string | null; model: string | null; generation: string | null; variant: string | null }) {
  if (!nv.manufacturer) return { manufacturerId: null, modelId: null, generationId: null, variantId: null };
  let make = await tx.vehicleMake.findFirst({ where: { name: { equals: nv.manufacturer, mode: 'insensitive' } } });
  if (!make) make = await tx.vehicleMake.upsert({ where: { name: nv.manufacturer }, create: { name: nv.manufacturer }, update: {} });
  if (!nv.model) return { manufacturerId: make.id, modelId: null, generationId: null, variantId: null };
  let model = await tx.vehicleModel.findFirst({ where: { makeId: make.id, name: { equals: nv.model, mode: 'insensitive' } } });
  if (!model) model = await tx.vehicleModel.upsert({ where: { makeId_name: { makeId: make.id, name: nv.model } }, create: { makeId: make.id, name: nv.model }, update: {} });
  let generationId: string | null = null;
  if (nv.generation) {
    const g = await tx.vehicleGeneration.upsert({ where: { modelId_name: { modelId: model.id, name: nv.generation } }, create: { modelId: model.id, name: nv.generation }, update: {} });
    generationId = g.id;
  }
  let variantId: string | null = null;
  if (nv.variant) {
    const v = await tx.vehicleVariant.upsert({ where: { modelId_name: { modelId: model.id, name: nv.variant } }, create: { modelId: model.id, generationId, name: nv.variant }, update: {} });
    variantId = v.id;
  }
  return { manufacturerId: make.id, modelId: model.id, generationId, variantId };
}

const dateOrNull = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`) : null);

function recordData(nv: NormalizedVehicle, source: string, license: LicenseKey | undefined, ids: Awaited<ReturnType<typeof ensureCatalog>>, now: Date) {
  const base = {
    hsn: nv.hsn, tsn: nv.tsn, manufacturerNameRaw: nv.manufacturerNameRaw, vehicleNameRaw: nv.vehicleNameRaw,
    manufacturer: nv.manufacturer, model: nv.model, generation: nv.generation, variant: nv.variant, bodyStyle: nv.bodyStyle,
    engineName: nv.engineName, engineCode: nv.engineCode, fuelType: nv.fuelType, displacementCc: nv.displacementCc, powerKw: nv.powerKw, powerHp: nv.powerHp,
    torqueNm: nv.torqueNm, transmission: nv.transmission, driveType: nv.driveType, productionFrom: dateOrNull(nv.productionFrom), productionTo: dateOrNull(nv.productionTo),
    typeApproval: nv.typeApproval, vehicleClass: nv.vehicleClass,
  };
  return {
    ...base,
    manufacturerId: ids.manufacturerId, modelId: ids.modelId, generationId: ids.generationId, variantId: ids.variantId,
    source, sourceUrl: nv.sourceUrl, sourceRecordId: nv.sourceRecordId ?? '', sourceImportedAt: now, sourceLastCheckedAt: now,
    sourceHash: hashOf(nv), importerVersion: IMPORTER_VERSION,
    rawData: { raw: nv.raw, source } as Prisma.InputJsonValue,
    verificationStatus: verificationFor(source, license) as VerificationKey,
    searchText: buildSearchText({ ...base, fuelType: nv.fuelType }),
  };
}

/* ------------------------------------------------------------ Upsert mit Konflikterkennung */

export type UpsertOutcome =
  | { outcome: 'created'; record: VehicleHsnTsn }
  | { outcome: 'exists'; record: VehicleHsnTsn }
  | { outcome: 'conflict'; record: VehicleHsnTsn; fields: CompareField[]; conflictId: string };

/**
 * Speichert einen normalisierten Datensatz in der eigenen Datenbank.
 * Primäre Identifikation HSN + TSN. Gleiche HSN/TSN mit abweichendem Inhalt überschreiben NIE den Bestand – es entsteht ein Konflikt.
 */
export async function upsertNormalized(
  tx: Tx, nv: NormalizedVehicle, ctx: { source: string; license?: LicenseKey; actorId?: string | null; now?: Date },
): Promise<UpsertOutcome> {
  const now = ctx.now ?? new Date();
  const existing = await tx.vehicleHsnTsn.findMany({ where: { hsn: nv.hsn, tsn: nv.tsn, deletedAt: null }, orderBy: { createdAt: 'asc' } });
  const recId = nv.sourceRecordId ?? '';
  const same = existing.find((r) => r.source === ctx.source && r.sourceRecordId === recId);
  // Liefert eine Quelle mehrere Varianten zu einer HSN/TSN (eigene Quell-ID), ist das jeweils ein eigener Datensatz – kein Konflikt
  const otherVariant = !same && recId !== '' && existing.some((r) => r.source === ctx.source);
  const target = same ?? (otherVariant ? (existing.find((r) => r.source !== ctx.source) ?? null) : (existing[0] ?? null));

  if (target) {
    const fields = diffRecords(target, nv);
    if (fields.length === 0) {
      const data: Prisma.VehicleHsnTsnUpdateInput = { sourceLastCheckedAt: now };
      if (same) {
        data.sourceHash = hashOf(nv);
        if (target.verificationStatus === 'OUTDATED') data.verificationStatus = verificationFor(ctx.source, ctx.license);
      } else if (ctx.license === 'LICENSED' || ctx.source === 'KBA') {
        data.verificationStatus = 'VERIFIED'; // zusätzlich mit offizieller/lizenzierter Quelle abgeglichen
      }
      const record = await tx.vehicleHsnTsn.update({ where: { id: target.id }, data });
      return { outcome: 'exists', record };
    }
    // abweichend → Konflikt; vorhandene Daten bleiben unverändert. Gleicher eingehender Stand nur einmal offen.
    const hash = hashOf(nv);
    const dup = await tx.vehicleDataConflict.findFirst({ where: { recordId: target.id, status: 'OPEN', incomingSource: ctx.source, incoming: { path: ['sourceHash'], equals: hash } } });
    const conflict = dup ?? await tx.vehicleDataConflict.create({
      data: { recordId: target.id, hsn: nv.hsn, tsn: nv.tsn, incoming: { ...nv, sourceHash: hash } as unknown as Prisma.InputJsonValue, incomingSource: ctx.source, fields },
    });
    const record = await tx.vehicleHsnTsn.update({ where: { id: target.id }, data: { verificationStatus: 'CONFLICT', sourceLastCheckedAt: now } });
    if (!dup) await writeAudit({ actorId: ctx.actorId ?? null, action: 'vehicledata.conflict', entityType: 'VehicleHsnTsn', entityId: target.id, summary: `Datenkonflikt ${nv.hsn}/${nv.tsn} (${fields.map((f) => COMPARE_LABELS[f]).join(', ')})`, after: { source: ctx.source, fields } }, tx);
    return { outcome: 'conflict', record, fields, conflictId: conflict.id };
  }

  const ids = await ensureCatalog(tx, nv);
  const record = await tx.vehicleHsnTsn.create({ data: recordData(nv, ctx.source, ctx.license, ids, now) });
  await writeAudit({ actorId: ctx.actorId ?? null, action: 'vehicledata.create', entityType: 'VehicleHsnTsn', entityId: record.id, summary: `Fahrzeugdatensatz ${nv.hsn}/${nv.tsn} gespeichert (${ctx.source})`, after: { source: ctx.source, hsn: nv.hsn, tsn: nv.tsn } }, tx);
  return { outcome: 'created', record };
}

/* ------------------------------------------------------------ Manuell anlegen */

const optStr = (n: number) => z.string().trim().max(n).optional().nullable().transform((v) => (v ? v : null));
const optInt = (min: number, max: number, msg: string) => z.union([z.string(), z.number()]).optional().nullable()
  .transform((v) => (v === '' || v == null ? null : Number(String(v).replace(/\./g, '').replace(',', '.'))))
  .refine((v) => v === null || (Number.isInteger(v) && v >= min && v <= max), msg);

export const manualRecordSchema = z.object({
  hsn: z.string(), tsn: z.string(),
  manufacturer: z.string().trim().min(1, 'Bitte den Hersteller angeben.').max(80),
  model: z.string().trim().min(1, 'Bitte das Modell angeben.').max(120),
  variant: optStr(120), bodyStyle: optStr(60), engineName: optStr(80),
  fuelType: z.union([z.enum(['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'PLUG_IN_HYBRID', 'LPG', 'CNG', 'HYDROGEN', 'OTHER']), z.literal('')]).optional().nullable().transform((v) => (v ? v : null)),
  powerKw: optInt(1, 2000, 'Bitte eine gültige Leistung in kW angeben.'),
  powerHp: optInt(1, 3000, 'Bitte eine gültige Leistung in PS angeben.'),
  displacementCc: optInt(1, 20000, 'Bitte einen gültigen Hubraum in cm³ angeben.'),
}).transform((v, ctx) => {
  const hsn = normalizeHsn(v.hsn), tsn = normalizeTsn(v.tsn);
  if (!hsn.value) ctx.addIssue({ code: 'custom', path: ['hsn'], message: hsn.error ?? 'Ungültige HSN.' });
  if (!tsn.value) ctx.addIssue({ code: 'custom', path: ['tsn'], message: tsn.error ?? 'Ungültige TSN.' });
  return { ...v, hsn: hsn.value ?? '', tsn: tsn.value ?? '' };
});

export const toNormalizedManual = (v: z.output<typeof manualRecordSchema>): NormalizedVehicle => {
  const name = [v.manufacturer, v.model, v.variant].filter(Boolean).join(' ');
  return {
    hsn: v.hsn, tsn: v.tsn, manufacturerNameRaw: v.manufacturer, vehicleNameRaw: name,
    manufacturer: normalizeManufacturer(v.manufacturer), model: v.model, generation: null, variant: v.variant, bodyStyle: v.bodyStyle, engineName: v.engineName, driveType: null,
    fuelType: v.fuelType as NormalizedVehicle['fuelType'], displacementCc: v.displacementCc, powerKw: v.powerKw, powerHp: v.powerHp,
    torqueNm: null, transmission: null, engineCode: null, productionFrom: null, productionTo: null, typeApproval: null, vehicleClass: null,
    sourceUrl: null, sourceRecordId: '', raw: { manual: 'true' },
  };
};

/** „Fahrzeug manuell anlegen“: eigener Datensatz, Quelle MANUAL, Status unverifiziert. Bestehende Datensätze werden nie überschrieben. */
export async function createManualRecord(user: AuthUser, raw: unknown) {
  requireWrite(user);
  const v = manualRecordSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const res = await upsertNormalized(tx, toNormalizedManual(v), { source: 'MANUAL', actorId: user.id });
    if (res.outcome === 'conflict') {
      return { ...res, message: 'Zu dieser HSN/TSN gibt es bereits einen abweichenden Datensatz. Die Abweichung wurde als Konflikt zur Prüfung vorgemerkt.' };
    }
    return { ...res, message: res.outcome === 'created' ? 'Fahrzeug angelegt.' : 'Dieser Datensatz existiert bereits.' };
  });
}

/* ------------------------------------------------------------ Suche & Kennzahlen */

export type CatalogQuery = { q?: string; page?: number; limit?: number; status?: string; source?: string; manufacturer?: string };

export async function searchCatalog(user: AuthUser, query: CatalogQuery) {
  requireRead(user);
  const page = Math.max(1, query.page ?? 1);
  const size = Math.min(query.limit ?? 25, 100);
  const parsed = parseSearchQuery(query.q ?? '');
  const and: Prisma.VehicleHsnTsnWhereInput[] = [{ deletedAt: null }];
  if (parsed.hsn && parsed.tsn) and.push({ hsn: parsed.hsn, tsn: parsed.tsn });
  else if (parsed.hsnPrefix) and.push({ OR: [{ hsn: { startsWith: parsed.hsnPrefix } }, { searchText: { contains: parsed.hsnPrefix } }] });
  else for (const t of parsed.tokens) and.push({ searchText: { contains: t.replace(/[%_]/g, '') } });
  if (query.status) and.push({ verificationStatus: query.status as VerificationKey });
  if (query.source) and.push({ source: query.source });
  if (query.manufacturer) and.push({ manufacturer: { equals: query.manufacturer, mode: 'insensitive' } });
  let where: Prisma.VehicleHsnTsnWhereInput = { AND: and };
  // „1968 tdi“ o. Ä. kann wie eine HSN/TSN aussehen: ohne exakten Treffer als Freitext suchen
  if (parsed.hsn && parsed.tsn && (await db.vehicleHsnTsn.count({ where }) === 0) && parsed.tokens.length) {
    where = { AND: [{ deletedAt: null }, ...parsed.tokens.map((t) => ({ searchText: { contains: t.replace(/[%_]/g, '') } }))] };
  }
  const [rows, total] = await Promise.all([
    db.vehicleHsnTsn.findMany({ where, orderBy: [{ manufacturer: 'asc' }, { model: 'asc' }, { hsn: 'asc' }, { tsn: 'asc' }], skip: (page - 1) * size, take: size }),
    db.vehicleHsnTsn.count({ where }),
  ]);
  return { rows: rows.map(toDto), total, page, pageSize: size };
}

export async function catalogStats(user: AuthUser) {
  requireManage(user);
  const [total, makes, models, hsnGroups, tsnGroups, verified, partial, conflicts, lastSync, bySource] = await Promise.all([
    db.vehicleHsnTsn.count({ where: { deletedAt: null } }),
    db.vehicleMake.count(),
    db.vehicleModel.count(),
    db.vehicleHsnTsn.groupBy({ by: ['hsn'], where: { deletedAt: null } }),
    db.vehicleHsnTsn.groupBy({ by: ['tsn'], where: { deletedAt: null } }),
    db.vehicleHsnTsn.count({ where: { deletedAt: null, verificationStatus: 'VERIFIED' } }),
    db.vehicleHsnTsn.count({ where: { deletedAt: null, OR: [{ verificationStatus: { in: ['PARTIAL', 'UNVERIFIED', 'OUTDATED'] } }, { powerKw: null }, { displacementCc: null }, { fuelType: null }] } }),
    db.vehicleDataConflict.count({ where: { status: 'OPEN' } }),
    db.vehicleHsnTsn.aggregate({ _max: { sourceLastCheckedAt: true }, where: { deletedAt: null, source: { not: 'MANUAL' } } }),
    db.vehicleHsnTsn.groupBy({ by: ['source'], where: { deletedAt: null }, _count: true }),
  ]);
  return { total, makes, models, hsn: hsnGroups.length, tsn: tsnGroups.length, verified, incomplete: partial, conflicts, lastSync: lastSync._max.sourceLastCheckedAt, bySource: Object.fromEntries(bySource.map((b) => [b.source, b._count])) };
}

export async function getRecord(user: AuthUser, id: string) {
  requireRead(user);
  const r = await db.vehicleHsnTsn.findFirst({ where: { id, deletedAt: null }, include: { conflicts: { orderBy: { createdAt: 'desc' }, take: 20 } } });
  if (!r) throw notFoundError('Datensatz');
  return r;
}

/** Anzeige für Konflikte: eigene vs. eingehende Werte je abweichendem Feld. */
export function conflictValues(own: VehicleHsnTsn, incoming: NormalizedVehicle, fields: CompareField[]) {
  const pick = (r: { manufacturer?: string | null; vehicleNameRaw?: string | null; powerKw?: number | null; powerHp?: number | null; displacementCc?: number | null; fuelType?: string | null }, f: CompareField): string | null => {
    switch (f) {
      case 'manufacturer': return r.manufacturer ?? null;
      case 'name': return r.vehicleNameRaw ?? null;
      case 'powerKw': return r.powerKw != null ? `${r.powerKw} kW` : null;
      case 'powerHp': return r.powerHp != null ? `${r.powerHp} PS` : null;
      case 'displacementCc': return r.displacementCc != null ? `${r.displacementCc.toLocaleString('de-DE')} cm³` : null;
      case 'fuelType': return r.fuelType ?? null;
    }
  };
  const o: Partial<Record<CompareField, string | null>> = {}, i: Partial<Record<CompareField, string | null>> = {};
  for (const f of fields) { o[f] = pick(own, f); i[f] = pick(incoming, f); }
  return { own: o, incoming: i };
}

export async function withOpenConflicts(records: VehicleHsnTsn[]): Promise<RecordDto[]> {
  if (!records.length) return [];
  const conflicts = await db.vehicleDataConflict.findMany({ where: { recordId: { in: records.map((r) => r.id) }, status: 'OPEN' }, orderBy: { createdAt: 'desc' } });
  return records.map((r) => ({
    ...toDto(r),
    openConflicts: conflicts.filter((c) => c.recordId === r.id).map((c) => ({
      id: c.id, fields: c.fields as CompareField[], incomingSource: c.incomingSource,
      ...conflictValues(r, c.incoming as unknown as NormalizedVehicle, c.fields as CompareField[]),
    })),
  }));
}

/* ------------------------------------------------------------ Konflikte lösen */

export const CONFLICT_ACTIONS = ['MERGE', 'KEEP_OWN', 'TAKE_EXTERNAL', 'MANUAL'] as const;
export type ConflictAction = (typeof CONFLICT_ACTIONS)[number];
const MERGE_KEYS = ['manufacturer', 'model', 'generation', 'variant', 'bodyStyle', 'engineName', 'engineCode', 'fuelType', 'displacementCc', 'powerKw', 'powerHp', 'torqueNm', 'transmission', 'driveType', 'vehicleClass', 'typeApproval'] as const;

export async function listConflicts(user: AuthUser, query: { status?: string; page?: number } = {}) {
  requireManage(user);
  const page = Math.max(1, query.page ?? 1);
  const where: Prisma.VehicleDataConflictWhereInput = { status: (query.status as 'OPEN') || 'OPEN' };
  const [rows, total] = await Promise.all([
    db.vehicleDataConflict.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 25, take: 25, include: { record: true } }),
    db.vehicleDataConflict.count({ where }),
  ]);
  return {
    rows: rows.map((c) => ({
      id: c.id, hsn: c.hsn, tsn: c.tsn, createdAt: c.createdAt, status: c.status, incomingSource: c.incomingSource, fields: c.fields as CompareField[],
      record: toDto(c.record), incomingData: c.incoming as unknown as NormalizedVehicle,
      ...conflictValues(c.record, c.incoming as unknown as NormalizedVehicle, c.fields as CompareField[]),
    })),
    total, page, pageSize: 25,
  };
}

export async function resolveConflict(user: AuthUser, id: string, action: ConflictAction, manual?: unknown) {
  requireManage(user);
  if (!CONFLICT_ACTIONS.includes(action)) throw new DomainError('Unbekannte Aktion.');
  return db.$transaction(async (tx) => {
    const c = await tx.vehicleDataConflict.findFirst({ where: { id, status: 'OPEN' }, include: { record: true } });
    if (!c) throw notFoundError('Konflikt');
    const own = c.record;
    const inc = c.incoming as unknown as NormalizedVehicle;
    let data: Prisma.VehicleHsnTsnUncheckedUpdateInput = {};
    let status: 'MERGED' | 'KEPT_OWN' | 'TOOK_EXTERNAL' | 'MANUAL' = 'KEPT_OWN';
    if (action === 'MERGE') {
      status = 'MERGED';
      data = fillMissing(own as unknown as Record<string, unknown>, inc as unknown as Record<string, unknown>, [...MERGE_KEYS]) as Prisma.VehicleHsnTsnUncheckedUpdateInput;
    } else if (action === 'TAKE_EXTERNAL') {
      status = 'TOOK_EXTERNAL';
      const ids = await ensureCatalog(tx, inc);
      data = {
        manufacturerNameRaw: inc.manufacturerNameRaw, vehicleNameRaw: inc.vehicleNameRaw, manufacturer: inc.manufacturer, model: inc.model, generation: inc.generation, variant: inc.variant,
        bodyStyle: inc.bodyStyle, engineName: inc.engineName, fuelType: inc.fuelType, displacementCc: inc.displacementCc, powerKw: inc.powerKw, powerHp: inc.powerHp,
        manufacturerId: ids.manufacturerId, modelId: ids.modelId, generationId: ids.generationId, variantId: ids.variantId, source: c.incomingSource, sourceUrl: inc.sourceUrl, sourceHash: (inc as unknown as { sourceHash?: string }).sourceHash ?? null,
        rawData: { raw: inc.raw, source: c.incomingSource } as Prisma.InputJsonValue,
      };
    } else if (action === 'MANUAL') {
      status = 'MANUAL';
      const m = z.object({
        manufacturer: z.string().trim().min(1).max(80), model: z.string().trim().min(1).max(120), variant: optStr(120),
        powerKw: optInt(1, 2000, 'Ungültige kW'), powerHp: optInt(1, 3000, 'Ungültige PS'), displacementCc: optInt(1, 20000, 'Ungültiger Hubraum'),
        fuelType: z.union([z.enum(['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'PLUG_IN_HYBRID', 'LPG', 'CNG', 'HYDROGEN', 'OTHER']), z.literal('')]).optional().nullable().transform((v) => (v ? v : null)),
      }).parse(manual);
      data = { ...m, manufacturer: normalizeManufacturer(m.manufacturer), vehicleNameRaw: [m.manufacturer, m.model, m.variant].filter(Boolean).join(' ') };
    }
    const next = await tx.vehicleHsnTsn.update({ where: { id: own.id }, data });
    const others = await tx.vehicleDataConflict.count({ where: { recordId: own.id, status: 'OPEN', id: { not: id } } });
    await tx.vehicleHsnTsn.update({
      where: { id: own.id },
      data: {
        verificationStatus: others > 0 ? 'CONFLICT' : verificationFor(next.source),
        searchText: buildSearchText({ ...next, fuelType: next.fuelType }),
      },
    });
    await tx.vehicleDataConflict.update({ where: { id }, data: { status, resolvedById: user.id, resolvedAt: new Date() } });
    await writeAudit({ actorId: user.id, action: 'vehicledata.conflict_resolve', entityType: 'VehicleHsnTsn', entityId: own.id, summary: `Datenkonflikt ${own.hsn}/${own.tsn} gelöst (${action})`, after: { action, fields: c.fields } }, tx);
  });
}

/* ------------------------------------------------------------ Archivieren / Namenszerlegung ohne Netz */

export async function archiveRecord(user: AuthUser, id: string) {
  requireManage(user);
  await db.$transaction(async (tx) => {
    const r = await tx.vehicleHsnTsn.findFirst({ where: { id, deletedAt: null } });
    if (!r) throw notFoundError('Datensatz');
    await tx.vehicleHsnTsn.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAudit({ actorId: user.id, action: 'vehicledata.archive', entityType: 'VehicleHsnTsn', entityId: id, summary: `Fahrzeugdatensatz ${r.hsn}/${r.tsn} archiviert` }, tx);
  });
}

export { normalizeFuel, splitVehicleName };
