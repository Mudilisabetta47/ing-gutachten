/**
 * Fahrzeugdaten: Normalisierung, Vergleich und Prioritätslogik – reine Funktionen ohne Datenbank und ohne Netz,
 * damit sie überall (Server, Tests, Browser-Validierung) gleich arbeiten.
 *
 * Grundsatz: Was die Quelle nicht liefert, bleibt `null`. Nichts wird geschätzt, hochgerechnet oder erfunden
 * (auch kW ↔ PS wird nicht umgerechnet). Originalwerte werden vom Aufrufer zusätzlich gespeichert.
 */

export type FuelKey = 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'PLUG_IN_HYBRID' | 'LPG' | 'CNG' | 'HYDROGEN' | 'OTHER';
export type VerificationKey = 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED' | 'OUTDATED' | 'CONFLICT';
export type LicenseKey = 'UNKNOWN' | 'REVIEW_REQUIRED' | 'APPROVED' | 'LICENSED' | 'DISABLED';

export const FUEL_LABELS: Record<FuelKey, string> = {
  PETROL: 'Benzin', DIESEL: 'Diesel', ELECTRIC: 'Elektro', HYBRID: 'Hybrid', PLUG_IN_HYBRID: 'Plug-in-Hybrid',
  LPG: 'Autogas (LPG)', CNG: 'Erdgas (CNG)', HYDROGEN: 'Wasserstoff', OTHER: 'Sonstige',
};
export const VERIFICATION_LABELS: Record<VerificationKey, string> = {
  VERIFIED: 'Verifiziert', PARTIAL: 'Teilweise verifiziert', UNVERIFIED: 'Nicht verifiziert', OUTDATED: 'Veraltet', CONFLICT: 'Konflikt',
};
export const LICENSE_LABELS: Record<LicenseKey, string> = {
  UNKNOWN: 'Unbekannt', REVIEW_REQUIRED: 'Review erforderlich', APPROVED: 'Freigegeben', LICENSED: 'Lizenziert', DISABLED: 'Deaktiviert',
};
export const APPROVAL_LABELS = { EC_TYPE_APPROVAL: 'EG-Typgenehmigung', ABE: 'ABE (Allgemeine Betriebserlaubnis)', INDIVIDUAL: 'Einzelgenehmigung', UNKNOWN: 'Nicht bekannt' } as const;
export type ApprovalKey = keyof typeof APPROVAL_LABELS;

/* ------------------------------------------------------------ HSN / TSN */

export type CodeResult = { value: string | null; error?: string; hint?: string };

const cleanCode = (s: string | null | undefined) => (s ?? '').normalize('NFC').toLocaleUpperCase('de-DE').replace(/[\s./\\_-]+/g, '');

/** HSN: genau 4 Zeichen (Ziffern; Buchstaben nur großgeschrieben zugelassen). */
export function normalizeHsn(input?: string | null): CodeResult {
  const v = cleanCode(input);
  if (!v) return { value: null, error: 'Bitte die HSN (4 Zeichen) eingeben.' };
  if (!/^[0-9A-Z]{4}$/.test(v)) return { value: null, error: 'Die HSN hat genau 4 Zeichen (Ziffern oder Buchstaben).' };
  return { value: v };
}

/**
 * TSN: 3 Zeichen. Auf dem Fahrzeugschein steht im Feld 2.2 teils ein viertes Zeichen (Prüfziffer);
 * es wird nicht für die Suche verwendet und nur als Hinweis gemeldet.
 */
export function normalizeTsn(input?: string | null): CodeResult {
  const v = cleanCode(input);
  if (!v) return { value: null, error: 'Bitte die TSN (3 Zeichen) eingeben.' };
  if (!/^[0-9A-Z]{3,4}$/.test(v)) return { value: null, error: 'Die TSN hat 3 Zeichen (Ziffern oder Buchstaben).' };
  if (v.length === 4) return { value: v.slice(0, 3), hint: 'Das vierte Zeichen (Prüfziffer im Fahrzeugschein) wurde nicht verwendet.' };
  return { value: v };
}

