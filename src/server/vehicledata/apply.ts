import 'server-only';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import type { AuthUser } from '@/server/auth/session-types';
import { ForbiddenError } from '@/server/auth/errors';
import { DomainError, notFoundError } from '@/server/errors';
import { has } from '@/server/pipeline/access';
import { getVehicle } from '@/server/pipeline/vehicles';
import {
  compareRegistration, mayOverwrite, normalizeFuel, normalizeHsn, normalizeManufacturer, normalizeTsn, PRIORITY, sourcePriority, validateVin,
  type CheckRow, type LicenseKey, type VerificationKey,
} from '@/lib/vehicle-data';
import { requireRead } from './catalog';

type Tx = Prisma.TransactionClient;

/** Felder, deren Herkunft und Änderungen nachvollziehbar gespeichert werden (Datenherkunft + Historie). */
export const TRACKED_FIELDS = {
  manufacturer: 'Hersteller', model: 'Modell', variant: 'Variante', fuelType: 'Kraftstoff', hsn: 'HSN', tsn: 'TSN', vin: 'FIN',
  powerKw: 'Leistung (kW)', powerHp: 'Leistung (PS)', displacementCc: 'Hubraum (cm³)', bodyStyle: 'Karosserie', engineName: 'Motor', engineCode: 'Motorkennbuchstabe',
  driveType: 'Antrieb', transmission: 'Getriebe', vehicleClass: 'Fahrzeugklasse', seats: 'Sitzplätze', firstRegistration: 'Erstzulassung', mileage: 'Kilometerstand',
  approvalKind: 'Genehmigungsart', approvalNumber: 'Genehmigungsnummer', typeCode: 'Typ (D.2)', variantCode: 'Variante (D.2)', versionCode: 'Version (D.2)',
} as const;
export type TrackedField = keyof typeof TRACKED_FIELDS;
const FIELD_KEYS = Object.keys(TRACKED_FIELDS) as TrackedField[];

const str = (v: unknown): string | null => {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
};

/** Felder, die ein HSN/TSN-Datensatz an ein Fahrzeug liefern darf (nur vorhandene Werte – nie null überschreiben). */
const FROM_RECORD: TrackedField[] = ['manufacturer', 'model', 'variant', 'fuelType', 'hsn', 'tsn', 'powerKw', 'powerHp', 'displacementCc', 'bodyStyle', 'engineName', 'engineCode', 'driveType', 'transmission', 'vehicleClass'];

type Change = { field: TrackedField; oldValue: string | null; newValue: string | null };

async function writeChange(tx: Tx, p: {
  vehicleId: string; actorId: string | null; field: TrackedField; oldValue: string | null; newValue: string | null; priority: number; source: string; sourceUrl?: string | null;
  status?: VerificationKey; retrievedAt?: Date | null; confirmedById?: string | null; note?: string;
}) {
  await tx.vehicleDataPoint.upsert({
    where: { vehicleId_field: { vehicleId: p.vehicleId, field: p.field } },
    create: { vehicleId: p.vehicleId, field: p.field, value: p.newValue, priority: p.priority, source: p.source, sourceUrl: p.sourceUrl ?? null, status: p.status ?? 'UNVERIFIED', retrievedAt: p.retrievedAt ?? new Date(), confirmedById: p.confirmedById ?? null },
    update: { value: p.newValue, priority: p.priority, source: p.source, sourceUrl: p.sourceUrl ?? null, status: p.status ?? 'UNVERIFIED', retrievedAt: p.retrievedAt ?? new Date(), confirmedById: p.confirmedById ?? null },
  });
  if (p.oldValue !== p.newValue) {
    await tx.vehicleDataHistory.create({ data: { vehicleId: p.vehicleId, actorId: p.actorId, field: p.field, oldValue: p.oldValue, newValue: p.newValue, source: p.source, note: p.note ?? null } });
  }
}

export async function writeEvent(tx: Tx, vehicleId: string, actorId: string | null, note: string, source = 'SYSTEM') {
  await tx.vehicleDataHistory.create({ data: { vehicleId, actorId, field: '*', oldValue: null, newValue: null, source, note } });
}

/**
 * Manuell eingegebene/bearbeitete Werte (Formular, Fahrzeugschein, Gutachter): Priorität 100 – sie gelten als vom Gutachter bestätigt
 * und werden von automatischen Quellen nie mehr überschrieben.
 */
