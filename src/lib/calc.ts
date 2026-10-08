/**
 * Reparaturkalkulation – reine Rechenlogik (Server, Browser und Tests rechnen identisch).
 * Alles in ganzen Cent; Zeiten in Minuten. Kein Gleitkomma-Geld.
 *
 *  - Ersatzteile: Menge × Einzelpreis × (1 − Rabatt)
 *  - Arbeitslohn (Karosserie/Mechanik/Elektrik/Lack): Minuten/60 × Stundensatz der Kategorie
 *  - Lackmaterial: Prozentsatz der Lackierarbeit
 *  - Sonstiges (Verbringung, Entsorgung, Kleinteile): Menge × Einzelpreis
 *  - UPE-/Verbringungsaufschlag auf Teile: Prozentsatz der Teilesumme
 *  - MwSt auf die Nettosumme
 */

export const CALC_KINDS = ['PART', 'LABOR', 'PAINT', 'MISC'] as const;
export type CalcKind = (typeof CALC_KINDS)[number];
export const KIND_LABELS: Record<CalcKind, string> = { PART: 'Ersatzteile', LABOR: 'Arbeitslohn', PAINT: 'Lackierung', MISC: 'Sonstiges / Nebenkosten' };

export const LABOR_CATEGORIES = ['BODY', 'MECHANIC', 'ELECTRIC'] as const;
export type LaborCategory = (typeof LABOR_CATEGORIES)[number];
export const LABOR_LABELS: Record<LaborCategory, string> = { BODY: 'Karosserie', MECHANIC: 'Mechanik', ELECTRIC: 'Elektrik' };

export type CalcRates = { body: number | null; mechanic: number | null; electric: number | null; paint: number | null };
export type CalcHeader = { vatBp: number; minutesPerAw: number; rates: CalcRates; partsMarkupBp: number; paintMaterialBp: number };

export type CalcLine = {
  kind: CalcKind;
  laborCategory?: LaborCategory | null;
  /** Menge × 100 (Teile/Sonstiges); bei Arbeit unbenutzt */
  quantityX100: number;
  /** Arbeitszeit in Minuten (Lohn/Lack) */
  minutes: number;
  unitPriceCents: number;
  /** Rabatt in Basispunkten (1000 = 10 %) */
  discountBp: number;
};

const round = Math.round;

export const awToMinutes = (aw: number, minutesPerAw: number) => round(aw * minutesPerAw);
export const minutesToAw = (minutes: number, minutesPerAw: number) => minutes / minutesPerAw;

/** Stundensatz einer Zeile (Cent/Stunde) oder null, wenn für die Kategorie keiner hinterlegt ist. */
export function rateFor(line: Pick<CalcLine, 'kind' | 'laborCategory'>, rates: CalcRates): number | null {
  if (line.kind === 'PAINT') return rates.paint;
  if (line.kind === 'LABOR') return line.laborCategory === 'MECHANIC' ? rates.mechanic : line.laborCategory === 'ELECTRIC' ? rates.electric : rates.body;
  return null;
}

/** Zeilensumme (netto) in Cent. Eine Arbeitszeile ohne Stundensatz zählt 0 – `missingRate` weist darauf hin. */
export function lineTotal(line: CalcLine, rates: CalcRates): number {
  if (line.kind === 'LABOR' || line.kind === 'PAINT') {
    const rate = rateFor(line, rates);
    return rate == null ? 0 : round((Math.max(0, line.minutes) / 60) * rate);
  }
  const gross = (Math.max(0, line.quantityX100) / 100) * line.unitPriceCents;
  return round(gross * (1 - Math.min(10_000, Math.max(0, line.discountBp)) / 10_000));
}

export const missingRate = (line: CalcLine, rates: CalcRates) => (line.kind === 'LABOR' || line.kind === 'PAINT') && line.minutes > 0 && rateFor(line, rates) == null;

export type CalcTotals = {
  parts: number; partsMarkup: number; laborBody: number; laborMechanic: number; laborElectric: number; labor: number; paintLabor: number; paintMaterial: number; misc: number;
  net: number; vat: number; gross: number; minutes: number; aw: number; paintMinutes: number; missingRates: number;
};

