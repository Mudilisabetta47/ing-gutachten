/**
 * Rechnungen – reine Rechenlogik (Cent, Basispunkte). Keine Datenbank, keine Seiteneffekte.
 */
export type InvItem = { quantityX100: number; unitPriceCents: number; vatBp: number };

const round = Math.round;
export const itemNet = (i: Pick<InvItem, 'quantityX100' | 'unitPriceCents'>) => round((i.quantityX100 / 100) * i.unitPriceCents);

export type VatGroup = { vatBp: number; netCents: number; vatCents: number };
export type InvoiceTotals = { netCents: number; vatCents: number; grossCents: number; groups: VatGroup[] };

/** MwSt je Steuersatz auf die Summe der Nettopositionen dieses Satzes (nicht je Zeile) – vermeidet Rundungsdifferenzen. */
export function invoiceTotals(items: InvItem[]): InvoiceTotals {
  const by = new Map<number, number>();
  for (const i of items) by.set(i.vatBp, (by.get(i.vatBp) ?? 0) + itemNet(i));
  const groups = [...by.entries()].sort((a, b) => b[0] - a[0]).map(([vatBp, netCents]) => ({ vatBp, netCents, vatCents: round((netCents * vatBp) / 10_000) }));
  const netCents = groups.reduce((n, g) => n + g.netCents, 0), vatCents = groups.reduce((n, g) => n + g.vatCents, 0);
  return { netCents, vatCents, grossCents: netCents + vatCents, groups };
}

export type InvoiceState = 'DRAFT' | 'OPEN' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export const STATE_LABELS: Record<InvoiceState, string> = { DRAFT: 'Entwurf', OPEN: 'Offen', PARTIAL: 'Teilweise bezahlt', PAID: 'Bezahlt', OVERDUE: 'Überfällig', CANCELLED: 'Storniert' };
export const STATE_TONE: Record<InvoiceState, 'muted' | 'info' | 'warn' | 'ok' | 'danger'> = { DRAFT: 'muted', OPEN: 'info', PARTIAL: 'warn', PAID: 'ok', OVERDUE: 'danger', CANCELLED: 'muted' };

/** Zustand aus Status, Zahlungen und Fälligkeit; `today` als „JJJJ-MM-TT“ (Berlin). */
export function invoiceState(i: { status: 'DRAFT' | 'ISSUED' | 'CANCELLED'; grossCents: number; paidCents: number; dueDate: string | null }, today: string): InvoiceState {
  if (i.status === 'DRAFT') return 'DRAFT';
  if (i.status === 'CANCELLED') return 'CANCELLED';
  if (i.paidCents >= i.grossCents) return 'PAID';
  if (i.dueDate && i.dueDate < today) return 'OVERDUE';
  return i.paidCents > 0 ? 'PARTIAL' : 'OPEN';
}
export const openCents = (i: { grossCents: number; paidCents: number }) => Math.max(0, i.grossCents - i.paidCents);

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export const daysBetween = (fromYmd: string, toYmd: string) => Math.round((Date.parse(`${toYmd}T00:00:00Z`) - Date.parse(`${fromYmd}T00:00:00Z`)) / 86_400_000);
export const deDate = (ymd: string | null | undefined) => (ymd ? ymd.split('-').reverse().join('.') : '–');

export const DUNNING_LABELS: Record<number, string> = { 1: 'Zahlungserinnerung', 2: '1. Mahnung', 3: '2. Mahnung' };
export const nextDunningLevel = (existing: { level: number; status: string }[]): number | null => {
  const max = existing.filter((d) => d.status !== 'CANCELLED').reduce((m, d) => Math.max(m, d.level), 0);
  return max >= 3 ? null : max + 1;
};

/** Zelle für CSV-Export: Formeln neutralisieren (=, +, -, @) und Trennzeichen/Anführungszeichen sicher maskieren. */
export function csvCell(v: string | number | null | undefined): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = `'${s}`;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