/** „0603/ADT“, „0603 ADT“, „0603-ADT“, „0603ADT“ → HSN + TSN. */
export function parseHsnTsn(input?: string | null): { hsn: string; tsn: string } | null {
  const v = (input ?? '').normalize('NFC').toLocaleUpperCase('de-DE').trim();
  const m = v.match(/^([0-9A-Z]{4})\s*[/\-\s]?\s*([0-9A-Z]{3,4})$/);
  return m ? { hsn: m[1], tsn: m[2].slice(0, 3) } : null;
}

/* ------------------------------------------------------------ FIN */

/** Strenge FIN-Prüfung (17 Zeichen, ohne I/O/Q). Die Prüfziffer ist nur in Nordamerika verbindlich und wird nicht erzwungen. */
export function validateVin(input?: string | null): { value: string | null; error?: string; wmi?: string } {
  const v = (input ?? '').toLocaleUpperCase('de-DE').replace(/[\s-]/g, '');
  if (!v) return { value: null, error: 'Bitte die FIN eingeben.' };
  if (v.length !== 17) return { value: null, error: `Die FIN hat 17 Zeichen (eingegeben: ${v.length}).` };
  if (/[IOQ]/.test(v)) return { value: null, error: 'In einer FIN kommen die Buchstaben I, O und Q nicht vor.' };
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) return { value: null, error: 'Die FIN enthält ungültige Zeichen.' };
  return { value: v, wmi: v.slice(0, 3) };
}

/* ------------------------------------------------------------ Zahlen & Einheiten */