export async function recordManualChanges(tx: Tx, vehicleId: string, actorId: string | null, before: Record<string, unknown>, after: Record<string, unknown>, note?: string) {
  const changes: Change[] = [];
  for (const f of FIELD_KEYS) {
    if (!(f in after) || after[f] === undefined) continue;
    const o = str(before[f]), n = str(after[f]);
    if (o === n) continue;
    changes.push({ field: f, oldValue: o, newValue: n });
  }
  for (const c of changes) {
    await writeChange(tx, { vehicleId, actorId, ...c, priority: PRIORITY.MANUAL_CONFIRMED, source: 'MANUAL_CONFIRMED', status: 'VERIFIED', confirmedById: actorId, note });
  }
  return changes;
}

/** Anlage eines Fahrzeugs mit Datensatz-Verknüpfung: Werte, die dem Datensatz entsprechen, behalten dessen Quelle; geänderte gelten als manuell bestätigt. */
export async function recordInitialData(tx: Tx, vehicleId: string, actorId: string | null, values: Record<string, unknown>, hsnTsnId: string | null) {
  const rec = hsnTsnId ? await tx.vehicleHsnTsn.findFirst({ where: { id: hsnTsnId, deletedAt: null } }) : null;
  const lic = rec ? await licenseOf(tx, rec.source) : undefined;
  let any = false;
  for (const f of FIELD_KEYS) {
    const v = str(values[f]);
    if (v === null) continue;
    const recVal = rec && (FROM_RECORD as string[]).includes(f) ? str((rec as unknown as Record<string, unknown>)[f]) : null;
    const fromRecord = rec !== null && recVal !== null && recVal === v;
    await writeChange(tx, {
      vehicleId, actorId, field: f, oldValue: null, newValue: v,
      priority: fromRecord ? sourcePriority(rec!.source, { license: lic }) : PRIORITY.MANUAL_CONFIRMED,
      source: fromRecord ? rec!.source : 'MANUAL_CONFIRMED', sourceUrl: fromRecord ? rec!.sourceUrl : null,
      status: fromRecord ? (rec!.verificationStatus as VerificationKey) : 'VERIFIED', retrievedAt: fromRecord ? rec!.sourceLastCheckedAt : null, confirmedById: fromRecord ? null : actorId,
    });
    any = true;
  }
  if (any) await writeEvent(tx, vehicleId, actorId, rec ? `Fahrzeug über HSN/TSN identifiziert (${rec.hsn}/${rec.tsn})` : 'Fahrzeug angelegt');
}

const licenseOf = async (tx: Tx, source: string): Promise<LicenseKey | undefined> =>
  (await tx.vehicleProvider.findUnique({ where: { key: source }, select: { licenseStatus: true } }))?.licenseStatus as LicenseKey | undefined;

/* ------------------------------------------------------------ Datensatz auf bestehendes Fahrzeug anwenden */

export type ApplyResult = { applied: TrackedField[]; kept: { field: TrackedField; reason: string }[]; unchanged: number };

/**
 * „Fahrzeug übernehmen“ für ein vorhandenes Fahrzeug: Werte aus dem Datensatz werden nur eingetragen, wenn die vorhandene Angabe
 * keine höhere Priorität hat (z. B. vom Gutachter bestätigt). Leere Quellwerte löschen nie etwas.
 */
