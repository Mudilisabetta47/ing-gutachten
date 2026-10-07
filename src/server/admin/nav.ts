import type { Permission } from '@/server/auth/permissions';
import type { IconName } from '@/components/admin/AdminIcon';

export type NavIcon = IconName;
export type NavGroup = 'Übersicht' | 'Arbeit' | 'Finanzen' | 'Website' | 'System';

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  group: NavGroup;
  /** sichtbar/zugänglich, wenn mindestens eines dieser Rechte vorliegt (leer = jeder Angemeldete) */
  anyOf: Permission[];
  /** Phase, in der das Modul gebaut wird – nur fertige Module sind klickbar */
  phase: number;
  ready: boolean;
};

/** Gesamter Admin-Seitenbaum (docs/ARCHITEKTUR-OS.md §4). Fertige Module: `ready: true`; der Rest erscheint deaktiviert. */
export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: 'home', group: 'Übersicht', anyOf: [], phase: 1, ready: true },
  { href: '/admin/heute', label: 'Heute', icon: 'today', group: 'Übersicht', anyOf: ['leads.read', 'cases.read.all', 'cases.read.own'], phase: 2, ready: true },
  { href: '/admin/anfragen', label: 'Anfragen', icon: 'inbox', group: 'Arbeit', anyOf: ['leads.read'], phase: 2, ready: true },
  { href: '/admin/faelle', label: 'Fälle', icon: 'case', group: 'Arbeit', anyOf: ['cases.read.all', 'cases.read.own'], phase: 2, ready: true },
  { href: '/admin/kunden', label: 'Kunden', icon: 'users', group: 'Arbeit', anyOf: ['customers.read', 'customers.read.own'], phase: 2, ready: true },
  { href: '/admin/fahrzeuge', label: 'Fahrzeuge', icon: 'car', group: 'Arbeit', anyOf: ['vehicles.read'], phase: 2, ready: true },
  { href: '/admin/termine', label: 'Termine', icon: 'calendar', group: 'Arbeit', anyOf: ['appointments.read.all', 'appointments.read.own'], phase: 3, ready: true },
  { href: '/admin/rechnungen', label: 'Rechnungen', icon: 'receipt', group: 'Finanzen', anyOf: ['invoices.read'], phase: 4, ready: false },
  { href: '/admin/website', label: 'Inhalte', icon: 'globe', group: 'Website', anyOf: ['cms.read'], phase: 5, ready: false },
  { href: '/admin/regionen', label: 'Regionen', icon: 'map', group: 'Website', anyOf: ['seo.read'], phase: 5, ready: false },
  { href: '/admin/seo', label: 'SEO', icon: 'search', group: 'Website', anyOf: ['seo.read'], phase: 5, ready: false },
  { href: '/admin/ratgeber', label: 'Ratgeber', icon: 'book', group: 'Website', anyOf: ['cms.read'], phase: 5, ready: false },
  { href: '/admin/benutzer', label: 'Benutzer', icon: 'user', group: 'System', anyOf: ['users.read'], phase: 1, ready: true },
  { href: '/admin/protokoll', label: 'Protokoll', icon: 'log', group: 'System', anyOf: ['audit.read', 'audit.read.own'], phase: 1, ready: true },
  { href: '/admin/einstellungen', label: 'Einstellungen', icon: 'settings', group: 'System', anyOf: ['settings.read'], phase: 1, ready: true },
];

export const NAV_GROUPS: NavGroup[] = ['Übersicht', 'Arbeit', 'Finanzen', 'Website', 'System'];

/** Alle Einträge, die die Rolle sehen darf (fertige klickbar, geplante deaktiviert). */
export function navFor(has: (p: Permission) => boolean): NavItem[] {
  return ADMIN_NAV.filter((i) => i.anyOf.length === 0 || i.anyOf.some(has));
}
export function visibleNav(has: (p: Permission) => boolean): NavItem[] {
  return navFor(has).filter((i) => i.ready);
}
export function upcomingNav(has: (p: Permission) => boolean): NavItem[] {
  return navFor(has).filter((i) => !i.ready);
}