const intOrNull = (s: string): number | null => {
  const n = Number(s.replace(/[.\s]/g, ''));
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** „170 PS (125 kW)“, „125 kW / 170 PS“, „125kW“ → { kw, hp }. Es wird nur übernommen, was dasteht. */
export function parsePower(raw?: string | null): { kw: number | null; hp: number | null } {
  const s = (raw ?? '').replace(/ /g, ' ');
  const kw = s.match(/(\d{1,4}(?:[.,]\d)?)\s*kW/i);
  const hp = s.match(/(\d{1,4}(?:[.,]\d)?)\s*(?:PS|HP|PK)\b/i);
  const num = (m: RegExpMatchArray | null) => (m ? Math.round(Number(m[1].replace(',', '.'))) || null : null);
  return { kw: num(kw), hp: num(hp) };
}

/** „1968 ccm“, „1.498 ccm“, „1 968 cm³“ → Kubikzentimeter. Literangaben („2,0 l“) werden nicht umgerechnet (wären geschätzt). */
export function parseDisplacement(raw?: string | null): number | null {
  const s = (raw ?? '').replace(/ /g, ' ');
  const m = s.match(/(\d{1,2}(?:[.\s]\d{3})|\d{3,5})\s*(?:ccm|cm³|cm3|cc)(?![A-Za-z])/i);
  return m ? intOrNull(m[1]) : null;
}

/** Kraftstoff-Bezeichnung → Schlüssel; unbekannte Angaben ergeben null (der Rohwert bleibt gespeichert). */
export function normalizeFuel(raw?: string | null): FuelKey | null {
  const s = (raw ?? '').toLocaleLowerCase('de-DE').trim();
  if (!s) return null;
  if (/plug|steckdose|phev/.test(s)) return 'PLUG_IN_HYBRID';
  if (/hybrid/.test(s)) return 'HYBRID';
  if (/diesel/.test(s)) return 'DIESEL';
  if (/elektr|strom|\bbev\b|\bev\b/.test(s)) return 'ELECTRIC';
  if (/wasserstoff|hydrogen/.test(s)) return 'HYDROGEN';
  if (/autogas|\blpg\b|flüssiggas/.test(s)) return 'LPG';
  if (/erdgas|\bcng\b/.test(s)) return 'CNG';
  if (/benzin|super|otto|ottokraftstoff/.test(s)) return 'PETROL';
  return null;
}

/* ------------------------------------------------------------ Hersteller */

/** Anzeigename → Schreibweisen (klein, ohne Rechtsform). Reihenfolge ist egal; der Originalwert wird nie gelöscht. */
const MAKES: Record<string, string[]> = {
  Volkswagen: ['vw', 'volkswagen', 'volks wagen', 'volkswagen pkw', 'vw pkw'],
  Audi: ['audi', 'auto union'],
  BMW: ['bmw', 'bayerische motoren werke'],
  'Mercedes-Benz': ['mercedes', 'mercedes-benz', 'mercedes benz', 'daimler-benz', 'daimler benz', 'mercedes-benz pkw', 'mb'],
  Škoda: ['skoda', 'škoda', 'skoda auto', 'škoda auto'],
  Citroën: ['citroen', 'citroën'],
  Opel: ['opel', 'adam opel'],
  Ford: ['ford', 'ford-werke', 'ford werke'],
  Renault: ['renault'],
  Peugeot: ['peugeot'],
  SEAT: ['seat'],
  CUPRA: ['cupra'],
  Fiat: ['fiat'],
  Toyota: ['toyota'],
  Hyundai: ['hyundai'],
  Kia: ['kia'],
  Mazda: ['mazda'],
  Nissan: ['nissan'],
  Honda: ['honda'],
  MINI: ['mini'],
  Porsche: ['porsche', 'dr. ing. h.c. f. porsche'],
  Volvo: ['volvo'],
  Dacia: ['dacia'],
  Suzuki: ['suzuki'],
  Mitsubishi: ['mitsubishi'],
  'Land Rover': ['land rover', 'landrover'],
  Jaguar: ['jaguar'],
  Tesla: ['tesla'],
  smart: ['smart'],
  'Alfa Romeo': ['alfa romeo', 'alfa'],
  Jeep: ['jeep'],
  Lexus: ['lexus'],
  Subaru: ['subaru'],
  Chevrolet: ['chevrolet'],
  Chrysler: ['chrysler'],
  Dodge: ['dodge'],
  Saab: ['saab'],
  Lancia: ['lancia'],
};
const ALIAS = new Map<string, string>();
for (const [name, aliases] of Object.entries(MAKES)) for (const a of aliases) ALIAS.set(a, name);
export const KNOWN_MAKES = Object.keys(MAKES);
export const makeAliases = (name: string): string[] => MAKES[name] ?? [];

const LEGAL = /\s+(ag|gmbh|se|s\.a\.|s\.p\.a\.|co\.?|kg|ltd\.?|inc\.?|corp\.?)(\s|$)/gi;
const squash = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim();

/** „VW“, „Volkswagen AG“ → „Volkswagen“. Unbekannte Hersteller bleiben (bereinigt) erhalten, nichts wird erraten. */
export function normalizeManufacturer(raw?: string | null): string | null {
  const t = squash(raw ?? '');
  if (!t) return null;
  const key = squash(t.toLocaleLowerCase('de-DE').replace(LEGAL, ' '));
  return ALIAS.get(key) ?? t;
}

/* ------------------------------------------------------------ Fahrzeugbezeichnung zerlegen */

const BODY = ['Sportback', 'Avant', 'Variant', 'Limousine', 'Kombi', 'Touring', 'Cabrio', 'Cabriolet', 'Coupé', 'Coupe', 'Combi', 'Schrägheck', 'Fließheck', 'Roadster', 'Gran Coupé', 'Allroad', 'Estate', 'Sedan', 'Hatchback', 'Spider'];
const DRIVE = ['quattro', '4MATIC', 'xDrive', '4Motion', 'AWD', '4x4', 'Allrad'];
const ENGINE = /^(\d\.\d)(?:\s+(TDI|TFSI|TSI|FSI|TDCI|CDI|HDI|dCi|CRDi|MPI|GDI|T-GDI|TGDI|SDI|CRDI|BlueHDi|EcoBoost|e-?Hybrid|d|i|L|T))?$/i;

export type ParsedName = {
  manufacturer: string | null; model: string | null; generation: string | null; variant: string | null;
  bodyStyle: string | null; engineName: string | null; driveType: string | null;
  /** false = Aufteilung nicht zuverlässig möglich → nur der Rohwert zählt, strukturierte Felder bleiben leer */
  reliable: boolean;
};
const EMPTY_NAME: ParsedName = { manufacturer: null, model: null, generation: null, variant: null, bodyStyle: null, engineName: null, driveType: null, reliable: false };

/**
 * „Audi A5 2.0 TDI Sportback quattro“ → Hersteller Audi, Modell A5, Karosserie Sportback, Motor 2.0 TDI, Antrieb quattro.
 * Nur wenn der Hersteller sicher erkannt wird, wird zerlegt – sonst bleiben alle strukturierten Felder leer.
 */
export function splitVehicleName(rawName?: string | null, rawManufacturer?: string | null): ParsedName {
  const name = squash(rawName ?? '');
  if (!name) return EMPTY_NAME;
  let make = normalizeManufacturer(rawManufacturer);
  let rest = name;
  // Hersteller am Namensanfang erkennen (längste Schreibweise zuerst)
  const lower = name.toLocaleLowerCase('de-DE');
  const starts = [...ALIAS.entries()].filter(([a]) => lower === a || lower.startsWith(`${a} `)).sort((a, b) => b[0].length - a[0].length)[0];
  if (starts) {
    make = starts[1];
    rest = name.slice(starts[0].length).trim();
  } else if (make && lower.startsWith(make.toLocaleLowerCase('de-DE') + ' ')) {
    rest = name.slice(make.length).trim();
  }
  if (!make || !Object.prototype.hasOwnProperty.call(MAKES, make) || !rest) return { ...EMPTY_NAME, manufacturer: make && Object.prototype.hasOwnProperty.call(MAKES, make) ? make : null };

  let tokens = rest.split(' ');
  let bodyStyle: string | null = null;
  let driveType: string | null = null;
  let engineName: string | null = null;
  const used = new Set<number>();
  // Karosserie
  for (let i = 0; i < tokens.length; i++) {
    const hit = BODY.find((b) => b.toLocaleLowerCase('de-DE') === tokens[i].toLocaleLowerCase('de-DE'));
    if (hit && !bodyStyle) { bodyStyle = hit; used.add(i); }
    const dr = DRIVE.find((d) => d.toLocaleLowerCase('de-DE') === tokens[i].toLocaleLowerCase('de-DE'));
    if (dr && !driveType) { driveType = dr; used.add(i); }
  }
  // Motor: „2.0 TDI“ (Hubraum in Litern + Kürzel) oder allein „2.0“
  for (let i = 0; i < tokens.length && !engineName; i++) {
    if (used.has(i)) continue;
    const two = i + 1 < tokens.length && !used.has(i + 1) ? `${tokens[i]} ${tokens[i + 1]}` : '';
    if (two && ENGINE.test(two) && ENGINE.exec(two)?.[2]) { engineName = two; used.add(i); used.add(i + 1); }
    else if (/^\d\.\d$/.test(tokens[i]) && i > 0) { engineName = tokens[i]; used.add(i); }
  }
  tokens = tokens.filter((_, i) => !used.has(i));
  if (!tokens.length) return { ...EMPTY_NAME, manufacturer: make, bodyStyle, engineName, driveType };
  const model = tokens.shift()!;
  let generation: string | null = null;
  if (tokens.length && /^(II|III|IV|V|VI|VII|VIII|IX)$/.test(tokens[0])) generation = tokens.shift()!;
  const variant = tokens.join(' ') || null;
  return { manufacturer: make, model, generation, variant, bodyStyle, engineName, driveType, reliable: true };
}

/* ------------------------------------------------------------ Datensätze vergleichen */

export type VehicleCore = {
  manufacturer?: string | null; vehicleNameRaw?: string | null; model?: string | null; variant?: string | null;
  powerKw?: number | null; powerHp?: number | null; displacementCc?: number | null; fuelType?: string | null;
};

const nameKey = (r: VehicleCore): string | null => {
  const t = squash(r.vehicleNameRaw ?? [r.manufacturer, r.model, r.variant].filter(Boolean).join(' '));
  if (!t) return null;
  let s = t.toLocaleLowerCase('de-DE');
  const starts = [...ALIAS.keys()].filter((a) => s === a || s.startsWith(`${a} `)).sort((a, b) => b.length - a.length)[0];
  if (starts) s = s.slice(starts.length);
  return s.replace(/[^a-z0-9äöüß]+/g, '') || null;
};

export const COMPARE_LABELS = {
  manufacturer: 'Hersteller', name: 'Fahrzeugbezeichnung', powerKw: 'Leistung (kW)', powerHp: 'Leistung (PS)', displacementCc: 'Hubraum', fuelType: 'Kraftstoff',
} as const;
export type CompareField = keyof typeof COMPARE_LABELS;

/** Felder, in denen zwei Datensätze mit identischer HSN/TSN voneinander abweichen (nur wenn beide Seiten einen Wert haben). */
export function diffRecords(own: VehicleCore, incoming: VehicleCore): CompareField[] {
  const out: CompareField[] = [];
  const mo = normalizeManufacturer(own.manufacturer), mi = normalizeManufacturer(incoming.manufacturer);
  if (mo && mi && mo !== mi) out.push('manufacturer');
  const no = nameKey(own), ni = nameKey(incoming);
  if (no && ni && no !== ni) out.push('name');
  for (const f of ['powerKw', 'powerHp', 'displacementCc', 'fuelType'] as const) {
    const a = own[f], b = incoming[f];
    if (a != null && b != null && a !== b) out.push(f);
  }
  return out;
}

/** Eigene Werte behalten, nur leere Felder aus der anderen Quelle auffüllen. */
export function fillMissing<T extends Record<string, unknown>>(own: T, incoming: Partial<T>, keys: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) if ((own[k] === null || own[k] === undefined || own[k] === '') && incoming[k] != null && incoming[k] !== '') out[k] = incoming[k];
  return out;
}

