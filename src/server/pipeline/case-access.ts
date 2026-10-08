import 'server-only';
import { db } from '@/server/db';
import type { AuthUser } from '@/server/auth/session-types';
import { ForbiddenError } from '@/server/auth/errors';
import { notFoundError } from '@/server/errors';
import type { Permission } from '@/server/auth/permissions';
import { caseScope, has } from './access';

export type CaseRef = { id: string; caseNumber: string; assignedExpertId: string | null; customerId: string; vehicleId: string; deletedAt: Date | null };

/**
 * Fall laden UND Zugriff prüfen (Objektebene). Fremde Fälle sind „nicht gefunden“ – nie „verboten“,
 * damit niemand erfährt, dass es sie gibt.
 */
export async function loadCaseFor(user: AuthUser, caseId: string, mode: 'read' | 'write', opts: { archived?: boolean } = {}): Promise<CaseRef> {
  const scope = caseScope(user, mode);
  if (!scope) throw new ForbiddenError();
  const c = await db.case.findFirst({
    where: { AND: [{ id: caseId }, scope, opts.archived ? {} : { deletedAt: null }] },
    select: { id: true, caseNumber: true, assignedExpertId: true, customerId: true, vehicleId: true, deletedAt: true },
  });
  if (!c) throw notFoundError('Fall');
  return c;
}

/** Fachliche Recht (`*.all` oder `*.own` + zugewiesen) – zusätzlich zur Fallprüfung. */
export function canOnCase(user: AuthUser, base: 'photos' | 'documents' | 'appointments' | 'calculations' | 'valuations' | 'reports' | 'tasks' | 'communication', mode: 'read' | 'write', c: { assignedExpertId: string | null }): boolean {
  return has(user, `${base}.${mode}.all` as Permission) || (has(user, `${base}.${mode}.own` as Permission) && c.assignedExpertId === user.id);
}