export async function applyRecordToVehicle(user: AuthUser, vehicleId: string, recordId: string): Promise<ApplyResult> {
  requireRead(user);
  if (!has(user, 'vehicledata.write') || !has(user, 'vehicles.write')) throw new ForbiddenError();
  await getVehicle(user, vehicleId); // Objektzugriff (Gutachter: nur Fahrzeuge eigener Fälle)
  return db.$transaction(async (tx) => {
    const v = await tx.vehicle.findFirst({ where: { id: vehicleId, deletedAt: null } });
    const rec = await tx.vehicleHsnTsn.findFirst({ where: { id: recordId, deletedAt: null } });
    if (!v) throw notFoundError('Fahrzeug');
    if (!rec) throw notFoundError('Fahrzeugdatensatz');
    const lic = await licenseOf(tx, rec.source);
    const prio = sourcePriority(rec.source, { license: lic });
    const points = new Map((await tx.vehicleDataPoint.findMany({ where: { vehicleId } })).map((p) => [p.field, p]));
    const update: Record<string, unknown> = {};
    const result: ApplyResult = { applied: [], kept: [], unchanged: 0 };
    for (const f of FROM_RECORD) {
      const next = str((rec as unknown as Record<string, unknown>)[f]);
      if (next === null) continue;
      const cur = str((v as unknown as Record<string, unknown>)[f]);
      const point = points.get(f);
      if (!mayOverwrite(point?.priority, prio) && cur !== next) {
        result.kept.push({ field: f, reason: 'Vorhandene Angabe ist höherwertig (vom Gutachter bestätigt oder aus besserer Quelle).' });
        continue;
      }
      if (cur === next) {
        result.unchanged++;
        if (!point || mayOverwrite(point.priority, prio)) await writeChange(tx, { vehicleId, actorId: user.id, field: f, oldValue: cur, newValue: next, priority: Math.max(prio, point?.priority ?? 0), source: point && point.priority > prio ? point.source : rec.source, sourceUrl: rec.sourceUrl, status: rec.verificationStatus as VerificationKey, retrievedAt: rec.sourceLastCheckedAt });
        continue;
      }
      (update as Record<string, unknown>)[f] = (rec as unknown as Record<string, unknown>)[f];
      result.applied.push(f);
      await writeChange(tx, { vehicleId, actorId: user.id, field: f, oldValue: cur, newValue: next, priority: prio, source: rec.source, sourceUrl: rec.sourceUrl, status: rec.verificationStatus as VerificationKey, retrievedAt: rec.sourceLastCheckedAt });
    }
    await tx.vehicle.update({ where: { id: vehicleId }, data: { ...update, hsnTsnId: rec.id } as Prisma.VehicleUncheckedUpdateInput });
    await writeEvent(tx, vehicleId, user.id, `Fahrzeug über HSN/TSN identifiziert (${rec.hsn}/${rec.tsn}, Quelle ${rec.source})`, rec.source);
    await writeAudit({ actorId: user.id, action: 'vehicle.identify', entityType: 'Vehicle', entityId: vehicleId, summary: `Fahrzeug über HSN/TSN identifiziert (${rec.hsn}/${rec.tsn})`, after: { recordId, applied: result.applied, kept: result.kept.map((k) => k.field) } }, tx);
    return result;
  });
}

/** FIN ergänzen (manuell bestätigt, mit Historie). */
export async function setVehicleVin(user: AuthUser, vehicleId: string, vinIn: string) {
  if (!has(user, 'vehicles.write')) throw new ForbiddenError();
  await getVehicle(user, vehicleId);
  const v = validateVin(vinIn);
  if (!v.value) throw new DomainError(v.error ?? 'Ungültige FIN.');
  return db.$transaction(async (tx) => {
    const cur = await tx.vehicle.findFirst({ where: { id: vehicleId, deletedAt: null } });
    if (!cur) throw notFoundError('Fahrzeug');
    await tx.vehicle.update({ where: { id: vehicleId }, data: { vin: v.value } });
    await recordManualChanges(tx, vehicleId, user.id, { vin: cur.vin }, { vin: v.value });
    await writeEvent(tx, vehicleId, user.id, 'FIN ergänzt', 'MANUAL_CONFIRMED');
    await writeAudit({ actorId: user.id, action: 'vehicle.update', entityType: 'Vehicle', entityId: vehicleId, summary: 'FIN ergänzt', after: { changed: ['vin'] } }, tx);
  });
}

/** Gutachter bestätigt einen einzelnen Wert (hebt die Herkunft auf „vom Gutachter bestätigt“). */
export async function confirmVehicleField(user: AuthUser, vehicleId: string, field: string) {
  if (!has(user, 'vehicles.write')) throw new ForbiddenError();
  await getVehicle(user, vehicleId);
  if (!FIELD_KEYS.includes(field as TrackedField)) throw new DomainError('Unbekanntes Feld.');
  return db.$transaction(async (tx) => {
    const v = await tx.vehicle.findFirst({ where: { id: vehicleId, deletedAt: null } });
    if (!v) throw notFoundError('Fahrzeug');
    const cur = str((v as unknown as Record<string, unknown>)[field]);
    if (cur === null) throw new DomainError('Das Feld hat keinen Wert.');
    const point = await tx.vehicleDataPoint.findUnique({ where: { vehicleId_field: { vehicleId, field } } });
    await writeChange(tx, { vehicleId, actorId: user.id, field: field as TrackedField, oldValue: cur, newValue: cur, priority: PRIORITY.MANUAL_CONFIRMED, source: 'MANUAL_CONFIRMED', status: 'VERIFIED', confirmedById: user.id });
    await writeEvent(tx, vehicleId, user.id, `${TRACKED_FIELDS[field as TrackedField]} durch Gutachter bestätigt${point ? ` (vorher: ${point.source})` : ''}`, 'MANUAL_CONFIRMED');
  });
}