/* ------------------------------------------------------------ Prioritäten */

/** Herkunft → Priorität. Höher gewinnt; niedrigere Quellen überschreiben nie höhere. */
export const PRIORITY = { MANUAL_CONFIRMED: 100, OFFICIAL: 80, VIN: 70, KBA: 60, HSN_TSN: 50, UNVERIFIED: 20 } as const;
export const PRIORITY_LABELS: Record<number, string> = { 100: 'Vom Gutachter bestätigt', 80: 'Offiziell / lizenziert', 70: 'VIN-Anbieter', 60: 'KBA-basiert', 50: 'HSN/TSN-Drittanbieter', 20: 'Nicht verifiziert' };

export function sourcePriority(source: string, opts: { confirmed?: boolean; license?: LicenseKey } = {}): number {
  if (opts.confirmed || source === 'MANUAL_CONFIRMED') return PRIORITY.MANUAL_CONFIRMED;
  const licensed = opts.license === 'LICENSED';
  switch (source) {
    case 'DAT': case 'SCHWACKE': case 'OFFICIAL': return licensed ? PRIORITY.OFFICIAL : PRIORITY.UNVERIFIED;
    case 'VIN': return PRIORITY.VIN;
    case 'KBA': return PRIORITY.KBA;
    case 'HSN_TSN': return PRIORITY.HSN_TSN;
    case 'OWN': return PRIORITY.HSN_TSN;
    default: return PRIORITY.UNVERIFIED;
  }
}

