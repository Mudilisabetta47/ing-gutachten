import 'server-only';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '@/server/auth/session-types';
import type { Permission } from '@/server/auth/permissions';

/**
 * Objektbezogene Zugriffsregeln – serverseitig, bei JEDER Abfrage.
 * Jede Funktion liefert eine Prisma-`where`-Bedingung oder `null` (= kein Zugriff).
 * Dadurch gibt es keinen Pfad, auf dem fremde Datensätze „nur nicht angezeigt“ würden.
 */
export const has = (u: AuthUser, p: Permission) => u.permissions.has(p);

export function caseScope(user: AuthUser, mode: 'read' | 'write'): Prisma.CaseWhereInput | null {
  if (has(user, mode === 'read' ? 'cases.read.all' : 'cases.write.all')) return {};
  if (has(user, mode === 'read' ? 'cases.read.own' : 'cases.write.own')) return { assignedExpertId: user.id };
  return null;
}

export function customerScope(user: AuthUser): Prisma.CustomerWhereInput | null {
  if (has(user, 'customers.read')) return {};
  if (has(user, 'customers.read.own')) return { cases: { some: { assignedExpertId: user.id, deletedAt: null } } };
  return null;
}

export function vehicleScope(user: AuthUser): Prisma.VehicleWhereInput | null {
  if (!has(user, 'vehicles.read')) return null;
  if (has(user, 'cases.read.all')) return {};
  return { cases: { some: { assignedExpertId: user.id, deletedAt: null } } };
}

export function leadAccess(user: AuthUser, mode: 'read' | 'write' | 'convert'): boolean {
  return has(user, mode === 'read' ? 'leads.read' : mode === 'write' ? 'leads.write' : 'leads.convert');
}

/**
 * Feld-Ebene: Buchhaltung sieht den Fall nur so weit, wie sie für die Abrechnung braucht.
 * Unfallhergang, Beschreibung, Gegenseite, Anwalt, Werkstatt und interne Notizen sind
 * „Interna“ und nur für Rollen mit Bearbeitungsrecht am Fall sichtbar.
 */
export function canSeeCaseInternals(user: AuthUser): boolean {
  return has(user, 'cases.write.all') || has(user, 'cases.write.own');
}

export const CASE_INTERNAL_FIELDS = ['description', 'damageDate', 'accidentDate', 'opposingInsurance', 'opposingClaimNumber', 'lawyer', 'repairShop'] as const;

/** Entfernt Interna aus einem Fall-Objekt, wenn der Benutzer sie nicht sehen darf. */
export function projectCase<T extends Record<string, unknown>>(user: AuthUser, c: T): T {
  if (canSeeCaseInternals(user)) return c;
  const copy: Record<string, unknown> = { ...c };
  for (const f of CASE_INTERNAL_FIELDS) if (f in copy) copy[f] = null;
  return copy as T;
}
