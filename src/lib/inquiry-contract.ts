/**
 * Vertrag zwischen dem Anfrageformular der öffentlichen Website und der geschützten Anfrage-API von ING Studio
 * (POST /api/anfrage, Quelle: ING-Studio-Repository, src/app/api/anfrage/route.ts und src/lib/request-schema.ts).
 *
 * STATUS: reine Vorbereitung. FORM_ENDPOINT ist leer, es wird nichts übertragen. Die Grenzen unten spiegeln die serverseitigen
 * Grenzen (der Server bleibt maßgeblich und prüft alles erneut). Änderungen dort müssen hier nachgezogen werden;
 * tests/inquiry-contract.test.mjs prüft die Übereinstimmung gegen den ING-Studio-Code, sofern ING_STUDIO_SRC gesetzt ist.
 */
export const SERVER_LIMITS = {
  maxPhotos: 8,
  maxPhotoBytes: 1_600_000,
  maxDocBytes: 1_600_000,
  maxTotalBytes: 4_300_000,
  minFillMs: 2500,
  name: 120,
  phone: 40,
  email: 200,
  place: 200,
  message: 2000,
} as const;

/** Vom Server akzeptierte Dateitypen (Prüfung dort per Dateiinhalt, nicht per Endung). */
export const SERVER_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type InquiryValues = {
  anlass: string;
  fahrzeug: string;
  name: string;
  telefon: string;
  email: string;
  standort: string;
  nachricht: string;
  datenschutz: boolean;
};

export type InquiryParts = {
  values: InquiryValues;
  photos: File[];
  /** Fahrzeugschein – aktuell nicht im Formular (SHOW_DOC_UPLOAD=false). */
  document?: File | null;
  /** Zeitpunkt (ms), an dem das Formular geöffnet wurde – Server verwirft Absendungen unter 2,5 s als Bot. */
  startedAt: number;
  /** Pro Formularaufruf einmal erzeugter Schlüssel; erneutes Absenden (Doppelklick, Wiederholung nach Fehler) trägt denselben Schlüssel. */
  idempotencyKey?: string;
};

/** Baut genau die Felder, die die API liest: Textfelder, `foto` (mehrfach), `fahrzeugschein`, Honeypot `website` (leer), `t`. */
export function buildInquiryFormData({ values, photos, document, startedAt, idempotencyKey }: InquiryParts): FormData {
  const data = new FormData();
  data.append('anlass', values.anlass);
  data.append('fahrzeug', values.fahrzeug);
  data.append('name', values.name);
  data.append('telefon', values.telefon);
  data.append('email', values.email);
  data.append('standort', values.standort);
  data.append('nachricht', values.nachricht);
  data.append('datenschutz', values.datenschutz ? 'true' : 'false');
  data.append('website', ''); // Honeypot: echte Besucher lassen das Feld leer
  data.append('t', String(startedAt));
  if (idempotencyKey) data.append('idempotencyKey', idempotencyKey); // VORBEREITET: der Server liest das Feld heute noch nicht (unbekannte Felder werden ignoriert)
  photos.forEach((f) => data.append('foto', f));
  if (document) data.append('fahrzeugschein', document);
  return data;
}

/** Zufälliger, nicht erratbarer Schlüssel (UUID v4). */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** Erwartete Antwort der API (nur die Felder, die das Formular nutzt). */
export type InquiryResponse = { ok: boolean; reference?: string; message?: string; error?: string };

/** Prüft die Dateigrenzen vor dem Senden. Gibt eine verständliche Meldung zurück oder null. */
export function checkInquiryFiles(photos: File[], document?: File | null): string | null {
  if (photos.length > SERVER_LIMITS.maxPhotos) return `Bitte höchstens ${SERVER_LIMITS.maxPhotos} Fotos senden.`;
  let total = 0;
  for (const f of photos) {
    if (!(SERVER_PHOTO_TYPES as readonly string[]).includes(f.type)) return 'Bitte Fotos als JPG, PNG oder WebP senden.';
    if (f.size > SERVER_LIMITS.maxPhotoBytes) return 'Ein Foto ist zu groß. Bitte ein kleineres Foto wählen.';
    total += f.size;
  }
  if (document) {
    if (document.size > SERVER_LIMITS.maxDocBytes) return 'Der Fahrzeugschein ist zu groß.';
    total += document.size;
  }
  if (total > SERVER_LIMITS.maxTotalBytes) return 'Die Dateien sind zusammen zu groß. Bitte weniger oder kleinere Fotos senden.';
  return null;
}

/**
 * Bereitet ein Foto im Browser auf: längste Kante höchstens 1600 px, als JPEG neu kodiert.
 * Die Neukodierung entfernt zugleich Metadaten (EXIF, z. B. GPS-Position und Gerätedaten) – bewusst auch bei kleinen Fotos.
 * Gelingt die Umwandlung nicht (z. B. HEIC in Chrome), wird die Originaldatei zurückgegeben; die Größen- und Typprüfung
 * meldet dann verständlich, was zu tun ist. Der Server prüft ohnehin alles erneut.
 */
export async function downscaleImage(file: File, maxBytes: number = SERVER_LIMITS.maxPhotoBytes, maxEdge = 1600): Promise<File> {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#ffffff'; // Transparenz (PNG/WebP) wird zu Weiß statt Schwarz
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    for (const q of [0.86, 0.78, 0.7, 0.6, 0.5]) {
      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', q));
      if (blob && blob.size <= maxBytes) return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    }
  } catch {
    /* nicht dekodierbar → Original zurück */
  }
  return file;
}