/** Darf ein neuer Wert (Priorität `next`) den vorhandenen (Priorität `current`) ersetzen? */
export const mayOverwrite = (current: number | null | undefined, next: number): boolean => current == null || next >= current;

/** Prüfstatus eines Datensatzes nach Herkunft: nur eine Drittquelle → PARTIAL; offiziell/lizenziert abgeglichen → VERIFIED. */
export function verificationFor(source: string, license?: LicenseKey, crossChecked = false): VerificationKey {
  if (crossChecked && (license === 'LICENSED' || source === 'KBA')) return 'VERIFIED';
  if (source === 'MANUAL' || source === 'IMPORT_FILE') return 'UNVERIFIED';
  if (source === 'KBA' || source === 'DAT' || source === 'VIN') return license === 'LICENSED' || source === 'KBA' ? 'VERIFIED' : 'PARTIAL';
  return 'PARTIAL';
}

/* ------------------------------------------------------------ Suche */

export type ParsedQuery = { hsn?: string; tsn?: string; hsnPrefix?: string; tokens: string[] };

/** „0588“, „0588 ABC“, „0588/ABC“, „Audi A5“, „A5 190 PS“, „2.0 TDI“, „1968 Diesel“ → strukturierte Suche. */
export function parseSearchQuery(q: string): ParsedQuery {
  const t = q.normalize('NFC').trim();
  if (!t) return { tokens: [] };
  const m = t.toLocaleUpperCase('de-DE').match(/^([0-9A-Z]{4})\s*[/\-\s]?\s*([0-9A-Z]{3})$/);
  if (m && /\d/.test(m[1])) return { hsn: m[1], tsn: m[2], tokens: t.toLocaleLowerCase('de-DE').split(/\s+/).filter(Boolean).slice(0, 8) };
  if (/^\d{4}$/.test(t)) return { hsnPrefix: t, tokens: [t] };
  const tokens = t.toLocaleLowerCase('de-DE').split(/\s+/).filter(Boolean).slice(0, 8);
  return { tokens };
}