/* ------------------------------------------------------------ Fahrzeugschein ↔ Datenbank */

const num = (min: number, max: number, msg: string) => z.union([z.string(), z.number()]).optional().nullable()
  .transform((v) => (v === '' || v == null ? null : Number(String(v).replace(/\./g, '').replace(',', '.'))))
  .refine((v) => v === null || (Number.isInteger(v) && v >= min && v <= max), msg);
const txt = (n: number) => z.string().trim().max(n).optional().nullable().transform((v) => (v ? v : null));

export const registrationSchema = z.object({
  hsn: txt(10), tsn: txt(10), manufacturer: txt(80), typeCode: txt(40), variantCode: txt(40), versionCode: txt(40), vin: txt(30), vehicleClass: txt(20),
  displacementCc: num(1, 20000, 'Ungültiger Hubraum (P.1)'), powerKw: num(1, 2000, 'Ungültige Leistung (P.2)'), fuel: txt(40),
  seats: num(1, 99, 'Ungültige Sitzplatzzahl (S.1)'), firstRegistration: txt(10), approvalKind: z.union([z.enum(['EC_TYPE_APPROVAL', 'ABE', 'INDIVIDUAL', 'UNKNOWN']), z.literal('')]).optional().nullable().transform((v) => (v ? v : null)),
  approvalNumber: txt(60),
}).transform((v, ctx) => {
  const hsn = v.hsn ? normalizeHsn(v.hsn) : { value: null as string | null, error: undefined };
  const tsn = v.tsn ? normalizeTsn(v.tsn) : { value: null as string | null, error: undefined };
  if (v.hsn && !hsn.value) ctx.addIssue({ code: 'custom', path: ['hsn'], message: hsn.error ?? 'Ungültige HSN (2.1).' });
  if (v.tsn && !tsn.value) ctx.addIssue({ code: 'custom', path: ['tsn'], message: tsn.error ?? 'Ungültige TSN (2.2).' });
  let vin: string | null = null;
  if (v.vin) {
    const r = validateVin(v.vin);
    if (!r.value) ctx.addIssue({ code: 'custom', path: ['vin'], message: r.error ?? 'Ungültige FIN (E).' });
    vin = r.value;
  }
  let first: string | null = null;
  if (v.firstRegistration) {
    const m = v.firstRegistration.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? v.firstRegistration.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!m) ctx.addIssue({ code: 'custom', path: ['firstRegistration'], message: 'Bitte das Datum der Erstzulassung (B) angeben.' });
    else first = m[0].includes('-') ? m[0] : `${m[3]}-${m[2]}-${m[1]}`;
  }
  return { ...v, hsn: hsn.value, tsn: tsn.value, vin, firstRegistration: first, fuelType: normalizeFuel(v.fuel) };
});
export type RegistrationInputParsed = z.output<typeof registrationSchema>;

export type RegistrationCheck = { at: string; by: string; recordId: string | null; rows: CheckRow[]; input: Record<string, string | number | null>; note: string | null };

/**
 * Fahrzeugscheinangaben erfassen und mit dem Datensatz vergleichen. Übernommen werden nur die Identifikations- und Zulassungsfelder
 * (HSN, TSN, FIN, Erstzulassung, Klasse, Sitze, Typ/Variante/Version, Genehmigung). Leistung, Hubraum und Kraftstoff werden nur verglichen –
 * der Gutachter entscheidet bei einer Abweichung.
 */
