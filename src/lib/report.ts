/**
 * Gutachten – Inhaltsmodell, Variablen und Prüfregeln (rein, ohne Datenbank).
 *
 * Ein Gutachten besteht aus Kapiteln. Texte dürfen Variablen wie {{fahrzeug.hersteller}} enthalten; sie werden beim Anzeigen/PDF aus
 * den Falldaten ersetzt. Eine Variable ohne Wert wird NICHT leer gelassen oder erfunden, sondern als offener Punkt gemeldet.
 */

export const AUTO_KINDS = ['vehicle', 'damages', 'calculation', 'valuation', 'photos'] as const;
export type AutoKind = (typeof AUTO_KINDS)[number];

export type Chapter = { key: string; title: string; enabled: boolean; auto: AutoKind | null; text: string };
export type ReportContent = { chapters: Chapter[] };

export const AUTO_LABELS: Record<AutoKind, string> = {
  vehicle: 'Fahrzeugdaten (Tabelle)', damages: 'Schadenliste (aus der Schadenkarte)', calculation: 'Kalkulation (Positionen und Summen)', valuation: 'Bewertungswerte (Tabelle)', photos: 'Fotodokumentation',
};

/* ------------------------------------------------------------ Variablen */

export type VarDef = { key: string; label: string; group: string };
export const VARIABLES: VarDef[] = [
  { key: 'gutachten.nummer', label: 'Gutachtennummer', group: 'Gutachten' },
  { key: 'gutachten.datum', label: 'Datum des Gutachtens', group: 'Gutachten' },
  { key: 'heute', label: 'Heutiges Datum', group: 'Gutachten' },
  { key: 'fall.nummer', label: 'Fallnummer', group: 'Fall' },
  { key: 'fall.schadendatum', label: 'Schadendatum', group: 'Fall' },
  { key: 'fall.unfalldatum', label: 'Unfalldatum', group: 'Fall' },
  { key: 'fall.beschreibung', label: 'Schadenhergang / Beschreibung', group: 'Fall' },
  { key: 'schadennummer', label: 'Schadennummer der Versicherung', group: 'Fall' },
  { key: 'versicherung.name', label: 'Versicherung', group: 'Fall' },
  { key: 'kunde.name', label: 'Kunde / Auftraggeber', group: 'Kunde' },
  { key: 'kunde.anschrift', label: 'Anschrift des Kunden', group: 'Kunde' },
  { key: 'fahrzeug.hersteller', label: 'Hersteller', group: 'Fahrzeug' },
  { key: 'fahrzeug.modell', label: 'Modell', group: 'Fahrzeug' },
  { key: 'fahrzeug.typ', label: 'Hersteller und Modell', group: 'Fahrzeug' },
  { key: 'fahrzeug.kennzeichen', label: 'Kennzeichen', group: 'Fahrzeug' },
  { key: 'fahrzeug.fin', label: 'Fahrgestellnummer (FIN)', group: 'Fahrzeug' },
  { key: 'fahrzeug.erstzulassung', label: 'Erstzulassung', group: 'Fahrzeug' },
  { key: 'fahrzeug.km', label: 'Kilometerstand', group: 'Fahrzeug' },
  { key: 'fahrzeug.hsn_tsn', label: 'HSN / TSN', group: 'Fahrzeug' },
  { key: 'fahrzeug.leistung', label: 'Leistung', group: 'Fahrzeug' },
  { key: 'gutachter.name', label: 'Gutachter', group: 'Besichtigung' },
  { key: 'besichtigung.datum', label: 'Besichtigungsdatum', group: 'Besichtigung' },
  { key: 'besichtigung.ort', label: 'Besichtigungsort', group: 'Besichtigung' },
  { key: 'kalkulation.netto', label: 'Reparaturkosten netto', group: 'Kalkulation' },
  { key: 'kalkulation.brutto', label: 'Reparaturkosten brutto', group: 'Kalkulation' },
  { key: 'kalkulation.version', label: 'Kalkulationsversion', group: 'Kalkulation' },
  { key: 'bewertung.wbw', label: 'Wiederbeschaffungswert', group: 'Bewertung' },
  { key: 'bewertung.restwert', label: 'Restwert', group: 'Bewertung' },
  { key: 'bewertung.wertminderung', label: 'Wertminderung', group: 'Bewertung' },
  { key: 'bewertung.nutzungsausfall', label: 'Nutzungsausfall (gesamt)', group: 'Bewertung' },
  { key: 'bewertung.reparaturdauer', label: 'Reparaturdauer', group: 'Bewertung' },
  { key: 'bewertung.wiederbeschaffungsdauer', label: 'Wiederbeschaffungsdauer', group: 'Bewertung' },
];
export const VARIABLE_KEYS = new Set(VARIABLES.map((v) => v.key));

export type Vars = Record<string, string | null>;
const VAR_RE = /\{\{\s*([a-z0-9_.]+)\s*\}\}/gi;

export type Resolved = { text: string; missing: string[]; unknown: string[] };

/** Ersetzt Variablen. Fehlende Werte bleiben als „[fehlt: Bezeichnung]“ sichtbar – nie leer, nie erfunden. */
export function resolveText(text: string, vars: Vars): Resolved {
  const missing: string[] = [], unknown: string[] = [];
  const out = text.replace(VAR_RE, (_m, k: string) => {
    const key = k.toLowerCase();
    if (!VARIABLE_KEYS.has(key)) { unknown.push(key); return `[unbekannte Variable: ${key}]`; }
    const v = vars[key];
    if (v == null || v === '') { missing.push(key); return `[fehlt: ${VARIABLES.find((x) => x.key === key)!.label}]`; }
    return v;
  });
  return { text: out, missing: [...new Set(missing)], unknown: [...new Set(unknown)] };
}

