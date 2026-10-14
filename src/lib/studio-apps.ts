import type { Permission } from '../server/auth/permissions';

/**
 * ING Studio – Anwendungen. Jede App öffnet als Fenster eine echte Fachanwendung (dieselben Seiten, Daten und Rechte wie im ING Operating
 * System). Sichtbar ist nur, was die Rolle sehen darf; die Rechte werden zusätzlich in jeder Seite serverseitig geprüft.
 */
export type StudioAppDef = {
  id: string;
  label: string;
  /** kurzer Untertitel im Startmenü */
  hint: string;
  href: string;
  group: 'Fachanwendungen' | 'Auswertung & Verwaltung';
  anyOf: Permission[];
  size?: { w: number; h: number };
};

const CASES: Permission[] = ['cases.read.all', 'cases.read.own'];

export const STUDIO_APPS: StudioAppDef[] = [
  { id: 'faelle', label: 'ING Fälle', hint: 'Schadenfälle, Status, Termine', href: '/admin/faelle/', group: 'Fachanwendungen', anyOf: CASES, size: { w: 1120, h: 720 } },
  { id: 'anfragen', label: 'ING Eingang', hint: 'Anfragen von der Website', href: '/admin/anfragen/', group: 'Fachanwendungen', anyOf: ['leads.read'] },
  { id: 'kunden', label: 'ING Kunden', hint: 'Kunden, Fahrzeuge, Akten', href: '/admin/kunden/', group: 'Fachanwendungen', anyOf: ['customers.read', 'customers.read.own'] },
  { id: 'fahrzeuge', label: 'ING Fahrzeuge', hint: 'Fahrzeugstammdaten, FIN, HSN/TSN', href: '/admin/fahrzeuge/', group: 'Fachanwendungen', anyOf: ['vehicles.read'] },
  { id: 'schadenaufnahme', label: 'ING Schadenaufnahme', hint: 'Besichtigungen, Schadenerfassung', href: '/admin/besichtigungen/', group: 'Fachanwendungen', anyOf: ['appointments.read.all', 'appointments.read.own'] },
  { id: 'kalkulation', label: 'ING Kalkulation', hint: 'Reparaturkalkulationen', href: '/admin/kalkulationen/', group: 'Fachanwendungen', anyOf: ['calculations.read.all', 'calculations.read.own'] },
  { id: 'bewertung', label: 'ING Bewertung', hint: 'WBW, Restwert, Wertminderung', href: '/admin/bewertungen/', group: 'Fachanwendungen', anyOf: ['valuations.read.all', 'valuations.read.own'] },
  { id: 'gutachten', label: 'ING Gutachten', hint: 'Berichte, Prüfung, PDF', href: '/admin/gutachten/', group: 'Fachanwendungen', anyOf: ['reports.read.all', 'reports.read.own'] },
  { id: 'finanzen', label: 'ING Finanzen', hint: 'Rechnungen, Zahlungen, Mahnwesen', href: '/admin/rechnungen/', group: 'Fachanwendungen', anyOf: ['invoices.read'] },
  { id: 'kalender', label: 'ING Kalender', hint: 'Termine und Besichtigungen', href: '/admin/termine/', group: 'Fachanwendungen', anyOf: ['appointments.read.all', 'appointments.read.own'] },
  { id: 'dokumente', label: 'ING Dokumente', hint: 'Dokumentenakte, Fotos', href: '/admin/dokumente/', group: 'Fachanwendungen', anyOf: ['documents.read.all', 'documents.read.own'] },
  { id: 'aufgaben', label: 'ING Aufgaben', hint: 'Aufgaben und Wiedervorlagen', href: '/admin/aufgaben/', group: 'Fachanwendungen', anyOf: ['tasks.read.all', 'tasks.read.own'] },
  { id: 'fahrzeugdaten', label: 'ING Fahrzeugdaten', hint: 'Eigene Fahrzeugdatenbank', href: '/admin/fahrzeugdaten/', group: 'Auswertung & Verwaltung', anyOf: ['vehicledata.read'] },
  { id: 'auswertungen', label: 'ING Auswertungen', hint: 'Kennzahlen und Umsatz', href: '/admin/auswertungen/', group: 'Auswertung & Verwaltung', anyOf: ['kpi.all', 'kpi.own', 'kpi.revenue'] },
  { id: 'uebersicht', label: 'ING Übersicht', hint: 'Dashboard und „Heute“', href: '/admin/', group: 'Auswertung & Verwaltung', anyOf: [] },
  { id: 'stammdaten', label: 'ING Stammdaten', hint: 'Versicherungen, Werkstätten, Partner', href: '/admin/stammdaten/versicherungen/', group: 'Auswertung & Verwaltung', anyOf: ['masterdata.read', 'masterdata.write'] },
  { id: 'verwaltung', label: 'ING Verwaltung', hint: 'Unternehmen, Nummern, Rechte', href: '/admin/einstellungen/', group: 'Auswertung & Verwaltung', anyOf: ['settings.read'] },
  { id: 'benutzer', label: 'ING Benutzer', hint: 'Konten und Rollen', href: '/admin/benutzer/', group: 'Auswertung & Verwaltung', anyOf: ['users.read'] },
  { id: 'protokoll', label: 'ING Protokoll', hint: 'Änderungs- und Zugriffsprotokoll', href: '/admin/protokoll/', group: 'Auswertung & Verwaltung', anyOf: ['audit.read', 'audit.read.own'] },
];

