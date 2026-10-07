import 'server-only';
import type { Prisma } from '@prisma/client';
import { writeAudit } from '@/server/audit';
import { getSetting } from '@/server/settings';
import { normalizePhone } from '@/lib/normalize';
import { DomainError, notFoundError } from '@/server/errors';
import type { CaseStatusKey } from '@/lib/workflow';
import type { CaseInput, CustomerInput, VehicleInput } from './schemas';
import { recordInitialData } from '@/server/vehicledata/apply';

/**
 * Bausteine, die sowohl die manuelle Anlage als auch die Umwandlung einer Anfrage nutzen.
 * Alle Funktionen laufen in der Transaktion des Aufrufers – bricht später etwas ab,
 * verschwindet alles, einschließlich der vergebenen Fallnummer.
 */

export type Tx = Prisma.TransactionClient;

export function berlinYear(now: Date): number {
  return Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric' }).format(now));
}

export function formatCaseNumber(prefix: string, year: number, value: number, digits: number): string {
  return `${prefix}-${year}-${String(value).padStart(digits, '0')}`;
}

/**
 * Atomar hochgezählt: ein einziges INSERT … ON CONFLICT DO UPDATE … RETURNING.
 * Parallele Transaktionen warten auf die Zeilensperre und bekommen lückenlos 1, 2, 3 …
 * (kein COUNT(*)+1, keine Doppelvergabe). Rollt die Transaktion zurück, wird die Nummer nicht verbraucht.
 */
export async function nextCaseNumber(tx: Tx, now = new Date()): Promise<string> {
  const { casePrefix, caseDigits } = await getSetting('numbering', tx);
  const year = berlinYear(now);
  const rows = await tx.$queryRaw<{ last_value: number }[]>`
    INSERT INTO case_counters (year, last_value, updated_at) VALUES (${year}, 1, now())
    ON CONFLICT (year) DO UPDATE SET last_value = case_counters.last_value + 1, updated_at = now()
    RETURNING last_value`;
  return formatCaseNumber(casePrefix, year, Number(rows[0].last_value), caseDigits);
}

export async function createCustomerTx(tx: Tx, actorId: string | null, input: CustomerInput) {
  const customer = await tx.customer.create({
    data: { ...input, firstName: input.firstName, phoneNorm: normalizePhone(input.phone) },
  });
  await writeAudit({ actorId, action: 'customer.create', entityType: 'Customer', entityId: customer.id, summary: 'Kunde angelegt', after: { type: customer.type } }, tx);
  return customer;
}

export async function createVehicleTx(tx: Tx, actorId: string | null, customerId: string, input: VehicleInput) {
  const { vinWarning: _w, ...data } = input;
  if (data.hsnTsnId && !(await tx.vehicleHsnTsn.findFirst({ where: { id: data.hsnTsnId, deletedAt: null }, select: { id: true } }))) data.hsnTsnId = null;
  const vehicle = await tx.vehicle.create({ data: { ...data, customerId } });
  await recordInitialData(tx, vehicle.id, actorId, vehicle as unknown as Record<string, unknown>, vehicle.hsnTsnId);
  await writeAudit({ actorId, action: 'vehicle.create', entityType: 'Vehicle', entityId: vehicle.id, summary: 'Fahrzeug angelegt', after: { manufacturer: vehicle.manufacturer, model: vehicle.model } }, tx);
  return vehicle;
}

/** Nur aktive Sachverständige dürfen zugewiesen werden. */
export async function assertAssignableExpert(tx: Tx, userId: string) {
  const u = await tx.user.findFirst({ where: { id: userId, isActive: true, deletedAt: null, employee: { isExpert: true } }, select: { id: true } });
  if (!u) throw new DomainError('Dieser Sachverständige ist nicht verfügbar.');
}

const REF_KIND = { insuranceOrgId: 'INSURANCE', lawyerOrgId: 'LAWYER', workshopOrgId: 'WORKSHOP', dealershipOrgId: 'DEALERSHIP', partnerOrgId: 'PARTNER' } as const;

/** Verweise auf Stammdaten prüfen: existiert, nicht archiviert, und die Art passt (Versicherung ist wirklich eine Versicherung). */
export async function validateCaseRefs(tx: Tx, data: Partial<CaseInput>) {
  for (const [field, kind] of Object.entries(REF_KIND)) {
    const id = (data as Record<string, string | null | undefined>)[field];
    if (id && !(await tx.organization.findFirst({ where: { id, kind, deletedAt: null }, select: { id: true } }))) throw new DomainError('Die gewählte Stammdaten-Auswahl ist nicht verfügbar.');
  }
  if (data.locationId && !(await tx.location.findFirst({ where: { id: data.locationId, deletedAt: null }, select: { id: true } }))) throw new DomainError('Der gewählte Standort ist nicht verfügbar.');
}

export async function createCaseTx(
  tx: Tx,
  actorId: string | null,
  args: { customerId: string; vehicleId: string; data: CaseInput; status?: CaseStatusKey; fromLeadId?: string; now?: Date },
) {
  const vehicle = await tx.vehicle.findFirst({ where: { id: args.vehicleId, deletedAt: null }, select: { customerId: true } });
  if (!vehicle) throw notFoundError('Fahrzeug');
  if (vehicle.customerId !== args.customerId) throw new DomainError('Das Fahrzeug gehört nicht zu diesem Kunden.');
  const customer = await tx.customer.findFirst({ where: { id: args.customerId, deletedAt: null }, select: { id: true } });
  if (!customer) throw notFoundError('Kunde');
  if (args.data.assignedExpertId) await assertAssignableExpert(tx, args.data.assignedExpertId);
  await validateCaseRefs(tx, args.data);

  const status = args.status ?? 'NEW';
  // Standort: gewählter, sonst der des Sachverständigen, sonst der Hauptstandort
  let locationId = args.data.locationId ?? null;
  if (!locationId && args.data.assignedExpertId) locationId = (await tx.user.findUnique({ where: { id: args.data.assignedExpertId }, select: { locationId: true } }))?.locationId ?? null;
  if (!locationId) locationId = (await tx.location.findFirst({ where: { deletedAt: null, isDefault: true }, select: { id: true } }))?.id ?? null;
  const caseNumber = await nextCaseNumber(tx, args.now);
  const created = await tx.case.create({
    data: { ...args.data, locationId, caseNumber, status, customerId: args.customerId, vehicleId: args.vehicleId, createdById: actorId },
  });
  await tx.caseStatusHistory.create({ data: { caseId: created.id, fromStatus: null, toStatus: status, actorId, reason: args.fromLeadId ? 'Aus Anfrage umgewandelt' : 'Fall angelegt' } });
  await writeAudit(
    { actorId, action: 'case.create', entityType: 'Case', entityId: created.id, summary: `Fall ${caseNumber} angelegt`, after: { caseNumber, status, fromLead: args.fromLeadId ?? null } },
    tx,
  );
  return created;
}