/** Text für den Suchindex: Kleinschreibung, Kurzformen (PS/kW/ccm) und HSN/TSN gemeinsam. */
export function buildSearchText(r: {
  hsn: string; tsn: string; manufacturer?: string | null; manufacturerNameRaw?: string | null; model?: string | null; generation?: string | null; variant?: string | null;
  vehicleNameRaw?: string | null; engineName?: string | null; bodyStyle?: string | null; fuelType?: string | null; powerKw?: number | null; powerHp?: number | null; displacementCc?: number | null;
}): string {
  const fuel = r.fuelType ? FUEL_LABELS[r.fuelType as FuelKey] ?? r.fuelType : '';
  const parts = [
    r.hsn, r.tsn, `${r.hsn}/${r.tsn}`, `${r.hsn}${r.tsn}`, r.manufacturer, r.manufacturerNameRaw, r.model, r.generation, r.variant, r.vehicleNameRaw, r.engineName, r.bodyStyle, fuel,
    r.powerKw ? `${r.powerKw} kw` : '', r.powerHp ? `${r.powerHp} ps` : '', r.displacementCc ? `${r.displacementCc} ccm` : '',
  ];
  return parts.filter(Boolean).join(' ').toLocaleLowerCase('de-DE').replace(/\s+/g, ' ').slice(0, 600);
}

/* ------------------------------------------------------------ Anzeige */

export const fmtPower = (kw?: number | null, hp?: number | null): string | null =>
  kw && hp ? `${kw} kW / ${hp} PS` : kw ? `${kw} kW` : hp ? `${hp} PS` : null;
export const fmtCc = (cc?: number | null): string | null => (cc ? `${cc.toLocaleString('de-DE')} cm³` : null);

/* ------------------------------------------------------------ Fahrzeugschein ↔ Datenbank */

