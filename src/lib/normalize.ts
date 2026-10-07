/**
 * Normalisierung für Suche und Dublettenerkennung – reine Funktionen, überall nutzbar
 * (Server, Tests, Browser). Gespeichert wird immer BEIDES: Anzeige-Form und Such-Form.
 */

/** Suchform eines Kennzeichens: nur Buchstaben/Ziffern, groß. "H-AB 123" und "hab123" → "HAB123". */
export function normalizePlate(input?: string | null): string | null {
  if (!input) return null;
  const n = input.normalize('NFC').toLocaleUpperCase('de-DE').replace(/[^A-ZÄÖÜ0-9]/g, '');
  return n.length >= 2 ? n.slice(0, 12) : null;
}

/**
 * Anzeigeform: "h ab 123" → "H-AB 123". Ohne Trennzeichen im Original lässt sich der Ortsteil
 * nicht sicher bestimmen (HAB123 → H-AB oder HA-B?) – dann bleibt die Eingabe, nur sauber in Großbuchstaben.
 */
export function formatPlate(input?: string | null): string | null {
  if (!input) return null;
  const v = input.normalize('NFC').toLocaleUpperCase('de-DE').replace(/[^A-ZÄÖÜ0-9\s-]/g, '').replace(/\s+/g, ' ').trim();
  if (!normalizePlate(v)) return null;
  const m = v.match(/^([A-ZÄÖÜ]{1,3})[\s-]+([A-Z]{1,2})[\s-]*(\d{1,4}[EH]?)$/);
  return m ? `${m[1]}-${m[2]} ${m[3]}` : v.slice(0, 20);
}

/** Telefonnummer → Vergleichsform: "+49 511 543 00 976", "0511/54300976" → "051154300976". */
export function normalizePhone(input?: string | null): string | null {
  if (!input) return null;
  let s = input.replace(/\(0\)/g, '').replace(/[^\d+]/g, '');
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  if (s.startsWith('+49')) s = `0${s.slice(3)}`;
  s = s.replace(/\+/g, (m, i) => (i === 0 ? m : ''));
  const digits = s.replace(/\D/g, '');
  return digits.length >= 6 ? s.slice(0, 20) : null;
}

export type VinResult = { value: string | null; error?: string; warning?: string };

/**
 * Fahrgestellnummer: großzügig prüfen. Moderne FIN hat 17 Zeichen ohne I, O, Q – ältere/historische
 * Fahrzeuge weichen ab und dürfen trotzdem erfasst werden (dann nur Hinweis, kein Fehler).
 */
export function parseVin(input?: string | null): VinResult {
  const v = (input ?? '').toLocaleUpperCase('de-DE').replace(/[\s-]+/g, '');
  if (!v) return { value: null };
  if (!/^[A-Z0-9]+$/.test(v)) return { value: null, error: 'Die Fahrgestellnummer darf nur Buchstaben und Ziffern enthalten.' };
  if (v.length > 17) return { value: null, error: 'Die Fahrgestellnummer hat höchstens 17 Zeichen.' };
  if (v.length < 5) return { value: null, error: 'Die Fahrgestellnummer ist zu kurz.' };
  if (v.length !== 17) return { value: v, warning: 'Keine 17 Zeichen – bei historischen Fahrzeugen möglich.' };
  if (/[IOQ]/.test(v)) return { value: v, warning: 'Enthält I, O oder Q – bitte prüfen.' };
  return { value: v };
}

/** "Max Mustermann" → Vor-/Nachname (letztes Wort = Nachname). Nur ein Vorschlag, im Assistenten änderbar. */
export function splitName(full: string): { firstName: string; lastName: string } {
  // Anhängsel in Klammern („Anna Beispiel (Demo)“) gehören nicht zum Namen.
  const parts = full.replace(/\s*\([^)]*\)\s*$/, '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: '', lastName: parts[0] ?? '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

/**
 * Suchbegriff → Telefon-Suchmuster. Nur, wenn die Eingabe wie eine Telefonnummer aussieht
 * (Ziffern und übliche Trennzeichen) – "hab123" ist ein Kennzeichen, keine Telefonnummer.
 */
export function phoneNeedle(term: string): string | null {
  if (!/^[\d\s+()/.\-]+$/.test(term)) return null;
  return normalizePhone(term) ?? (term.replace(/\D/g, '').length >= 3 ? term.replace(/\D/g, '') : null);
}
