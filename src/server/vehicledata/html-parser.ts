import { parse, type HTMLElement } from 'node-html-parser';
import { normalizeFuel, normalizeHsn, normalizeManufacturer, normalizeTsn, parseDisplacement, parsePower, splitVehicleName, type FuelKey } from '@/lib/vehicle-data';

/**
 * Robuster Tabellen-Parser für öffentliche HSN/TSN-Seiten (rein, ohne Netz – deshalb mit Fixtures testbar).
 * Es werden ausschließlich Textinhalte ausgelesen (kein HTML wird übernommen). Fehlerhaftes HTML, Skripte und Styles werden ignoriert.
 * Was nicht eindeutig erkennbar ist, bleibt null.
 */

export const IMPORTER_VERSION = 'hsn-tsn-html/1.0';

export type NormalizedVehicle = {
  hsn: string; tsn: string;
  manufacturerNameRaw: string | null; vehicleNameRaw: string | null;
  manufacturer: string | null; model: string | null; generation: string | null; variant: string | null;
  bodyStyle: string | null; engineName: string | null; driveType: string | null;
  fuelType: FuelKey | null; displacementCc: number | null; powerKw: number | null; powerHp: number | null;
  torqueNm: number | null; transmission: string | null; engineCode: string | null;
  productionFrom: string | null; productionTo: string | null; typeApproval: string | null; vehicleClass: string | null;
  sourceUrl: string | null; sourceRecordId: string;
  /** Originalwerte der Quelle (Leistung, Hubraum, Kraftstoff, Name …) */
  raw: Record<string, string | null>;
};

export type ParsedRow = { ok: true; vehicle: NormalizedVehicle } | { ok: false; error: string; text: string };

const CODE = /(?<![0-9A-Za-z])([0-9A-Za-z]{4})\s*[/\-]\s*([0-9A-Za-z]{3})(?![0-9A-Za-z])/;
const clean = (s: string) => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const text = (el: HTMLElement) => clean(el.textContent ?? '');

const HEADER_KEYS: [RegExp, string][] = [
  [/^(hsn\s*\/\s*tsn|schl(ü|ue)ssel(nummer)?)$/i, 'code'], [/^hsn$/i, 'hsn'], [/^tsn$/i, 'tsn'],
  [/^(hersteller|marke)$/i, 'manufacturer'], [/^(fahrzeug|typ|modell|bezeichnung|fahrzeugtyp|handelsbezeichnung)$/i, 'name'],
  [/^(leistung|power)/i, 'power'], [/^(ps)$/i, 'ps'], [/^(kw)$/i, 'kw'], [/^(hubraum|ccm|cm³|cm3)$/i, 'displacement'],
  [/^(kraftstoff|treibstoff|antrieb\/kraftstoff|fuel)$/i, 'fuel'],
  [/^(baujahr|bauzeit(raum)?|produktion)/i, 'period'],
];

const headerKeys = (cells: string[]): string[] | null => {
  const keys = cells.map((t) => HEADER_KEYS.find(([re]) => re.test(t))?.[1] ?? '');
  return keys.some(Boolean) ? keys : null;
};

type RawTable = { header: string[] | null; rows: { cells: string[]; link: string | null }[] };

/** DOM-Weg: für wohlgeformtes HTML. */
function tablesFromDom(stripped: string): RawTable[] {
  const root = parse(stripped);
  return root.querySelectorAll('table').map((table) => {
    const headRow = table.querySelector('thead tr') ?? table.querySelectorAll('tr').find((r) => r.querySelectorAll('th').length > 1);
    const header = headRow ? headerKeys(headRow.querySelectorAll('th,td').map(text)) : null;
    const rows = table.querySelectorAll('tr').flatMap((tr) => {
      const tds = tr.querySelectorAll('td');
      return tds.length < 2 ? [] : [{ cells: tds.map(text), link: tr.querySelector('a[href]')?.getAttribute('href') ?? null }];
    });
    return { header, rows };
  });
}

/** Toleranter Weg für defektes HTML (ungeschlossene Zeilen/Zellen): zerlegt nach <tr>/<td>, ohne einen Baum aufzubauen. */
function tablesFromLoose(stripped: string): RawTable[] {
  const out: RawTable[] = [];
  const tableBlocks = stripped.split(/<table\b/i).slice(1);
  for (const block of tableBlocks) {
    const rows: RawTable['rows'] = [];
    let header: string[] | null = null;
    for (const m of block.matchAll(/<tr\b[^>]*>([\s\S]*?)(?=<tr\b|<\/table|<\/tbody|$)/gi)) {
      const cellsHtml = [...m[1].matchAll(/<(t[dh])\b[^>]*>([\s\S]*?)(?=<\/t[dh]\s*>|<t[dh]\b|$)/gi)];
      const cells = cellsHtml.map((c) => clean(parse(c[2]).textContent ?? ''));
      if (cellsHtml.length && cellsHtml.every((c) => c[1].toLowerCase() === 'th')) { header = headerKeys(cells); continue; }
      const tds = cellsHtml.filter((c) => c[1].toLowerCase() === 'td').map((c) => clean(parse(c[2]).textContent ?? ''));
      if (tds.length < 2) continue;
      const link = m[1].match(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/i)?.[1] ?? null;
      rows.push({ cells: tds, link });
    }
    out.push({ header, rows });
  }
  return out;
}

export type VehicleFields = { code?: string; hsn?: string; tsn?: string; manufacturer?: string; name?: string; power?: string; ps?: string; kw?: string; displacement?: string; fuel?: string; cells: string[] };