export function totals(lines: CalcLine[], head: CalcHeader): CalcTotals {
  let parts = 0, laborBody = 0, laborMechanic = 0, laborElectric = 0, paintLabor = 0, misc = 0, minutes = 0, paintMinutes = 0, missing = 0;
  for (const l of lines) {
    const t = lineTotal(l, head.rates);
    if (missingRate(l, head.rates)) missing++;
    if (l.kind === 'PART') parts += t;
    else if (l.kind === 'MISC') misc += t;
    else if (l.kind === 'PAINT') { paintLabor += t; paintMinutes += l.minutes; }
    else {
      if (l.laborCategory === 'MECHANIC') laborMechanic += t; else if (l.laborCategory === 'ELECTRIC') laborElectric += t; else laborBody += t;
      minutes += l.minutes;
    }
  }
  const partsMarkup = round((parts * head.partsMarkupBp) / 10_000);
  const paintMaterial = round((paintLabor * head.paintMaterialBp) / 10_000);
  const labor = laborBody + laborMechanic + laborElectric;
  const net = parts + partsMarkup + labor + paintLabor + paintMaterial + misc;
  const vat = round((net * head.vatBp) / 10_000);
  return {
    parts, partsMarkup, laborBody, laborMechanic, laborElectric, labor, paintLabor, paintMaterial, misc, net, vat, gross: net + vat,
    minutes: minutes + paintMinutes, aw: (minutes + paintMinutes) / head.minutesPerAw, paintMinutes, missingRates: missing,
  };
}

/* ------------------------------------------------------------ Versionsvergleich */

export type DiffItem = CalcLine & { ref: string; description: string; partNumber?: string | null };
export type ItemChange = { ref: string; description: string; fields: string[]; before: DiffItem; after: DiffItem; deltaCents: number };
export type CalcDiff = {
  added: (DiffItem & { totalCents: number })[];
  removed: (DiffItem & { totalCents: number })[];
  changed: ItemChange[];
  unchanged: number;
  netBefore: number; netAfter: number; grossBefore: number; grossAfter: number;
};

const FIELD_LABELS: Record<string, string> = { description: 'Bezeichnung', quantityX100: 'Menge', minutes: 'Zeit', unitPriceCents: 'Einzelpreis', discountBp: 'Rabatt', kind: 'Art', laborCategory: 'Kategorie', partNumber: 'Teilenummer' };

/** Positionen werden über die stabile `ref` zugeordnet (bleibt beim Kopieren in eine neue Version erhalten). */
export function diffCalculations(a: { items: DiffItem[]; head: CalcHeader }, b: { items: DiffItem[]; head: CalcHeader }): CalcDiff {
  const am = new Map(a.items.map((i) => [i.ref, i])), bm = new Map(b.items.map((i) => [i.ref, i]));
  const added: CalcDiff['added'] = [], removed: CalcDiff['removed'] = [], changed: ItemChange[] = [];
  let unchanged = 0;
  for (const [ref, nb] of bm) {
    const na = am.get(ref);
    if (!na) { added.push({ ...nb, totalCents: lineTotal(nb, b.head.rates) }); continue; }
    const fields = (['description', 'partNumber', 'kind', 'laborCategory', 'quantityX100', 'minutes', 'unitPriceCents', 'discountBp'] as const)
      .filter((f) => (na[f] ?? null) !== (nb[f] ?? null)).map((f) => FIELD_LABELS[f]);
    const delta = lineTotal(nb, b.head.rates) - lineTotal(na, a.head.rates);
    if (fields.length || delta !== 0) changed.push({ ref, description: nb.description, fields, before: na, after: nb, deltaCents: delta }); else unchanged++;
  }
  for (const [ref, na] of am) if (!bm.has(ref)) removed.push({ ...na, totalCents: lineTotal(na, a.head.rates) });
  const ta = totals(a.items, a.head), tb = totals(b.items, b.head);
  return { added, removed, changed, unchanged, netBefore: ta.net, netAfter: tb.net, grossBefore: ta.gross, grossAfter: tb.gross };
}
