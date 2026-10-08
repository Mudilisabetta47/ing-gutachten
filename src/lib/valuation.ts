/**
 * Bewertung – reine Rechenlogik. Alles in ganzen Cent.
 *
 * Wichtig: Die Totalschaden-Einordnung ist eine RECHENHILFE mit den eingetragenen Werten. Sie ersetzt weder die Beurteilung des
 * Sachverständigen noch eine rechtliche Bewertung; die Grenzen (insb. der Prozentsatz der Integritätsgrenze) sind einstellbar.
 */

export type TaxModeKey = 'GROSS' | 'NET' | 'NONE';
export const TAX_LABELS: Record<TaxModeKey, string> = { GROSS: 'brutto', NET: 'netto', NONE: 'ohne MwSt-Ausweis' };

export const VALUATION_TYPES = ['REPLACEMENT_VALUE', 'RESIDUAL_VALUE', 'RESIDUAL_OFFER', 'DIMINISHED_VALUE', 'USAGE_LOSS', 'REPAIR_DURATION', 'REPLACEMENT_DURATION'] as const;
export type ValuationTypeKey = (typeof VALUATION_TYPES)[number];
export const TYPE_LABELS: Record<ValuationTypeKey, string> = {
  REPLACEMENT_VALUE: 'Wiederbeschaffungswert', RESIDUAL_VALUE: 'Restwert', RESIDUAL_OFFER: 'Restwertangebot', DIMINISHED_VALUE: 'Wertminderung',
  USAGE_LOSS: 'Nutzungsausfall (Tagessatz)', REPAIR_DURATION: 'Reparaturdauer', REPLACEMENT_DURATION: 'Wiederbeschaffungsdauer',
};
/** Welche Typen tragen Geldbeträge, welche Tage? */
export const IS_MONEY: Record<ValuationTypeKey, boolean> = { REPLACEMENT_VALUE: true, RESIDUAL_VALUE: true, RESIDUAL_OFFER: true, DIMINISHED_VALUE: true, USAGE_LOSS: true, REPAIR_DURATION: false, REPLACEMENT_DURATION: false };

export const SOURCE_LABELS: Record<string, string> = { MANUAL: 'Manuell', VERGLEICH: 'Vergleichsfahrzeuge', ANGEBOT: 'Angebot', TABELLE: 'Tabelle (manuell abgelesen)' };
export const sourceName = (s: string) => SOURCE_LABELS[s] ?? s;

/** Betrag von einer Steuerbasis in eine andere. NONE bleibt unverändert (keine Umrechnung möglich). */
export function convertTax(cents: number, from: TaxModeKey, to: TaxModeKey, vatBp: number): number {
  if (from === to || from === 'NONE' || to === 'NONE') return cents;
  return from === 'GROSS' ? Math.round((cents * 10_000) / (10_000 + vatBp)) : Math.round((cents * (10_000 + vatBp)) / 10_000);
}

export const usageLossTotal = (days: number | null | undefined, rateCents: number | null | undefined): number | null => (days != null && rateCents != null ? days * rateCents : null);

/* ------------------------------------------------------------ Vergleichsfahrzeuge */

export type Comparable = { priceCents: number; included: boolean };
/** Vorschlag (Median, Mittelwert) aus den einbezogenen Vergleichsfahrzeugen – wird nie automatisch als Wert übernommen. */
export function comparableStats(list: Comparable[]): { n: number; median: number | null; mean: number | null; min: number | null; max: number | null } {
  const p = list.filter((c) => c.included).map((c) => c.priceCents).sort((a, b) => a - b);
  if (!p.length) return { n: 0, median: null, mean: null, min: null, max: null };
  const mid = Math.floor(p.length / 2);
  return { n: p.length, median: p.length % 2 ? p[mid] : Math.round((p[mid - 1] + p[mid]) / 2), mean: Math.round(p.reduce((a, b) => a + b, 0) / p.length), min: p[0], max: p[p.length - 1] };
}

/* ------------------------------------------------------------ Reparatur ⇄ Totalschaden */

