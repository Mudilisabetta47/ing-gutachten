import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '@/server/db';
import { writeAudit } from '@/server/audit';
import type { AuthUser } from '@/server/auth/session-types';
import { ForbiddenError } from '@/server/auth/errors';
import { DomainError, notFoundError } from '@/server/errors';
import { normalizePlate } from '@/lib/normalize';
import { CASE_TERMINAL } from '@/lib/workflow';
import { caseScope, has, vehicleScope } from './access';
import { createVehicleTx } from './core';
import { recordManualChanges } from '@/server/vehicledata/apply';
import { PAGE_SIZE } from './leads';
import { changedKeys, vehicleSchema } from './schemas';

function scopeOrThrow(user: AuthUser) {
  const s = vehicleScope(user);
  if (!s) throw new ForbiddenError();
  return s;
}

export async function listVehicles(user: AuthUser, query: { q?: string; page?: number; limit?: number }) {
  const scope = scopeOrThrow(user);
  const page = Math.max(1, query.page ?? 1);
  const size = Math.min(query.limit ?? PAGE_SIZE, 100);
  const term = query.q?.trim();
  const plate = term ? normalizePlate(term) : null;
  const vin = term?.toUpperCase().replace(/[\s-]/g, '');
  const where: Prisma.VehicleWhereInput = {
    AND: [
      scope,
      { deletedAt: null },
      ...(term
        ? [{
            OR: [
              { manufacturer: { contains: term, mode: 'insensitive' as const } },
              { model: { contains: term, mode: 'insensitive' as const } },
              ...(plate ? [{ licensePlateNorm: { contains: plate } }] : []),
              ...(vin && vin.length >= 3 ? [{ vin: { contains: vin } }] : []),
              { customer: { lastName: { contains: term, mode: 'insensitive' as const } } },
            ],
          }]
        : []),
    ],
  };
  const [rows, total] = await Promise.all([
    db.vehicle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * size,
      take: size,
      select: { id: true, manufacturer: true, model: true, variant: true, licensePlate: true, vin: true, createdAt: true, customer: { select: { id: true, firstName: true, lastName: true, company: true } } },
    }),
    db.vehicle.count({ where }),
  ]);
  return { rows, total, page, pageSize: size };
}

export async function getVehicle(user: AuthUser, id: string) {
  const scope = scopeOrThrow(user);
  const vehicle = await db.vehicle.findFirst({
    where: { AND: [{ id, deletedAt: null }, scope] },
    include: { customer: { select: { id: true, firstName: true, lastName: true, company: true } }, hsnTsnRecord: true },
  });
  if (!vehicle) throw notFoundError('Fahrzeug');
  return vehicle;
}

export async function vehicleCases(user: AuthUser, vehicleId: string) {
  await getVehicle(user, vehicleId);
  const scope = caseScope(user, 'read');
  if (!scope) return [];
  return db.case.findMany({
    where: { AND: [{ vehicleId, deletedAt: null }, scope] },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, caseNumber: true, status: true, createdAt: true },
  });
}

export async function createVehicle(user: AuthUser, customerId: string, raw: unknown) {
  if (!has(user, 'vehicles.write') || !has(user, 'customers.write')) throw new ForbiddenError();
  const data = vehicleSchema.parse(raw);
  return db.$transaction(async (tx) => {
    const c = await tx.customer.findFirst({ where: { id: customerId, deletedAt: null }, select: { id: true } });
    if (!c) throw notFoundError('Kunde');
    return createVehicleTx(tx, user.id, customerId, data);
  });
}

export async function updateVehicle(user: AuthUser, id: string, raw: unknown) {
  if (!has(user, 'vehicles.write')) throw new ForbiddenError();
  const data = vehicleSchema.parse(raw);
  const { vinWarning: _w, ...next } = data;
  await getVehicle(user, id); // Objektzugriff: Experten nur Fahrzeuge eigener Fälle
  return db.$transaction(async (tx) => {
    const before = await tx.vehicle.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw notFoundError('Fahrzeug');
    // Weicht HSN/TSN vom verknüpften Datensatz ab, wird die Verknüpfung gelöst (die Werte bleiben als manuell bestätigt)
    if (next.hsnTsnId === undefined && before.hsnTsnId && ((next.hsn !== undefined && next.hsn !== before.hsn) || (next.tsn !== undefined && next.tsn !== before.tsn))) next.hsnTsnId = null;
    if (next.hsnTsnId && !(await tx.vehicleHsnTsn.findFirst({ where: { id: next.hsnTsnId, deletedAt: null }, select: { id: true } }))) next.hsnTsnId = null;
    await tx.vehicle.update({ where: { id }, data: next });
    await recordManualChanges(tx, id, user.id, before as unknown as Record<string, unknown>, next as Record<string, unknown>);
    const keys = changedKeys(before as unknown as Record<string, unknown>, next);
    if (keys.length) await writeAudit({ actorId: user.id, action: 'vehicle.update', entityType: 'Vehicle', entityId: id, summary: `Fahrzeug bearbeitet (${keys.join(', ')})`, after: { changed: keys } }, tx);
    return { keys, warning: data.vinWarning };
  });
}

export async function archiveVehicle(user: AuthUser, id: string) {
  if (!has(user, 'vehicles.delete')) throw new ForbiddenError();
  return db.$transaction(async (tx) => {
    const v = await tx.vehicle.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!v) throw notFoundError('Fahrzeug');
    const open = await tx.case.count({ where: { vehicleId: id, deletedAt: null, status: { notIn: [...CASE_TERMINAL] } } });
    if (open > 0) throw new DomainError(`Zum Fahrzeug gibt es ${open} offene Fälle – es kann nicht archiviert werden.`, 'conflict');
    await tx.vehicle.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAudit({ actorId: user.id, action: 'vehicle.archive', entityType: 'Vehicle', entityId: id, summary: 'Fahrzeug archiviert' }, tx);
  });
}
