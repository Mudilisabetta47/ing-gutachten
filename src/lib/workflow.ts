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

/** Aktive Status des Fall-Workflows (Phase 4). */
export const CASE_STATUSES = [
  'NEW', 'APPOINTMENT_PENDING', 'APPOINTMENT_SET', 'INSPECTED', 'CALCULATION', 'REPORT_DRAFT', 'REVIEW', 'APPROVED', 'SENT', 'BILLING', 'CLOSED', 'CANCELLED',
] as const;
/** Veraltete Status aus Phase 2/3: nur noch lesbar (Historie), werden nicht mehr vergeben. */
export const LEGACY_CASE_STATUSES = ['DOCUMENTS_MISSING', 'IN_PROGRESS', 'REPORT_READY', 'REPORT_SENT', 'INVOICED'] as const;
export type CaseStatusActive = (typeof CASE_STATUSES)[number];
export type CaseStatusKey = CaseStatusActive | (typeof LEGACY_CASE_STATUSES)[number];

export const CASE_LABELS: Record<CaseStatusKey, string> = {
  NEW: 'Neu',
  APPOINTMENT_PENDING: 'Termin offen',
  APPOINTMENT_SET: 'Termin vereinbart',
  INSPECTED: 'Besichtigt',
  CALCULATION: 'Kalkulation',
  REPORT_DRAFT: 'Gutachten in Bearbeitung',
  REVIEW: 'In Prüfung',
  APPROVED: 'Freigegeben',
  SENT: 'Versendet',
  BILLING: 'Abrechnung',
  CLOSED: 'Abgeschlossen',
  CANCELLED: 'Storniert',
  DOCUMENTS_MISSING: 'Unterlagen fehlen (alt)',
  IN_PROGRESS: 'In Bearbeitung (alt)',
  REPORT_READY: 'Gutachten fertig (alt)',
  REPORT_SENT: 'Gutachten versendet (alt)',
  INVOICED: 'Berechnet (alt)',
};

/** Kurze Beschriftungen für die Pipeline-Leiste. */
export const CASE_SHORT: Record<CaseStatusActive, string> = {
  NEW: 'Neu', APPOINTMENT_PENDING: 'Termin offen', APPOINTMENT_SET: 'Termin', INSPECTED: 'Besichtigt', CALCULATION: 'Kalkulation',
  REPORT_DRAFT: 'Gutachten', REVIEW: 'Prüfung', APPROVED: 'Freigegeben', SENT: 'Versendet', BILLING: 'Abrechnung', CLOSED: 'Geschlossen', CANCELLED: 'Storniert',
};

export const CASE_TRANSITIONS: Record<CaseStatusActive, readonly CaseStatusActive[]> = {
  NEW: ['APPOINTMENT_PENDING', 'APPOINTMENT_SET', 'CANCELLED'],
  APPOINTMENT_PENDING: ['APPOINTMENT_SET', 'CANCELLED'],
  APPOINTMENT_SET: ['APPOINTMENT_PENDING', 'INSPECTED', 'CANCELLED'],
  INSPECTED: ['CALCULATION', 'REPORT_DRAFT', 'CANCELLED'],
  CALCULATION: ['INSPECTED', 'REPORT_DRAFT', 'CANCELLED'],
  REPORT_DRAFT: ['CALCULATION', 'REVIEW', 'CANCELLED'],
  REVIEW: ['REPORT_DRAFT', 'APPROVED'],
  APPROVED: ['REPORT_DRAFT', 'SENT'],
  SENT: ['REPORT_DRAFT', 'BILLING', 'CLOSED'],
  BILLING: ['SENT', 'CLOSED'],
  CLOSED: ['REPORT_DRAFT', 'BILLING'],
  CANCELLED: ['NEW'],
};

/** Zielstatus, die der zugewiesene Sachverständige selbst setzen darf (Rest: Büro/Leitung/Prüfer). */
export const CASE_EXPERT_TARGETS: readonly CaseStatusActive[] = ['INSPECTED', 'CALCULATION', 'REPORT_DRAFT', 'REVIEW'];

export const CASE_TERMINAL: readonly CaseStatusKey[] = ['CLOSED', 'CANCELLED'];

