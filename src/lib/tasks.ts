/** Aufgaben & Wiedervorlagen – reine Hilfen (ohne Datenbank). */
export { berlinToday } from './berlin';
export { addDays } from './invoice';

export const PRIORITY_LABELS: Record<string, string> = { NORMAL: 'Normal', HIGH: 'Hoch', URGENT: 'Dringend' };
export const KIND_LABELS: Record<string, string> = { TASK: 'Aufgabe', FOLLOW_UP: 'Wiedervorlage' };
export const STATUS_LABELS: Record<string, string> = { OPEN: 'Offen', DONE: 'Erledigt', CANCELLED: 'Abgebrochen' };

/** Gruppe für die Wiedervorlagen-Ansicht. */
export function dueBucket(due: string | null, today: string, weekEnd: string): 'overdue' | 'today' | 'week' | 'later' | 'none' {
  if (!due) return 'none';
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  return due <= weekEnd ? 'week' : 'later';
}
