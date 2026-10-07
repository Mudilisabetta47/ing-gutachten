/**
 * Geld wird überall als ganze Cent gespeichert und gerechnet (nie als Gleitkomma-Euro) –
 * so gibt es keine Rundungsfehler in Kalkulation, Rechnung und Zahlungen.
 */
const EUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

/** 123456 → „1.234,56 €“ */
export const fmtEuro = (cents: number | null | undefined): string => (cents == null ? '–' : EUR.format(cents / 100));

/** 18500 → „185,00“ (für Eingabefelder) */
export const centsToInput = (cents: number | null | undefined): string => (cents == null ? '' : (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

/** „1.234,56“ / „1234.56“ / „185“ → Cent; leer → null; ungültig → NaN */
export function parseEuroToCents(input: unknown): number | null {
  if (input === '' || input == null) return null;
  let s = String(input).trim().replace(/[€\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) && Math.abs(n) < 100_000_000 ? Math.round(n * 100) : Number.NaN;
}

/** Basispunkte ⇄ Prozent: 1900 ↔ „19“ */
export const bpToInput = (bp: number | null | undefined): string => (bp == null ? '' : String(bp / 100).replace('.', ','));
export const fmtPercent = (bp: number | null | undefined): string => (bp == null ? '–' : `${(bp / 100).toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`);

/** Betrag × Prozent (Basispunkte), kaufmännisch gerundet. */
export const percentOf = (cents: number, bp: number): number => Math.round((cents * bp) / 10_000);