export type RegistrationInput = {
  hsn?: string | null; tsn?: string | null; manufacturer?: string | null; powerKw?: number | null; displacementCc?: number | null; fuelType?: string | null;
  firstRegistration?: string | null; vin?: string | null; seats?: number | null; vehicleClass?: string | null; typeCode?: string | null; variantCode?: string | null; versionCode?: string | null;
};
export type CheckRow = { field: string; label: string; registration: string | null; database: string | null; state: 'ok' | 'deviation' | 'open' };

/** Vergleich der Fahrzeugscheinangaben mit dem Datensatz. „open“ = eine Seite hat keinen Wert → nichts behaupten. */
export function compareRegistration(reg: RegistrationInput, rec: VehicleCore & { hsn?: string; tsn?: string }): CheckRow[] {
  const row = (field: string, label: string, a: string | number | null | undefined, b: string | number | null | undefined, show: (v: string | number) => string = String): CheckRow => ({
    field, label, registration: a == null || a === '' ? null : show(a), database: b == null || b === '' ? null : show(b),
    state: a == null || a === '' || b == null || b === '' ? 'open' : String(a) === String(b) ? 'ok' : 'deviation',
  });
  const mReg = normalizeManufacturer(reg.manufacturer), mRec = normalizeManufacturer(rec.manufacturer);
  return [
    row('manufacturer', 'Hersteller (D.1)', mReg, mRec),
    row('powerKw', 'Leistung (P.2)', reg.powerKw ?? null, rec.powerKw ?? null, (v) => `${v} kW`),
    row('displacementCc', 'Hubraum (P.1)', reg.displacementCc ?? null, rec.displacementCc ?? null, (v) => `${Number(v).toLocaleString('de-DE')} cm³`),
    row('fuelType', 'Kraftstoff (P.3)', reg.fuelType ?? null, rec.fuelType ?? null, (v) => FUEL_LABELS[v as FuelKey] ?? String(v)),
  ];
}

export type ApprovalStatus = { state: 'conform' | 'deviation' | 'individual' | 'unknown'; text: string };

/**
 * Zulassungsstatus: wird nur ausgesprochen, wenn die Angaben dafür vorliegen.
 * „Konform“ braucht Genehmigungsart (EG/ABE) UND mindestens einen belegten, übereinstimmenden Abgleich ohne Abweichung.
 */
export function approvalStatus(kind: ApprovalKey | null | undefined, checks: CheckRow[] | null | undefined): ApprovalStatus {
  if (kind === 'INDIVIDUAL') return { state: 'individual', text: 'Einzelgenehmigung – bitte prüfen. Ein Abgleich mit Typdaten ist nicht möglich.' };
  const rows = checks ?? [];
  if (rows.some((r) => r.state === 'deviation')) return { state: 'deviation', text: 'Abweichende Fahrzeugdaten festgestellt. Bitte Fahrzeugschein und Datensatz prüfen.' };
  if ((kind === 'EC_TYPE_APPROVAL' || kind === 'ABE') && rows.some((r) => r.state === 'ok')) {
    return { state: 'conform', text: `Fahrzeug aufgrund einer ${kind === 'ABE' ? 'ABE' : 'EG-Typgenehmigung'} zugelassen (laut Angabe). Geprüfte Daten konform.` };
  }
  return { state: 'unknown', text: 'Nicht beurteilbar – die dafür nötigen Angaben (Genehmigungsart, Fahrzeugscheinwerte) liegen nicht vollständig vor.' };
}

export const SOURCE_LABELS: Record<string, string> = {
  OWN: 'Eigene Datenbank', HSN_TSN: 'HSN/TSN-Datenbank', KBA: 'KBA', DAT: 'DAT', VIN: 'VIN-Anbieter', MANUAL: 'Manuell erfasst', IMPORT_FILE: 'Datei-Import', MANUAL_CONFIRMED: 'Vom Gutachter bestätigt', SYSTEM: 'System',
};
export const sourceLabel = (s: string) => SOURCE_LABELS[s] ?? s;