/** Gemeinsame Normalisierung für Tabellenzeilen, CSV und JSON. */
export function vehicleFromFields(fields: VehicleFields, sourceUrl: string | null = null): ParsedRow {
  return buildVehicle(fields, sourceUrl);
}

function buildVehicle(fields: { code?: string; hsn?: string; tsn?: string; manufacturer?: string; name?: string; power?: string; ps?: string; kw?: string; displacement?: string; fuel?: string; cells: string[] }, sourceUrl: string | null): ParsedRow {
  const rowText = fields.cells.join(' | ');
  let hsnRaw = fields.hsn, tsnRaw = fields.tsn;
  const codeSrc = fields.code ?? rowText;
  if (!hsnRaw || !tsnRaw) {
    const m = codeSrc.match(CODE);
    if (m) { hsnRaw = m[1]; tsnRaw = m[2]; }
  }
  const hsn = normalizeHsn(hsnRaw), tsn = normalizeTsn(tsnRaw);
  if (!hsn.value || !tsn.value) return { ok: false, error: 'Keine gültige HSN/TSN erkannt.', text: rowText.slice(0, 160) };

  // Fachwerte aus den passenden Zellen – oder, ohne Kopfzeile, aus dem erkannten Muster der Zellen
  const cells = fields.cells;
  const powerSrc = [fields.power, fields.ps && `${fields.ps} PS`, fields.kw && `${fields.kw} kW`].filter(Boolean).join(' ') || cells.find((c) => /\b(PS|kW)\b/i.test(c)) || '';
  const ccSrc = fields.displacement ?? cells.find((c) => /\b(ccm|cm³|cm3)\b/i.test(c)) ?? '';
  const fuelSrc = fields.fuel ?? cells.find((c) => normalizeFuel(c) !== null && c.length <= 40 && !/\b(PS|kW|ccm)\b/i.test(c)) ?? '';
  const nameSrc = fields.name ?? cells
    .filter((c) => c && !CODE.test(c) && !/\b(PS|kW|ccm|cm³)\b/i.test(c) && c !== fuelSrc && /[A-Za-zÄÖÜäöü]/.test(c))
    .sort((a, b) => b.length - a.length)[0] ?? '';
  const makeSrc = fields.manufacturer ?? null;

  const power = parsePower(powerSrc || null);
  let displacement = parseDisplacement(ccSrc || null);
  if (displacement == null && fields.displacement && /^\d{3,5}$/.test(fields.displacement.replace(/[.\s]/g, ''))) displacement = Number(fields.displacement.replace(/[.\s]/g, ''));
  const fuel = normalizeFuel(fuelSrc || null);
  const vehicleNameRaw = nameSrc || null;
  const parsed = splitVehicleName(vehicleNameRaw, makeSrc);
  const manufacturer = parsed.manufacturer ?? normalizeManufacturer(makeSrc);

  return {
    ok: true,
    vehicle: {
      hsn: hsn.value, tsn: tsn.value,
      manufacturerNameRaw: makeSrc || null, vehicleNameRaw,
      manufacturer, model: parsed.model, generation: parsed.generation, variant: parsed.variant,
      bodyStyle: parsed.bodyStyle, engineName: parsed.engineName, driveType: parsed.driveType,
      fuelType: fuel, displacementCc: displacement, powerKw: power.kw, powerHp: power.hp,
      torqueNm: null, transmission: null, engineCode: null, productionFrom: null, productionTo: null, typeApproval: null, vehicleClass: null,
      sourceUrl, sourceRecordId: '',
      raw: { code: fields.code ?? `${hsnRaw ?? ''}/${tsnRaw ?? ''}`, name: vehicleNameRaw, manufacturer: makeSrc || null, power: powerSrc || null, displacement: ccSrc || null, fuel: fuelSrc || null },
    },
  };
}

/** Liest alle Tabellenzeilen einer Seite. Zeilen ohne HSN/TSN werden als „ungültig“ gemeldet, ohne den Rest abzubrechen. */
export function parseVehicleTables(html: string, sourceUrl: string | null = null): { rows: ParsedRow[]; tables: number } {
  // Skripte/Styles vorab entfernen (bleiben so auch bei defektem HTML wirkungslos), dann tolerant parsen
  const stripped = html.replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  let tables = tablesFromDom(stripped);
  // Sieht das DOM-Ergebnis unvollständig aus (z. B. wegen ungeschlossener Zeilen), gilt der tolerante Weg
  const loose = () => tablesFromLoose(stripped);
  const domRows = tables.reduce((n, t) => n + t.rows.length, 0);
  const looseTables = loose();
  const looseRows = looseTables.reduce((n, t) => n + t.rows.length, 0);
  if (looseRows > domRows) tables = looseTables;
  const rows: ParsedRow[] = [];
  for (const table of tables) {
    const keys = table.header;
    for (const r of table.rows) {
      if (!r.cells.some((c) => CODE.test(c)) && !keys?.some((k) => k === 'hsn' || k === 'code')) continue;
      const f: VehicleFields = { cells: r.cells };
      if (keys) r.cells.forEach((cell, i) => { const k = keys[i]; if (k && cell) (f as unknown as Record<string, unknown>)[k] = cell; });
      const row = buildVehicle(f, sourceUrl);
      if (row.ok && r.link && sourceUrl) {
        try { const u = new URL(r.link, sourceUrl); if (u.protocol === 'https:') row.vehicle.sourceUrl = u.toString(); } catch { /* ungültiger Link → Seitenadresse bleibt */ }
      }
      rows.push(row);
    }
  }
  return { rows, tables: tables.length };
}