export async function saveRegistration(user: AuthUser, vehicleId: string, raw: unknown) {
  if (!has(user, 'vehicles.write') || !has(user, 'vehicledata.write')) throw new ForbiddenError();
  await getVehicle(user, vehicleId);
  const input = registrationSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const v = await tx.vehicle.findFirst({ where: { id: vehicleId, deletedAt: null } });
    if (!v) throw notFoundError('Fahrzeug');
    const hsn = input.hsn ?? v.hsn, tsn = input.tsn ?? v.tsn;
    let rec = v.hsnTsnId ? await tx.vehicleHsnTsn.findFirst({ where: { id: v.hsnTsnId, deletedAt: null } }) : null;
    if (rec && hsn && tsn && (rec.hsn !== hsn || rec.tsn !== tsn)) rec = null;
    let note: string | null = null;
    if (!rec && hsn && tsn) {
      const found = await tx.vehicleHsnTsn.findMany({ where: { hsn, tsn, deletedAt: null } });
      if (found.length === 1) rec = found[0];
      else if (found.length > 1) note = 'Zu dieser HSN/TSN gibt es mehrere Varianten – bitte zuerst das Fahrzeug über die Identifikation auswählen.';
      else note = 'Zu dieser HSN/TSN gibt es keinen Datensatz in der eigenen Datenbank.';
    }
    const rows = rec
      ? compareRegistration({ manufacturer: input.manufacturer, powerKw: input.powerKw, displacementCc: input.displacementCc, fuelType: input.fuelType }, rec)
      : compareRegistration({ manufacturer: input.manufacturer, powerKw: input.powerKw, displacementCc: input.displacementCc, fuelType: input.fuelType }, {});
    const check: RegistrationCheck = {
      at: new Date().toISOString(), by: user.id, recordId: rec?.id ?? null, rows, note,
      input: { hsn, tsn, manufacturer: input.manufacturer ? normalizeManufacturer(input.manufacturer) : null, powerKw: input.powerKw, displacementCc: input.displacementCc, fuel: input.fuelType, seats: input.seats },
    };
    const next: Record<string, unknown> = {};
    for (const f of ['hsn', 'tsn', 'vin', 'vehicleClass', 'seats', 'typeCode', 'variantCode', 'versionCode', 'approvalKind', 'approvalNumber'] as const) {
      const val = f === 'hsn' ? hsn : f === 'tsn' ? tsn : (input as Record<string, unknown>)[f];
      if (val !== null && val !== undefined) next[f] = val;
    }
    if (input.firstRegistration) next.firstRegistration = input.firstRegistration;
    const data = { ...next, registrationCheck: check as unknown as Prisma.InputJsonValue, ...(rec ? { hsnTsnId: rec.id } : {}) } as Prisma.VehicleUncheckedUpdateInput;
    if (typeof next.firstRegistration === 'string') (data as Record<string, unknown>).firstRegistration = new Date(`${next.firstRegistration}T00:00:00Z`);
    await tx.vehicle.update({ where: { id: vehicleId }, data });
    await recordManualChanges(tx, vehicleId, user.id, v as unknown as Record<string, unknown>, next, 'Aus Fahrzeugschein erfasst');
    const dev = rows.filter((r) => r.state === 'deviation').length;
    await writeEvent(tx, vehicleId, user.id, `Fahrzeugschein erfasst und abgeglichen (${dev ? `${dev} Abweichung(en)` : rec ? 'konform' : 'ohne Datensatzvergleich'})`, 'MANUAL_CONFIRMED');
    await writeAudit({ actorId: user.id, action: 'vehicle.registration_check', entityType: 'Vehicle', entityId: vehicleId, summary: `Fahrzeugschein abgeglichen (${dev} Abweichungen)`, after: { recordId: rec?.id ?? null, deviations: dev } }, tx);
    return { rows, note, recordId: rec?.id ?? null };
  });
}

/* ------------------------------------------------------------ Lesen für die Fahrzeugakte */

export async function vehicleProvenance(user: AuthUser, vehicleId: string) {
  requireRead(user);
  await getVehicle(user, vehicleId);
  const [points, history] = await Promise.all([
    db.vehicleDataPoint.findMany({ where: { vehicleId }, orderBy: { field: 'asc' } }),
    db.vehicleDataHistory.findMany({ where: { vehicleId }, orderBy: { at: 'desc' }, take: 100 }),
  ]);
  const actors = await db.user.findMany({ where: { id: { in: [...new Set(history.map((h) => h.actorId).filter(Boolean) as string[])] } }, select: { id: true, firstName: true, lastName: true } });
  const name = new Map(actors.map((a) => [a.id, `${a.firstName} ${a.lastName}`.trim()]));
  return { points, history: history.map((h) => ({ ...h, actor: h.actorId ? name.get(h.actorId) ?? null : null })) };
}
