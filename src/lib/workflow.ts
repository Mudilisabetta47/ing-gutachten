/**
 * Statusabläufe für Anfragen (Lead) und Fälle – EINE zentrale Stelle.
 * Rein und ohne Abhängigkeiten, damit Server, Tests und Oberfläche dieselben Regeln nutzen.
 */

export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'APPOINTMENT_PENDING', 'APPOINTMENT_SET', 'CONVERTED', 'CLOSED', 'SPAM'] as const;
export type LeadStatusKey = (typeof LEAD_STATUSES)[number];

export const LEAD_LABELS: Record<LeadStatusKey, string> = {
  NEW: 'Neu',
  CONTACTED: 'Kontaktiert',
  APPOINTMENT_PENDING: 'Termin offen',
  APPOINTMENT_SET: 'Termin vereinbart',
  CONVERTED: 'Umgewandelt',
  CLOSED: 'Abgeschlossen',
  SPAM: 'Spam',
};

/** CONVERTED wird NIE manuell gesetzt – nur durch die Umwandlung (eine Transaktion). */
export const LEAD_TRANSITIONS: Record<LeadStatusKey, readonly LeadStatusKey[]> = {
  NEW: ['CONTACTED', 'APPOINTMENT_PENDING', 'APPOINTMENT_SET', 'CLOSED', 'SPAM'],
  CONTACTED: ['APPOINTMENT_PENDING', 'APPOINTMENT_SET', 'CLOSED', 'SPAM'],
  APPOINTMENT_PENDING: ['CONTACTED', 'APPOINTMENT_SET', 'CLOSED', 'SPAM'],
  APPOINTMENT_SET: ['CONTACTED', 'APPOINTMENT_PENDING', 'CLOSED'],
  CONVERTED: [],
  CLOSED: ['NEW', 'CONTACTED'],
  SPAM: ['NEW'],
};

export const LEAD_CONVERTIBLE: readonly LeadStatusKey[] = ['NEW', 'CONTACTED', 'APPOINTMENT_PENDING', 'APPOINTMENT_SET'];

export function canLeadTransition(from: LeadStatusKey, to: LeadStatusKey): boolean {
  return LEAD_TRANSITIONS[from].includes(to);
}

/* ---------------------------------------------------------------- Fälle */

export const CASE_STATUSES = [
  'NEW', 'APPOINTMENT_PENDING', 'APPOINTMENT_SET', 'INSPECTED', 'DOCUMENTS_MISSING', 'IN_PROGRESS',
  'REPORT_READY', 'REPORT_SENT', 'INVOICED', 'CLOSED', 'CANCELLED',
] as const;
export type CaseStatusKey = (typeof CASE_STATUSES)[number];

export const CASE_LABELS: Record<CaseStatusKey, string> = {
  NEW: 'Neu',
  APPOINTMENT_PENDING: 'Termin offen',
  APPOINTMENT_SET: 'Termin vereinbart',
  INSPECTED: 'Besichtigt',
  DOCUMENTS_MISSING: 'Unterlagen fehlen',
  IN_PROGRESS: 'In Bearbeitung',
  REPORT_READY: 'Gutachten fertig',
  REPORT_SENT: 'Gutachten versendet',
  INVOICED: 'Berechnet',
  CLOSED: 'Abgeschlossen',
  CANCELLED: 'Storniert',
};

export const CASE_TRANSITIONS: Record<CaseStatusKey, readonly CaseStatusKey[]> = {
  NEW: ['APPOINTMENT_PENDING', 'APPOINTMENT_SET', 'CANCELLED'],
  APPOINTMENT_PENDING: ['APPOINTMENT_SET', 'CANCELLED'],
  APPOINTMENT_SET: ['APPOINTMENT_PENDING', 'INSPECTED', 'CANCELLED'],
  INSPECTED: ['DOCUMENTS_MISSING', 'IN_PROGRESS', 'CANCELLED'],
  DOCUMENTS_MISSING: ['INSPECTED', 'IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['DOCUMENTS_MISSING', 'REPORT_READY', 'CANCELLED'],
  REPORT_READY: ['IN_PROGRESS', 'REPORT_SENT'],
  REPORT_SENT: ['IN_PROGRESS', 'INVOICED', 'CLOSED'],
  INVOICED: ['CLOSED'],
  CLOSED: ['IN_PROGRESS'],
  CANCELLED: ['NEW'],
};

/** Zielstatus, die der zugewiesene Sachverständige selbst setzen darf (Rest: Büro/Leitung). */
export const CASE_EXPERT_TARGETS: readonly CaseStatusKey[] = ['INSPECTED', 'DOCUMENTS_MISSING', 'IN_PROGRESS', 'REPORT_READY'];

export const CASE_TERMINAL: readonly CaseStatusKey[] = ['CLOSED', 'CANCELLED'];

export function canCaseTransition(from: CaseStatusKey, to: CaseStatusKey): boolean {
  return CASE_TRANSITIONS[from].includes(to);
}

/** Begründung ist Pflicht bei Storno und beim Wiederöffnen abgeschlossener/stornierter Fälle. */
export function caseReasonRequired(from: CaseStatusKey, to: CaseStatusKey): boolean {
  return to === 'CANCELLED' || CASE_TERMINAL.includes(from);
}

/**
 * Aus dem Anfragestatus abgeleiteter Startstatus des Falls bei der Umwandlung.
 * „Termin vereinbart“ gibt es im Fall nur mit einem echten Termin – deshalb startet auch ein
 * Fall aus einer Anfrage mit „Termin vereinbart“ als „Termin offen“; der Termin wird im Fall angelegt.
 */
export function initialCaseStatus(lead: LeadStatusKey): CaseStatusKey {
  if (lead === 'APPOINTMENT_SET' || lead === 'APPOINTMENT_PENDING') return 'APPOINTMENT_PENDING';
  return 'NEW';
}

/** Anlass im Formular → Gutachtenart im Fall. */
export function serviceFromReason(reason: string): 'ACCIDENT_REPORT' | 'DAMAGE_REPORT' | 'VALUATION' | 'OTHER' {
  switch (reason) {
    case 'Unfall': return 'ACCIDENT_REPORT';
    case 'Parkschaden': return 'DAMAGE_REPORT';
    case 'Wertgutachten':
    case 'Fahrzeugbewertung':
    case 'Leasingrückgabe': return 'VALUATION';
    default: return 'OTHER';
  }
}

export const SERVICE_LABELS: Record<string, string> = {
  ACCIDENT_REPORT: 'Unfallgutachten',
  DAMAGE_REPORT: 'Schadengutachten',
  VALUATION: 'Wertgutachten',
  COST_ESTIMATE: 'Kostenvoranschlag',
  ACCIDENT_ANALYSIS: 'Unfallanalyse',
  RECONSTRUCTION: 'Rekonstruktion',
  OTHER: 'Sonstiges',
};

export const FUEL_LABELS: Record<string, string> = {
  PETROL: 'Benzin', DIESEL: 'Diesel', ELECTRIC: 'Elektro', HYBRID: 'Hybrid', PLUG_IN_HYBRID: 'Plug-in-Hybrid',
  LPG: 'Autogas (LPG)', CNG: 'Erdgas (CNG)', HYDROGEN: 'Wasserstoff', OTHER: 'Sonstiges',
};