export type Decision = 'UNKNOWN' | 'REPAIR' | 'BETWEEN' | 'TOTAL_LOSS';
export type DecisionInput = {
  /** Reparaturkosten auf der Basis `basis` */
  repairCents: number | null;
  /** Wiederbeschaffungswert (Betrag + wie er angegeben wurde) */
  replacement: { cents: number; tax: TaxModeKey } | null;
  residual: { cents: number; tax: TaxModeKey } | null;
  basis: TaxModeKey;
  vatBp: number;
  /** Integritätsgrenze in Basispunkten des WBW; Standard 13000 = 130 % */
  limitBp?: number;
};
export type DecisionResult = {
  state: Decision; basis: TaxModeKey;
  repair: number | null; replacement: number | null; residual: number | null;
  /** Wiederbeschaffungsaufwand = WBW − Restwert */
  replacementEffort: number | null; limit: number | null; ratioBp: number | null; limitBp: number;
  notes: string[];
};

export function decide(i: DecisionInput): DecisionResult {
  const limitBp = i.limitBp ?? 13000;
  const w = i.replacement ? convertTax(i.replacement.cents, i.replacement.tax, i.basis, i.vatBp) : null;
  const r = i.residual ? convertTax(i.residual.cents, i.residual.tax, i.basis, i.vatBp) : null;
  const notes: string[] = [];
  if (i.replacement?.tax === 'NONE' || i.residual?.tax === 'NONE') notes.push('Mindestens ein Wert ist „ohne MwSt-Ausweis“ angegeben und wurde unverändert verwendet (keine Umrechnung möglich).');
  const base = { basis: i.basis, repair: i.repairCents, replacement: w, residual: r, limitBp };
  if (i.repairCents == null || w == null || w <= 0) {
    if (i.repairCents == null) notes.push('Keine Kalkulation vorhanden.');
    if (w == null) notes.push('Kein gewählter Wiederbeschaffungswert.');
    return { ...base, state: 'UNKNOWN', replacementEffort: null, limit: w == null ? null : Math.round((w * limitBp) / 10_000), ratioBp: null, notes };
  }
  if (r == null) notes.push('Kein gewählter Restwert – für die Einordnung wird 0 € angenommen (Hinweis beachten).');
  const effort = w - (r ?? 0);
  const limit = Math.round((w * limitBp) / 10_000);
  const ratioBp = Math.round((i.repairCents * 10_000) / w);
  const state: Decision = i.repairCents <= effort ? 'REPAIR' : i.repairCents <= limit ? 'BETWEEN' : 'TOTAL_LOSS';
  return { ...base, state, replacementEffort: effort, limit, ratioBp, notes };
}

export const DECISION_TEXT: Record<Decision, { title: string; text: string; tone: 'ok' | 'warn' | 'danger' | 'muted' }> = {
  UNKNOWN: { title: 'Noch nicht einordenbar', text: 'Für die Einordnung werden Reparaturkosten (Kalkulation) und ein gewählter Wiederbeschaffungswert benötigt.', tone: 'muted' },
  REPAIR: { title: 'Reparatur wirtschaftlich', text: 'Die Reparaturkosten liegen nicht über dem Wiederbeschaffungsaufwand (Wiederbeschaffungswert abzüglich Restwert).', tone: 'ok' },
  BETWEEN: { title: 'Zwischenbereich – Einzelfall prüfen', text: 'Die Reparaturkosten übersteigen den Wiederbeschaffungsaufwand, liegen aber innerhalb der eingestellten Grenze vom Wiederbeschaffungswert. Ob und wie abzurechnen ist, beurteilt der Sachverständige im Einzelfall.', tone: 'warn' },
  TOTAL_LOSS: { title: 'Wirtschaftlicher Totalschaden (rechnerisch)', text: 'Die Reparaturkosten übersteigen die eingestellte Grenze vom Wiederbeschaffungswert. Abrechnung auf Basis Wiederbeschaffungsaufwand ist zu prüfen.', tone: 'danger' },
};