/** Alte Status werden wie ihr neues Gegenstück behandelt (falls noch irgendwo ein alter Wert auftaucht). */
export function normalizeCaseStatus(s: CaseStatusKey): CaseStatusActive {
  switch (s) {
    case 'DOCUMENTS_MISSING': return 'INSPECTED';
    case 'IN_PROGRESS': return 'REPORT_DRAFT';
    case 'REPORT_READY': return 'APPROVED';
    case 'REPORT_SENT': return 'SENT';
    case 'INVOICED': return 'BILLING';
    default: return s;
  }
}

export function canCaseTransition(from: CaseStatusKey, to: CaseStatusKey): boolean {
  return (CASE_TRANSITIONS[normalizeCaseStatus(from)] as readonly CaseStatusKey[]).includes(to);
}

/** Begründung ist Pflicht bei Storno und beim Wiederöffnen abgeschlossener/stornierter Fälle. */
export function caseReasonRequired(from: CaseStatusKey, to: CaseStatusKey): boolean {
  return to === 'CANCELLED' || CASE_TERMINAL.includes(from);
}

/** Schritte der Fortschrittsanzeige im Fallkopf: Anfrage → Termin → Besichtigung → Kalkulation → Gutachten → Versand → Abrechnung. */
export const CASE_PROGRESS = ['Anfrage', 'Termin', 'Besichtigung', 'Kalkulation', 'Gutachten', 'Versand', 'Abrechnung'] as const;
/** Index des AKTUELLEN Schritts (== CASE_PROGRESS.length bedeutet: alles erledigt). */
export function caseProgressIndex(status: CaseStatusKey): number {
  switch (normalizeCaseStatus(status)) {
    case 'NEW': return 0;
    case 'APPOINTMENT_PENDING':
    case 'APPOINTMENT_SET': return 1;
    case 'INSPECTED': return 2;
    case 'CALCULATION': return 3;
    case 'REPORT_DRAFT':
    case 'REVIEW':
    case 'APPROVED': return 4;
    case 'SENT': return 5;
    case 'BILLING': return 6;
    case 'CLOSED': return CASE_PROGRESS.length;
    default: return 0; // Storniert: Fortschritt wird nicht gezeigt
  }
}

export const PRIORITIES = ['NORMAL', 'HIGH', 'URGENT'] as const;
export type PriorityKey = (typeof PRIORITIES)[number];
export const PRIORITY_LABELS: Record<PriorityKey, string> = { NORMAL: 'Normal', HIGH: 'Hoch', URGENT: 'Dringend' };

export const CLAIM_TYPES = ['LIABILITY', 'COMPREHENSIVE', 'PARTIAL_COMPREHENSIVE', 'OWN_DAMAGE', 'VALUATION', 'EVIDENCE', 'OTHER'] as const;
export type ClaimTypeKey = (typeof CLAIM_TYPES)[number];
export const CLAIM_LABELS: Record<ClaimTypeKey, string> = {
  LIABILITY: 'Haftpflichtschaden', COMPREHENSIVE: 'Vollkaskoschaden', PARTIAL_COMPREHENSIVE: 'Teilkaskoschaden', OWN_DAMAGE: 'Eigenschaden',
  VALUATION: 'Wertgutachten', EVIDENCE: 'Beweissicherung', OTHER: 'Sonstiges',
};

export const ORG_KINDS = ['INSURANCE', 'LAWYER', 'WORKSHOP', 'DEALERSHIP', 'PARTNER'] as const;
export type OrgKindKey = (typeof ORG_KINDS)[number];
export const ORG_LABELS: Record<OrgKindKey, { one: string; many: string; slug: string }> = {
  INSURANCE: { one: 'Versicherung', many: 'Versicherungen', slug: 'versicherungen' },
  LAWYER: { one: 'Kanzlei', many: 'Rechtsanwälte', slug: 'rechtsanwaelte' },
  WORKSHOP: { one: 'Werkstatt', many: 'Werkstätten', slug: 'werkstaetten' },
  DEALERSHIP: { one: 'Autohaus', many: 'Autohäuser', slug: 'autohaeuser' },
  PARTNER: { one: 'Partner', many: 'Vermittler / Partner', slug: 'partner' },
};
export const orgKindFromSlug = (slug: string): OrgKindKey | null => ORG_KINDS.find((k) => ORG_LABELS[k].slug === slug) ?? null;

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
