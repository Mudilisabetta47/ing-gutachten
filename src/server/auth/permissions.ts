import type { Role } from '@prisma/client';

/**
 * Rollen- und Rechtematrix (Quelle der Wahrheit: docs/ARCHITEKTUR-OS.md §3).
 *
 * Reine Daten, keine Abhängigkeit zu Next oder Datenbank – deshalb direkt testbar.
 * `.own` bedeutet: nur Objekte, die dem Benutzer zugewiesen sind (Objektprüfung
 * erfolgt zusätzlich im jeweiligen Modul, z. B. `requireCaseAccess`).
 * Die Prüfung läuft IMMER auf dem Server. Ausgeblendete Schaltflächen sind nur Komfort.
 */

export const PERMISSIONS = [
  // Pipeline & Stammdaten
  'leads.read', 'leads.write', 'leads.convert',
  'customers.read', 'customers.read.own', 'customers.write', 'customers.delete',
  'vehicles.read', 'vehicles.write', 'vehicles.delete',
  // Fälle
  'cases.read.all', 'cases.read.own', 'cases.write.all', 'cases.write.own', 'cases.assign', 'cases.status', 'cases.delete',
  // Termine, Fotos, Dokumente
  'appointments.read.all', 'appointments.read.own', 'appointments.write.all', 'appointments.write.own',
  'photos.read.all', 'photos.read.own', 'photos.write.all', 'photos.write.own',
  'documents.read.all', 'documents.read.own', 'documents.write.all', 'documents.write.own', 'documents.delete',
  // Gutachten, Abrechnung
  'reports.read.all', 'reports.read.own', 'reports.write.all', 'reports.write.own', 'reports.send',
  'invoices.read', 'invoices.write', 'payments.write', 'invoices.export',
  // Aufgaben, Kommunikation
  'tasks.read.all', 'tasks.read.own', 'tasks.write.all', 'tasks.write.own',
  'communication.read.all', 'communication.read.own', 'communication.write.all', 'communication.write.own',
  'templates.write',
  // Website / SEO
  'cms.read', 'cms.write', 'cms.review', 'cms.publish', 'seo.read', 'seo.write', 'redirects.write', 'media.public.write',
  // Auswertungen
  'kpi.all', 'kpi.own', 'kpi.revenue',
  // Verwaltung
  // Kalkulation, Bewertung, Stammdaten, Integrationen (Phase 4)
  'calculations.read.all', 'calculations.read.own', 'calculations.write.all', 'calculations.write.own',
  'valuations.read.all', 'valuations.read.own', 'valuations.write.all', 'valuations.write.own',
  'reports.review', 'reports.approve',
  'masterdata.read', 'masterdata.write', 'locations.write', 'dunning.write',
  'integrations.read', 'integrations.write',
  'users.read', 'users.write', 'users.write.owner', 'settings.read', 'settings.write',
  'audit.read', 'audit.read.own', 'data.export', 'data.anonymize', 'search.global',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: readonly Permission[] = PERMISSIONS;

const OFFICE: Permission[] = [
  'leads.read', 'leads.write', 'leads.convert',
  'customers.read', 'customers.write', 'vehicles.read', 'vehicles.write',
  'cases.read.all', 'cases.write.all', 'cases.assign', 'cases.status',
  'appointments.read.all', 'appointments.write.all',
  'photos.read.all', 'photos.write.all', 'documents.read.all', 'documents.write.all',
  'reports.read.all', 'reports.send',
  'invoices.read',
  'calculations.read.all', 'valuations.read.all', 'masterdata.read', 'masterdata.write',
  'tasks.read.all', 'tasks.write.all',
  'communication.read.all', 'communication.write.all',
  'kpi.all', 'audit.read.own', 'search.global',
];

const EXPERT: Permission[] = [
  'customers.read.own', 'vehicles.read', 'vehicles.write',
  'cases.read.own', 'cases.write.own',
  'appointments.read.own', 'appointments.write.own',
  'photos.read.own', 'photos.write.own',
  'documents.read.own', 'documents.write.own',
  'reports.read.own', 'reports.write.own',
  'calculations.read.own', 'calculations.write.own', 'valuations.read.own', 'valuations.write.own', 'masterdata.read',
  'tasks.read.own', 'tasks.write.own',
  'communication.read.own', 'communication.write.own',
  'kpi.own', 'audit.read.own', 'search.global',
];

const ACCOUNTING: Permission[] = [
  'customers.read', 'cases.read.all',
  'invoices.read', 'invoices.write', 'payments.write', 'invoices.export', 'dunning.write', 'masterdata.read',
  'documents.read.own',
  'tasks.read.own', 'tasks.write.own',
  'kpi.revenue', 'audit.read.own', 'search.global',
];

/** Prüfer: liest den ganzen Fall und gibt Gutachten frei (Vier-Augen-Prinzip), schreibt aber nichts am Fall. */
const REVIEWER: Permission[] = [
  'customers.read', 'vehicles.read', 'cases.read.all',
  'appointments.read.all', 'photos.read.all', 'documents.read.all',
  'reports.read.all', 'reports.review', 'reports.approve',
  'calculations.read.all', 'valuations.read.all', 'masterdata.read',
  'tasks.read.own', 'tasks.write.own', 'communication.read.all',
  'kpi.own', 'audit.read.own', 'search.global',
];

const CONTENT_MANAGER: Permission[] = [
  'cms.read', 'cms.write', 'cms.review', 'seo.read', 'seo.write', 'redirects.write', 'media.public.write',
  'audit.read.own',
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: ALL,
  ADMIN: ALL.filter((p) => p !== 'users.write.owner'),
  OFFICE,
  EXPERT,
  ACCOUNTING,
  CONTENT_MANAGER,
  REVIEWER,
};

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Inhaber',
  ADMIN: 'Administrator',
  OFFICE: 'Büro',
  EXPERT: 'Sachverständiger',
  ACCOUNTING: 'Buchhaltung',
  CONTENT_MANAGER: 'Website & Inhalte',
  REVIEWER: 'Prüfer',
};

export type PermissionOverride = { permission: string; granted: boolean };

/** Effektive Rechte = Standardsatz der Rolle, angepasst um Einzel-Overrides. */
export function effectivePermissions(role: Role, overrides: PermissionOverride[] = []): Set<Permission> {
  const set = new Set<Permission>(ROLE_PERMISSIONS[role]);
  for (const o of overrides) {
    if (!(PERMISSIONS as readonly string[]).includes(o.permission)) continue; // unbekannte Schlüssel ignorieren
    if (o.granted) set.add(o.permission as Permission);
    else set.delete(o.permission as Permission);
  }
  // Die Inhaberrolle verliert nie das Recht, Benutzer und Einstellungen zu verwalten.
  if (role === 'OWNER') for (const p of ALL) set.add(p);
  return set;
}

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}
