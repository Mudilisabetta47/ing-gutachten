/** Tagesgrenzen in Europe/Berlin (Sommer-/Winterzeit-sicher) für Datumsfilter. */
function offsetMs(at: Date): number {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', timeZoneName: 'longOffset' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+00:00';
  const m = part.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) * 60_000;
}

/** "2026-10-07" → [00:00, 24:00) Berlin als UTC-Zeitpunkte. */
export function berlinDayRange(day: string): { start: Date; end: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const midnightUtc = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(midnightUtc)) return null;
  const at = (ms: number) => {
    let guess = ms - offsetMs(new Date(ms));
    guess = ms - offsetMs(new Date(guess)); // zweiter Durchlauf: Umstellungstage
    return new Date(guess);
  };
  return { start: at(midnightUtc), end: at(midnightUtc + 86_400_000) };
}

export const berlinToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now);

/** "2026-10-08T09:30" (Eingabe aus <input type="datetime-local">, Berliner Ortszeit) → UTC-Zeitpunkt. */
export function berlinLocalToDate(local: string): Date | null {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(naive)) return null;
  let guess = naive - offsetMs(new Date(naive));
  guess = naive - offsetMs(new Date(guess));
  return new Date(guess);
}

/** UTC-Zeitpunkt → Wert für <input type="datetime-local"> in Berliner Ortszeit. */
export function toBerlinLocalInput(d: Date | null | undefined): string {
  if (!d) return '';
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