/* ------------------------------------------------------------ Standardkapitel */

const ch = (key: string, title: string, auto: AutoKind | null, text: string, enabled = true): Chapter => ({ key, title, enabled, auto, text });

/** Struktur eines Kfz-Schadengutachtens. Die Texte sind bewusst sachlich-neutral; rechtliche oder fachliche Standardformulierungen legt der Betrieb als Textbausteine an. */
export function defaultContent(): ReportContent {
  return {
    chapters: [
      ch('auftrag', 'Auftrag und Allgemeines', null, 'Gutachten Nr. {{gutachten.nummer}} zum Fall {{fall.nummer}} vom {{gutachten.datum}}.\n\nAuftraggeber: {{kunde.name}}\nVersicherung: {{versicherung.name}}, Schadennummer: {{schadennummer}}\nGutachter: {{gutachter.name}}\nBesichtigung: {{besichtigung.datum}} in {{besichtigung.ort}}'),
      ch('fahrzeug', 'Fahrzeugdaten', 'vehicle', ''),
      ch('hergang', 'Schadenhergang', null, '{{fall.beschreibung}}'),
      ch('schaeden', 'Schadenfeststellung', 'damages', ''),
      ch('kalkulation', 'Reparaturkalkulation', 'calculation', ''),
      ch('bewertung', 'Bewertung', 'valuation', ''),
      ch('fotos', 'Fotodokumentation', 'photos', ''),
      ch('ergebnis', 'Zusammenfassung', null, 'Reparaturkosten: {{kalkulation.netto}} netto / {{kalkulation.brutto}} brutto\nWiederbeschaffungswert: {{bewertung.wbw}}'),
      ch('hinweise', 'Hinweise', null, '', false),
    ],
  };
}

export function normalizeContent(raw: unknown): ReportContent {
  const d = defaultContent();
  const list = Array.isArray((raw as ReportContent | null)?.chapters) ? (raw as ReportContent).chapters : d.chapters;
  const seen = new Set<string>();
  const chapters = list.filter((c) => c && typeof c.key === 'string' && !seen.has(c.key) && seen.add(c.key)).slice(0, 40).map((c): Chapter => ({
    key: String(c.key).slice(0, 40), title: String(c.title ?? '').slice(0, 120) || 'Kapitel', enabled: c.enabled !== false,
    auto: (AUTO_KINDS as readonly string[]).includes(c.auto as string) ? (c.auto as AutoKind) : null, text: String(c.text ?? '').slice(0, 20_000),
  }));
  return { chapters };
}

/* ------------------------------------------------------------ Prüfung vor der Einreichung */

export type ReportData = {
  vars: Vars;
  /** Anzahl der Datensätze je automatischem Baustein – für Hinweise („Kalkulation fehlt“) */
  counts: { damages: number; photos: number; calcItems: number; hasCalc: boolean; hasWbw: boolean; hasVin: boolean };
};
export type Issue = { level: 'error' | 'warn'; chapter?: string; text: string };

export function validateReport(content: ReportContent, data: ReportData): Issue[] {
  const issues: Issue[] = [];
  const on = content.chapters.filter((c) => c.enabled);
  if (!on.length) issues.push({ level: 'error', text: 'Es ist kein Kapitel aktiviert.' });
  for (const c of on) {
    if (!c.auto && !c.text.trim()) issues.push({ level: 'warn', chapter: c.key, text: `Kapitel „${c.title}“ ist leer.` });
    const r = resolveText(c.text, data.vars);
    for (const k of r.missing) issues.push({ level: 'error', chapter: c.key, text: `„${c.title}“: Wert für {{${k}}} fehlt.` });
    for (const k of r.unknown) issues.push({ level: 'error', chapter: c.key, text: `„${c.title}“: Unbekannte Variable {{${k}}}.` });
    if (c.auto === 'damages' && data.counts.damages === 0) issues.push({ level: 'warn', chapter: c.key, text: 'Kapitel „Schadenfeststellung“: Es sind keine Schäden erfasst.' });
    if (c.auto === 'calculation' && !data.counts.hasCalc) issues.push({ level: 'warn', chapter: c.key, text: 'Kapitel „Reparaturkalkulation“: Es gibt keine Kalkulation.' });
    if (c.auto === 'valuation' && !data.counts.hasWbw) issues.push({ level: 'warn', chapter: c.key, text: 'Kapitel „Bewertung“: Es ist kein Wiederbeschaffungswert gewählt.' });
    if (c.auto === 'photos' && data.counts.photos === 0) issues.push({ level: 'warn', chapter: c.key, text: 'Kapitel „Fotodokumentation“: Es gibt keine Fotos im Fall.' });
    if (c.auto === 'vehicle' && !data.counts.hasVin) issues.push({ level: 'warn', chapter: c.key, text: 'Kapitel „Fahrzeugdaten“: Die FIN fehlt.' });
  }
  return issues;
}

export const STATUS_LABELS: Record<string, string> = { DRAFT: 'Entwurf', IN_REVIEW: 'In Prüfung', CHANGES_REQUESTED: 'Änderungen angefordert', APPROVED: 'Freigegeben', SENT: 'Versendet' };
export const STATUS_TONE: Record<string, 'info' | 'warn' | 'ok' | 'muted' | 'danger'> = { DRAFT: 'muted', IN_REVIEW: 'info', CHANGES_REQUESTED: 'warn', APPROVED: 'ok', SENT: 'ok' };