/** Eingebaute Systemanwendung (kein Seitenaufruf): persönliche Einstellungen des Studios. */
export const SETTINGS_APP = { id: 'settings', label: 'Einstellungen', hint: 'Darstellung, Hintergrund, Tastenkürzel', size: { w: 760, h: 560 } } as const;

export type StudioAppDto = { id: string; label: string; hint: string; href: string; group: StudioAppDef['group']; size?: { w: number; h: number } };

export function appsFor(has: (p: Permission) => boolean): StudioAppDto[] {
  return STUDIO_APPS.filter((a) => a.anyOf.length === 0 || a.anyOf.some(has)).map(({ id, label, hint, href, group, size }) => ({ id, label, hint, href, group, size }));
}

/** Erster Pfadabschnitt unter /admin → App (damit z. B. ein Fall im Fenster das Fälle-Symbol trägt). */
const SEGMENT_APP: Record<string, string> = {
  faelle: 'faelle', anfragen: 'anfragen', kunden: 'kunden', fahrzeuge: 'fahrzeuge', besichtigungen: 'schadenaufnahme', nachbesichtigungen: 'schadenaufnahme',
  kalkulationen: 'kalkulation', bewertungen: 'bewertung', restwerte: 'bewertung', nutzungsausfall: 'bewertung', gutachten: 'gutachten', vorlagen: 'gutachten',
  rechnungen: 'finanzen', zahlungen: 'finanzen', mahnwesen: 'finanzen', leistungen: 'finanzen', termine: 'kalender', dokumente: 'dokumente', fotos: 'dokumente',
  aufgaben: 'aufgaben', wiedervorlagen: 'aufgaben', fahrzeugdaten: 'fahrzeugdaten', auswertungen: 'auswertungen', stammdaten: 'stammdaten', standorte: 'stammdaten',
  einstellungen: 'verwaltung', rollen: 'verwaltung', schnittstellen: 'verwaltung', archiv: 'verwaltung', benutzer: 'benutzer', protokoll: 'protokoll',
};
export function appIdForHref(href: string, allowed: ReadonlySet<string>): string {
  const seg = href.split('?')[0].split('/').filter(Boolean)[1] ?? '';
  const id = SEGMENT_APP[seg];
  return id && allowed.has(id) ? id : 'uebersicht';
}
/** Detailseiten (Fall, Kunde, Gutachten …) – nur sie landen unter „Zuletzt geöffnet“. */
export const isDetailPath = (href: string) => href.split('?')[0].split('/').filter(Boolean).length >= 3;

/** Weiche Trennstellen für lange Wörter in schmalen Symbolbeschriftungen. */
export const softLabel = (label: string) => label.replace('Schadenaufnahme', 'Schaden\u00ADaufnahme').replace('Fahrzeugdaten', 'Fahrzeug\u00ADdaten').replace('Auswertungen', 'Auswer\u00ADtungen');
