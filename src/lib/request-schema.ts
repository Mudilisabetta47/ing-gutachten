/**
 * Gemeinsame Regeln für das Anfrageformular – vom Browser (Komfort) UND vom
 * Server (maßgeblich) verwendet. Der Server traut dem Browser nie.
 */

export const REQUEST_REASONS = ['Unfall', 'Parkschaden', 'Wertgutachten', 'Fahrzeugbewertung', 'Leasingrückgabe', 'Sonstiges'] as const;
export const REQUEST_VEHICLES = ['PKW', 'LKW', 'Motorrad', 'Elektro / Hybrid', 'Oldtimer'] as const;

export const LIMITS = {
  maxPhotos: 8,
  /** Vercel Functions nehmen maximal 4,5 MB Request-Body an – darunter bleiben. */
  maxTotalBytes: 4_300_000,
  maxPhotoBytes: 1_600_000,
  maxDocBytes: 1_600_000,
  name: 120,
  phone: 40,
  email: 200,
  place: 200,
  message: 2000,
  /** Absendungen schneller als das sind Bots. */
  minFillMs: 2500,
} as const;

export const PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const DOC_MIME = [...PHOTO_MIME, 'application/pdf'] as const;

export type FieldErrors = Partial<Record<'anlass' | 'fahrzeug' | 'name' | 'telefon' | 'email' | 'standort' | 'nachricht' | 'datenschutz' | 'fotos', string>>;

export type RequestFields = {
  anlass: string;
  fahrzeug: string;
  name: string;
  telefon: string;
  email: string;
  standort: string;
  nachricht: string;
  datenschutz: boolean;
};

/** Steuerzeichen raus, Weißraum kollabieren, hart kürzen. */
export function clean(value: unknown, max: number, multiline = false): string {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  let v = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  v = multiline ? v.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : v.replace(/\s+/g, ' ');
  return v.trim().slice(0, max);
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

/** Validiert die Textfelder. `step` begrenzt die Prüfung für die Schritt-Navigation im Browser. */
export function validateFields(f: RequestFields, upTo: 'schaden' | 'kontakt' | 'alle' = 'alle'): FieldErrors {
  const e: FieldErrors = {};
  if (!(REQUEST_REASONS as readonly string[]).includes(f.anlass)) e.anlass = 'Bitte einen Anlass wählen.';
  if (!(REQUEST_VEHICLES as readonly string[]).includes(f.fahrzeug)) e.fahrzeug = 'Bitte ein Fahrzeug wählen.';
  if (upTo === 'schaden') return e;
  if (f.name.length < 2) e.name = 'Bitte Ihren Namen angeben.';
  if (f.telefon.replace(/\D/g, '').length < 6) e.telefon = 'Bitte eine erreichbare Telefonnummer angeben.';
  if (!EMAIL_RE.test(f.email)) e.email = 'Bitte eine gültige E-Mail-Adresse angeben.';
  if (upTo === 'kontakt') return e;
  if (!f.datenschutz) e.datenschutz = 'Bitte der Datenschutzerklärung zustimmen.';
  return e;
}

/* ---------- Dateien: Typ nicht dem Browser glauben, sondern Magic Bytes prüfen ---------- */

export type DetectedType = { mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'; ext: 'jpg' | 'png' | 'webp' | 'pdf' };

export function detectType(bytes: Uint8Array): DetectedType | null {
  const b = bytes;
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a)
    return { mime: 'image/png', ext: 'png' };
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return { mime: 'image/webp', ext: 'webp' };
  if (b.length > 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return { mime: 'application/pdf', ext: 'pdf' };
  return null;
}
