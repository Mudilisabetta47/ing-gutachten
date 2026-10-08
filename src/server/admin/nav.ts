import type { Permission } from '@/server/auth/permissions';
import type { IconName } from '@/components/admin/AdminIcon';

export type NavIcon = IconName;
export type NavGroup = 'Übersicht' | 'Arbeit' | 'Kalkulation & Bewertung' | 'Stammdaten' | 'Dokumente' | 'Finanzen' | 'Website' | 'System';

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
  /** Schlüssel für den Zähler-Badge (Anfragen, Gutachten, Rechnungen, Wiedervorlagen) */
  badge?: 'leads' | 'reports' | 'invoices' | 'reminders';
  /** Hinweis statt „Phase“, wenn der Punkt bewusst noch nicht aktiviert ist */
  note?: string;
};

const CASES: Permission[] = ['cases.read.all', 'cases.read.own'];

/** Gesamter Admin-Seitenbaum. Fertige Module: `ready: true`; der Rest erscheint ausgegraut. */
export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: 'home', group: 'Übersicht', anyOf: [], phase: 1, ready: true },
  { href: '/admin/heute', label: 'Heute', icon: 'today', group: 'Übersicht', anyOf: ['leads.read', ...CASES], phase: 2, ready: true },
  { href: '/admin/termine', label: 'Kalender', icon: 'calendar', group: 'Übersicht', anyOf: ['appointments.read.all', 'appointments.read.own'], phase: 3, ready: true },

  { href: '/admin/anfragen', label: 'Anfragen', icon: 'inbox', group: 'Arbeit', anyOf: ['leads.read'], phase: 2, ready: true, badge: 'leads' },
  { href: '/admin/faelle', label: 'Fälle', icon: 'case', group: 'Arbeit', anyOf: CASES, phase: 2, ready: true },
  { href: '/admin/besichtigungen', label: 'Besichtigungen', icon: 'camera', group: 'Arbeit', anyOf: ['appointments.read.all', 'appointments.read.own'], phase: 4, ready: false },
  { href: '/admin/gutachten', label: 'Gutachten', icon: 'doc', group: 'Arbeit', anyOf: ['reports.read.all', 'reports.read.own'], phase: 4, ready: true, badge: 'reports' },
  { href: '/admin/nachbesichtigungen', label: 'Nachbesichtigungen', icon: 'eye', group: 'Arbeit', anyOf: ['appointments.read.all', 'appointments.read.own'], phase: 4, ready: false },
  { href: '/admin/aufgaben', label: 'Aufgaben', icon: 'checksq', group: 'Arbeit', anyOf: ['tasks.read.all', 'tasks.read.own'], phase: 4, ready: false },
  { href: '/admin/wiedervorlagen', label: 'Wiedervorlagen', icon: 'repeat', group: 'Arbeit', anyOf: ['tasks.read.all', 'tasks.read.own', 'leads.read'], phase: 4, ready: false, badge: 'reminders' },

  { href: '/admin/kalkulationen', label: 'Schadenkalkulation', icon: 'calc', group: 'Kalkulation & Bewertung', anyOf: ['calculations.read.all', 'calculations.read.own'], phase: 4, ready: false },
  { href: '/admin/bewertungen', label: 'Fahrzeugbewertung', icon: 'gauge', group: 'Kalkulation & Bewertung', anyOf: ['valuations.read.all', 'valuations.read.own'], phase: 4, ready: false },
  { href: '/admin/restwerte', label: 'Restwert', icon: 'coins', group: 'Kalkulation & Bewertung', anyOf: ['valuations.read.all', 'valuations.read.own'], phase: 4, ready: false },
  { href: '/admin/nutzungsausfall', label: 'Nutzungsausfall', icon: 'clock', group: 'Kalkulation & Bewertung', anyOf: ['valuations.read.all', 'valuations.read.own'], phase: 4, ready: false },
  { href: '/admin/fahrzeugdaten', label: 'Fahrzeugdatenbank', icon: 'car', group: 'Kalkulation & Bewertung', anyOf: ['vehicledata.manage'], phase: 4, ready: true },

  { href: '/admin/kunden', label: 'Kunden', icon: 'users', group: 'Stammdaten', anyOf: ['customers.read', 'customers.read.own'], phase: 2, ready: true },
  { href: '/admin/fahrzeuge', label: 'Fahrzeuge', icon: 'car', group: 'Stammdaten', anyOf: ['vehicles.read'], phase: 2, ready: true },
  { href: '/admin/fahrzeuge/identifizieren', label: 'Fahrzeug identifizieren', icon: 'search', group: 'Stammdaten', anyOf: ['vehicledata.read'], phase: 4, ready: true },
  { href: '/admin/stammdaten/versicherungen', label: 'Versicherungen', icon: 'shield', group: 'Stammdaten', anyOf: ['masterdata.read', 'masterdata.write'], phase: 4, ready: true },
  { href: '/admin/stammdaten/werkstaetten', label: 'Werkstätten', icon: 'wrench', group: 'Stammdaten', anyOf: ['masterdata.read', 'masterdata.write'], phase: 4, ready: true },
  { href: '/admin/stammdaten/rechtsanwaelte', label: 'Rechtsanwälte', icon: 'scale', group: 'Stammdaten', anyOf: ['masterdata.read', 'masterdata.write'], phase: 4, ready: true },
  { href: '/admin/stammdaten/autohaeuser', label: 'Autohäuser', icon: 'building', group: 'Stammdaten', anyOf: ['masterdata.read', 'masterdata.write'], phase: 4, ready: true },
  { href: '/admin/stammdaten/partner', label: 'Vermittler / Partner', icon: 'handshake', group: 'Stammdaten', anyOf: ['masterdata.read', 'masterdata.write'], phase: 4, ready: true },

  { href: '/admin/dokumente', label: 'Dokumentenakte', icon: 'folder', group: 'Dokumente', anyOf: ['documents.read.all', 'documents.read.own'], phase: 4, ready: false },
  { href: '/admin/fotos', label: 'Fotodokumentation', icon: 'photo', group: 'Dokumente', anyOf: ['photos.read.all', 'photos.read.own'], phase: 4, ready: false },
  { href: '/admin/vorlagen', label: 'Vorlagen', icon: 'template', group: 'Dokumente', anyOf: ['templates.write'], phase: 4, ready: true },
  { href: '/admin/archiv', label: 'Export / Archiv', icon: 'archive', group: 'Dokumente', anyOf: ['data.export', 'cases.delete'], phase: 4, ready: false },

  { href: '/admin/rechnungen', label: 'Rechnungen', icon: 'receipt', group: 'Finanzen', anyOf: ['invoices.read'], phase: 4, ready: false, badge: 'invoices' },
  { href: '/admin/zahlungen', label: 'Zahlungen', icon: 'wallet', group: 'Finanzen', anyOf: ['invoices.read'], phase: 4, ready: false },
  { href: '/admin/mahnwesen', label: 'Mahnwesen', icon: 'alert', group: 'Finanzen', anyOf: ['invoices.read'], phase: 4, ready: false },
  { href: '/admin/provisionen', label: 'Provisionen', icon: 'coins', group: 'Finanzen', anyOf: ['invoices.write'], phase: 4, ready: false, note: 'rechtl. Prüfung' },
  { href: '/admin/auswertungen', label: 'Auswertungen', icon: 'chart', group: 'Finanzen', anyOf: ['kpi.all', 'kpi.revenue'], phase: 4, ready: false },

  { href: '/admin/website', label: 'Inhalte', icon: 'globe', group: 'Website', anyOf: ['cms.read'], phase: 5, ready: false },
  { href: '/admin/regionen', label: 'Regionen', icon: 'map', group: 'Website', anyOf: ['seo.read'], phase: 5, ready: false },
  { href: '/admin/seo', label: 'SEO', icon: 'search', group: 'Website', anyOf: ['seo.read'], phase: 5, ready: false },
  { href: '/admin/ratgeber', label: 'Ratgeber', icon: 'book', group: 'Website', anyOf: ['cms.read'], phase: 5, ready: false },
  { href: '/admin/anfragen?quelle=website_form', label: 'Formularanfragen', icon: 'mail', group: 'Website', anyOf: ['leads.read'], phase: 2, ready: true },

  { href: '/admin/benutzer', label: 'Benutzer', icon: 'user', group: 'System', anyOf: ['users.read'], phase: 1, ready: true },
  { href: '/admin/rollen', label: 'Rollen & Rechte', icon: 'lock', group: 'System', anyOf: ['users.read'], phase: 4, ready: false },
  { href: '/admin/standorte', label: 'Standorte', icon: 'map', group: 'System', anyOf: ['masterdata.write', 'locations.write', 'users.read'], phase: 4, ready: true },
  { href: '/admin/leistungen', label: 'Leistungen & Preise', icon: 'tag', group: 'System', anyOf: ['settings.read'], phase: 4, ready: false },
  { href: '/admin/schnittstellen', label: 'Schnittstellen', icon: 'plug', group: 'System', anyOf: ['integrations.read', 'settings.read'], phase: 4, ready: false },
  { href: '/admin/protokoll', label: 'Protokoll', icon: 'log', group: 'System', anyOf: ['audit.read', 'audit.read.own'], phase: 1, ready: true },
  { href: '/admin/einstellungen', label: 'Einstellungen', icon: 'settings', group: 'System', anyOf: ['settings.read'], phase: 1, ready: true },
];

export const NAV_GROUPS: NavGroup[] = ['Übersicht', 'Arbeit', 'Kalkulation & Bewertung', 'Stammdaten', 'Dokumente', 'Finanzen', 'Website', 'System'];

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
