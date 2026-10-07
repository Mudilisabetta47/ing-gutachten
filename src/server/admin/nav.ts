import type { Permission } from '@/server/auth/permissions';

export type NavIcon = 'home' | 'users' | 'log' | 'settings' | 'user' | 'inbox' | 'case' | 'calendar' | 'doc' | 'globe';

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  /** sichtbar/zugänglich, wenn mindestens eines dieser Rechte vorliegt (leer = jeder Angemeldete) */
  anyOf: Permission[];
  /** Phase, in der das Modul gebaut wird – nur fertige Module erscheinen in der Navigation */
  phase: number;
  ready: boolean;
};

/** Gesamter Admin-Seitenbaum (docs/ARCHITEKTUR-OS.md §4). Fertige Module: `ready: true`. */
export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: 'home', anyOf: [], phase: 1, ready: true },
  { href: '/admin/leads', label: 'Anfragen', icon: 'inbox', anyOf: ['leads.read'], phase: 2, ready: false },
  { href: '/admin/faelle', label: 'Fälle', icon: 'case', anyOf: ['cases.read.all', 'cases.read.own'], phase: 2, ready: false },
  { href: '/admin/kunden', label: 'Kunden', icon: 'users', anyOf: ['customers.read', 'customers.read.own'], phase: 2, ready: false },
  { href: '/admin/termine', label: 'Termine', icon: 'calendar', anyOf: ['appointments.read.all', 'appointments.read.own'], phase: 3, ready: false },
  { href: '/admin/rechnungen', label: 'Rechnungen', icon: 'doc', anyOf: ['invoices.read'], phase: 4, ready: false },
  { href: '/admin/website', label: 'Website', icon: 'globe', anyOf: ['cms.read'], phase: 5, ready: false },
  { href: '/admin/benutzer', label: 'Benutzer', icon: 'users', anyOf: ['users.read'], phase: 1, ready: true },
  { href: '/admin/protokoll', label: 'Protokoll', icon: 'log', anyOf: ['audit.read', 'audit.read.own'], phase: 1, ready: true },
  { href: '/admin/einstellungen', label: 'Einstellungen', icon: 'settings', anyOf: ['settings.read'], phase: 1, ready: true },
];

export function visibleNav(has: (p: Permission) => boolean): NavItem[] {
  return ADMIN_NAV.filter((i) => i.ready && (i.anyOf.length === 0 || i.anyOf.some(has)));
}
export function upcomingNav(has: (p: Permission) => boolean): NavItem[] {
  return ADMIN_NAV.filter((i) => !i.ready && (i.anyOf.length === 0 || i.anyOf.some(has)));
}
