/**
 * Schematisches Fahrzeugmodell für die visuelle Schadenerfassung.
 *
 * Ein einfaches 3D-Teilemodell (Karosserieflächen als ebene Polygone, Maße in Metern) wird für neun Ansichten
 * projiziert (Front, Front links, Links, Heck links, Heck, Heck rechts, Rechts, Front rechts, Oben).
 * Dadurch sind Teile, Beschriftung und Perspektive in allen Ansichten garantiert konsistent; jedes Teil hat eine feste `partId`.
 *
 * Reine Funktionen ohne Abhängigkeiten – deshalb serverseitig und im Browser nutzbar und testbar.
 * Die Darstellung ist bewusst allgemein (kein Herstellermodell): Sie dient der Markierung, nicht der Maßangabe.
 */

type V3 = [number, number, number];
export type DamageAreaKey = 'FRONT' | 'REAR' | 'LEFT' | 'RIGHT' | 'ROOF' | 'WHEELS' | 'GLASS';

export type PartDef = { id: string; label: string; area: DamageAreaKey };

/* ------------------------------------------------------------ Teilekatalog */

const P = (id: string, label: string, area: DamageAreaKey): PartDef => ({ id, label, area });

export const PARTS: PartDef[] = [
  P('bumper_front', 'Stoßfänger vorn', 'FRONT'), P('grille', 'Kühlergrill', 'FRONT'), P('hood', 'Motorhaube', 'FRONT'),
  P('headlight_l', 'Scheinwerfer links', 'FRONT'), P('headlight_r', 'Scheinwerfer rechts', 'FRONT'),
  P('windshield', 'Frontscheibe', 'GLASS'), P('roof', 'Dach', 'ROOF'), P('rear_window', 'Heckscheibe', 'GLASS'),
  P('trunk', 'Heckklappe / Kofferraumdeckel', 'REAR'), P('bumper_rear', 'Stoßfänger hinten', 'REAR'),
  P('taillight_l', 'Rückleuchte links', 'REAR'), P('taillight_r', 'Rückleuchte rechts', 'REAR'),
  P('fender_fl', 'Kotflügel vorn links', 'LEFT'), P('fender_fr', 'Kotflügel vorn rechts', 'RIGHT'),
  P('door_fl', 'Tür vorn links', 'LEFT'), P('door_fr', 'Tür vorn rechts', 'RIGHT'),
  P('door_rl', 'Tür hinten links', 'LEFT'), P('door_rr', 'Tür hinten rechts', 'RIGHT'),
  P('quarter_l', 'Seitenwand hinten links', 'LEFT'), P('quarter_r', 'Seitenwand hinten rechts', 'RIGHT'),
  P('sill_l', 'Schweller links', 'LEFT'), P('sill_r', 'Schweller rechts', 'RIGHT'),
  P('mirror_l', 'Außenspiegel links', 'LEFT'), P('mirror_r', 'Außenspiegel rechts', 'RIGHT'),
  P('glass_fl', 'Seitenscheibe vorn links', 'GLASS'), P('glass_fr', 'Seitenscheibe vorn rechts', 'GLASS'),
  P('glass_rl', 'Seitenscheibe hinten links', 'GLASS'), P('glass_rr', 'Seitenscheibe hinten rechts', 'GLASS'),
  P('pillar_a_l', 'A-Säule links', 'LEFT'), P('pillar_a_r', 'A-Säule rechts', 'RIGHT'),
  P('pillar_b_l', 'B-Säule links', 'LEFT'), P('pillar_b_r', 'B-Säule rechts', 'RIGHT'),
  P('pillar_c_l', 'C-Säule links', 'LEFT'), P('pillar_c_r', 'C-Säule rechts', 'RIGHT'),
  P('wheel_fl', 'Rad vorn links', 'WHEELS'), P('wheel_fr', 'Rad vorn rechts', 'WHEELS'),
  P('wheel_rl', 'Rad hinten links', 'WHEELS'), P('wheel_rr', 'Rad hinten rechts', 'WHEELS'),
];
export const PART_BY_ID: Record<string, PartDef> = Object.fromEntries(PARTS.map((p) => [p.id, p]));
export const partLabel = (id: string | null | undefined): string | null => (id ? PART_BY_ID[id]?.label ?? null : null);

/* ------------------------------------------------------------ Ansichten */

export const VIEWS = [
  { key: 'FRONT', label: 'Front', az: 0 },
  { key: 'FRONT_LEFT', label: 'Front links', az: 40 },
  { key: 'LEFT', label: 'Links', az: 90 },
  { key: 'REAR_LEFT', label: 'Heck links', az: 140 },
  { key: 'REAR', label: 'Heck', az: 180 },
  { key: 'REAR_RIGHT', label: 'Heck rechts', az: -140 },
  { key: 'RIGHT', label: 'Rechts', az: -90 },
  { key: 'FRONT_RIGHT', label: 'Front rechts', az: -40 },
  { key: 'TOP', label: 'Oben', az: 0, top: true },
] as const;
export type ViewKey = (typeof VIEWS)[number]['key'];
export const VIEW_KEYS = VIEWS.map((v) => v.key) as ViewKey[];
export const VIEW_LABELS: Record<string, string> = Object.fromEntries(VIEWS.map((v) => [v.key, v.label]));

/* ------------------------------------------------------------ Geometrie: gelofteter Karosseriekörper */

type Tone = 'body' | 'glass' | 'dark' | 'tire' | 'rim';
type Cell = { v: V3[]; part: string | null; tone: Tone; out: V3; side?: 1 | -1 };
const cells: Cell[] = [];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const interp = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]));
  return pts[pts.length - 1][1];
};
const mirrorY = (p: V3): V3 => [p[0], -p[1], p[2]];

const ZB = 0.3, WZ = 0.33, WR = 0.33, ARCH = 0.41, AX_F = 1.35, AX_R = -1.35;
const GLASS_PARTS = new Set(['windshield', 'rear_window', 'glass_fl', 'glass_fr', 'glass_rl', 'glass_rr', 'headlight_l', 'headlight_r', 'taillight_l', 'taillight_r']);
const toneOf = (part: string | null): Tone => (!part ? 'dark' : part === 'grille' ? 'dark' : GLASS_PARTS.has(part) ? 'glass' : 'body');

type SP = { y: number; z: number; kind: 'bottom' | 'corner' | 'wall' | 'shoulder' | 'top'; t?: number };

/** Loft: Querschnitte (linke Hälfte, von unten Mitte bis oben Mitte) → Zellen. `classify` ordnet jede Zelle einem Bauteil zu. */
function loft(stations: number[], section: (x: number) => SP[], classify: (xc: number, yc: number, zc: number, kind: SP['kind'], t: number) => string | null) {
  const loops = stations.map((x) => {
    const h = section(x);
    const pts: V3[] = [...h.map((p): V3 => [x, p.y, p.z]), ...h.slice(0, -1).reverse().map((p): V3 => [x, -p.y, p.z])];
    const kinds = [...h.slice(1).map((p) => p.kind), ...h.slice(1).reverse().map((p) => p.kind)];
    const ts = [...h.slice(1).map((p) => p.t ?? 0), ...h.slice(1).reverse().map((p) => p.t ?? 0)];
    return { pts, kinds, ts };
  });
  for (let i = 0; i < stations.length - 1; i++) {
    const a = loops[i], b = loops[i + 1];
    for (let k = 0; k < a.pts.length - 1; k++) {
      const v: V3[] = [a.pts[k], a.pts[k + 1], b.pts[k + 1], b.pts[k]];
      const c = mid(v);
      const part = classify(c[0], c[1], c[2], a.kinds[k], a.ts[k]);
      cells.push({ v, part, tone: toneOf(part), out: [c[0], 0, (ZB + 1.0) / 2] });
    }
  }
}
function mid(pts: V3[]): V3 { return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length, pts.reduce((s, p) => s + p[2], 0) / pts.length]; }

/* ---- Unterbau (Motorraum, Seiten, Heck) ---- */
const TOP_PROFILE: [number, number][] = [[-2.25, 0.66], [-2.2, 0.94], [-2.0, 1.0], [-1.78, 1.02], [-1.0, 0.97], [1.05, 0.97], [1.6, 0.92], [2.12, 0.85], [2.2, 0.8], [2.25, 0.66]];
const tubHalfW = (x: number) => 0.9 - 0.1 * sstep(1.7, 2.25, Math.abs(x));
const TUB_X = [-2.25, -2.2, -2.1, -1.98, -1.95, -1.78, -1.5, -1.2, -0.98, -0.7, -0.4, -0.08, 0.2, 0.5, 0.78, 1.05, 1.3, 1.5, 1.7, 1.95, 2.12, 2.2, 2.25];

function tubSection(x: number): SP[] {
  const w = tubHalfW(x), zt = interp(TOP_PROFILE, x), r = 0.09, rb = 0.06;
  const pts: SP[] = [{ y: 0, z: ZB, kind: 'bottom' }, { y: (w - rb) / 2, z: ZB, kind: 'bottom' }, { y: w - rb, z: ZB, kind: 'bottom' }];
  for (let i = 1; i <= 2; i++) { const a = (Math.PI / 2) * (i / 2); pts.push({ y: w - rb + rb * Math.sin(a), z: ZB + rb - rb * Math.cos(a), kind: 'corner' }); }
  const top = zt - r;
  // Anzahl der Stützpunkte ist an jeder Station gleich (sonst ließen sich die Querschnitte nicht verbinden)
  const base = [0.4, 0.52, 0.64, 0.78];
  const levels = base.map((l, i) => Math.min(l, top - 0.012 * (base.length - i)));
  const zs = [ZB + rb, ...levels, top];
  zs.slice(1).forEach((z) => pts.push({ y: w + 0.02 * Math.sin((Math.PI * (z - ZB)) / (zt - ZB)), z, kind: 'wall' }));
  const wy = pts[pts.length - 1].y;
  for (let i = 1; i <= 3; i++) { const a = (Math.PI / 2) * (i / 3); pts.push({ y: wy - r + r * Math.cos(a), z: top + r * Math.sin(a), kind: 'shoulder' }); }
  const y0 = wy - r;
  for (let i = 1; i <= 5; i++) { const y = y0 * (1 - i / 5); pts.push({ y, z: zt + 0.025 * (1 - (y / y0) ** 2), kind: 'top' }); }
  return pts;
}

const sideId = (id: string, y: number) => `${id}${y >= 0 ? 'l' : 'r'}`;
function classifyTub(xc: number, yc: number, zc: number, kind: SP['kind']): string | null {
  if (xc > 1.95 && zc < 0.64 && kind !== 'top') return 'bumper_front';
  if (xc < -1.95 && zc < 0.66 && kind !== 'top') return 'bumper_rear';
  if (kind === 'bottom') return null;
  if (kind === 'top') {
    if (xc >= 2.12) return Math.abs(yc) < 0.34 ? 'grille' : sideId('headlight_', yc);
    if (xc > 1.05) return 'hood';
    if (xc >= -1.78) return null; // Gürtelfläche unter der Dachgruppe
    if (xc < -2.1 && Math.abs(yc) > 0.4) return sideId('taillight_', yc);
    return 'trunk';
  }
  if (xc >= 1.95) return sideId('headlight_', yc);
  if (xc <= -1.95) return sideId('taillight_', yc);
  if (kind === 'shoulder' && xc >= 0.78) return sideId('fender_f', yc);
  if (xc >= 0.78) return sideId('fender_f', yc);
  if (xc >= -0.08) return zc >= 0.4 && kind !== 'corner' ? sideId('door_f', yc) : sideId('sill_', yc);
  if (xc >= -0.98) return zc >= 0.4 && kind !== 'corner' ? sideId('door_r', yc) : sideId('sill_', yc);
  return sideId('quarter_', yc);
}
loft(TUB_X, tubSection, classifyTub);
// Stirnflächen (Front-/Heckabschluss): Dreiecksfächer vom Schwerpunkt; gehören ganz zum Stoßfänger
for (const [x, part] of [[2.25, 'bumper_front'], [-2.25, 'bumper_rear']] as const) {
  const h = tubSection(x);
  const loopPts: V3[] = [...h.map((p): V3 => [x, p.y, p.z]), ...h.slice(0, -1).reverse().map((p): V3 => [x, -p.y, p.z])];
  const c0 = mid(loopPts);
  for (let k = 0; k < loopPts.length - 1; k++) cells.push({ v: [c0, loopPts[k], loopPts[k + 1]], part, tone: 'body', out: [0, 0, c0[2]] });
}

/* ---- Dachgruppe (Scheiben, Dach, Säulen) ---- */
const GX = [1.05, 0.84, 0.62, 0.45, 0.3, 0.15, 0.0, -0.1, -0.5, -0.86, -1.2, -1.5, -1.78];
const Z_BASE = 0.96;
const ROOF_Z: [number, number][] = [[-1.78, 1.02], [-1.5, 1.17], [-1.2, 1.3], [-0.86, 1.38], [-0.5, 1.41], [0, 1.42], [0.15, 1.41], [0.3, 1.37], [0.45, 1.3], [0.62, 1.2], [0.84, 1.07], [1.05, 0.97]];
const zRoof = (x: number) => interp(ROOF_Z, x);
const wRoof = (x: number) => (x > 0.15 ? lerp(0.72, 0.8, (x - 0.15) / 0.9) : x >= -0.86 ? 0.72 : lerp(0.72, 0.8, (-0.86 - x) / 0.92));

function roofSection(x: number): SP[] {
  const zr = zRoof(x), wr = wRoof(x), rr = 0.07, wb = 0.8;
  const topWall = zr - rr;
  const pts: SP[] = [{ y: wb, z: Z_BASE, kind: 'wall', t: 0 }];
  for (const t of [0.12, 0.5, 0.88, 1]) pts.push({ y: lerp(wb, wr, t) + 0.02 * Math.sin(Math.PI * t), z: lerp(Z_BASE, topWall, t), kind: 'wall', t });
  const wy = pts[pts.length - 1].y;
  for (let i = 1; i <= 2; i++) { const a = (Math.PI / 2) * (i / 2); pts.push({ y: wy - rr + rr * Math.cos(a), z: topWall + rr * Math.sin(a), kind: 'shoulder' }); }
  const y0 = wy - rr;
  for (let i = 1; i <= 4; i++) { const y = y0 * (1 - i / 4); pts.push({ y, z: zr + 0.03 * (1 - (y / y0) ** 2), kind: 'top' }); }
  return pts;
}
function classifyRoof(xc: number, yc: number, _zc: number, kind: SP['kind'], t: number): string | null {
  if (kind === 'top') return xc > 0.3 ? 'windshield' : xc >= -1.2 ? 'roof' : 'rear_window';
  if (kind === 'shoulder') return xc > 0.3 ? sideId('pillar_a_', yc) : xc >= -1.2 ? 'roof' : sideId('pillar_c_', yc);
  // Seitenwand
  const rail = t > 0.9;
  if (xc >= 0.62) return sideId('pillar_a_', yc);
  if (xc >= 0.0) return rail ? 'roof' : sideId('glass_f', yc);
  if (xc >= -0.1) return sideId('pillar_b_', yc);
  if (xc >= -0.86) return rail ? 'roof' : sideId('glass_r', yc);
  return sideId('pillar_c_', yc);
}
loft(GX, roofSection, (xc, yc, zc, kind, t) => classifyRoof(xc, yc, zc, kind, t));
// Cell.out für die Dachgruppe liegt höher (Querschnitt-Mittelpunkt)
for (const c of cells) if (c.v[0][2] > 0.95 && c.part && /^(windshield|roof|rear_window|glass|pillar)/.test(c.part)) c.out = [c.out[0], 0, 1.0];

/* ---- Außenspiegel ---- */
function box(part: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, side: 1 | -1) {
  const c: V3 = [(x0 + x1) / 2, side * (y0 + y1) / 2, (z0 + z1) / 2];
  const P = (x: number, y: number, z: number): V3 => [x, side * y, z];
  const faces: V3[][] = [
    [P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)],
    [P(x0, y0, z0), P(x0, y1, z0), P(x0, y1, z1), P(x0, y0, z1)], [P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)],
    [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)],
  ];
  for (const f of faces) cells.push({ v: f, part, tone: 'body', out: c, side });
}
box('mirror_l', 0.8, 0.94, 0.86, 1.08, 1.0, 1.1, 1);
box('mirror_r', 0.8, 0.94, 0.86, 1.08, 1.0, 1.1, -1);

/* ---- Räder + Radlauf-Blenden ---- */
function ring(ax: number, y: number, r: number, n: number): V3[] { return Array.from({ length: n }, (_, i) => { const a = (2 * Math.PI * i) / n; return [ax + r * Math.cos(a), y, WZ + r * Math.sin(a)] as V3; }); }
const WHEELS: [string, number, 1 | -1][] = [['wheel_fl', AX_F, 1], ['wheel_rl', AX_R, 1], ['wheel_fr', AX_F, -1], ['wheel_rr', AX_R, -1]];
for (const [part, ax, side] of WHEELS) {
  const n = 28, yo = side * 0.97, yi = side * 0.7;
  const co = ring(ax, yo, WR, n), ci = ring(ax, yi, WR, n), cr = ring(ax, yo, 0.2, n), ch = ring(ax, yo + side * 0.004, 0.07, n);
  const c: V3 = [ax, 0, WZ];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    cells.push({ v: [co[i], co[j], ci[j], ci[i]], part, tone: 'tire', out: c, side });
    cells.push({ v: [cr[i], cr[j], co[j], co[i]], part, tone: 'tire', out: c, side });
    cells.push({ v: [ch[i], ch[j], cr[j], cr[i]], part, tone: 'rim', out: c, side });
  }
  cells.push({ v: ch, part, tone: 'tire', out: c, side });
  // Radlauf (dunkle Blende auf der Karosserieseite; nicht klickbar)
  const arch = ring(ax, side * 0.915, ARCH, 32);
  cells.push({ v: arch, part: null, tone: 'dark', out: c, side });
}

/* ------------------------------------------------------------ Projektion */

export type ShapeTone = Tone;
export type Shape = {
  part: string | null; tone: Tone; d: string;
  /** Konturlinien (Bauteilgrenzen und Silhouette) */
  e: string;
  /** Schattierung: leicht (heller) bis dunkel; Deckkraft je Stufe im Renderer */
  shades: { k: 0 | 1 | 3 | 4; d: string }[];
};
export type ProjectedView = {
  key: ViewKey; label: string; viewBox: string; width: number; height: number;
  shapes: Shape[];
  /** partIds, die in dieser Ansicht sichtbar (und damit klickbar) sind */
  parts: string[];
  /** Markierungspunkt je Teil (flächengewichteter Mittelpunkt) */
  anchors: Record<string, [number, number]>;
  /** Bodenschatten */
  shadow: { cx: number; cy: number; rx: number; ry: number };
};

const cache = new Map<ViewKey, ProjectedView>();
const W = 640, H = 340, PAD = 30;
const vkey = (p: V3) => `${Math.round(p[0] * 1e4)}|${Math.round(p[1] * 1e4)}|${Math.round(p[2] * 1e4)}`;
const FASCIA = new Set(['bumper_front', 'bumper_rear', 'grille', 'headlight_l', 'headlight_r', 'taillight_l', 'taillight_r']);

// Kanten → Zellen (einmalig; unabhängig von der Ansicht)
const edgeMap = new Map<string, number[]>();
cells.forEach((c, i) => c.v.forEach((p, k) => { const q = c.v[(k + 1) % c.v.length]; const a = vkey(p), b = vkey(q); const key = a < b ? `${a}~${b}` : `${b}~${a}`; const l = edgeMap.get(key); if (l) l.push(i); else edgeMap.set(key, [i]); }));

export function projectView(key: ViewKey): ProjectedView {
  const hit = cache.get(key);
  if (hit) return hit;
  const def = VIEWS.find((v) => v.key === key)!;
  const top = 'top' in def && def.top;
  const az = (def.az * Math.PI) / 180;
  const el = top ? Math.PI / 2 : (14 * Math.PI) / 180;
  const c: V3 = [Math.cos(az) * Math.cos(el), Math.sin(az) * Math.cos(el), Math.sin(el)];
  const f: V3 = [-c[0], -c[1], -c[2]];
  // Draufsicht: Fahrzeug liegt waagerecht, Front rechts, linke Fahrzeugseite oben
  const up0: V3 = top ? [0, 1, 0] : [0, 0, 1];
  const right = norm(cross(f, up0));
  const up = cross(right, f);
  const lightCam: V3 = norm([-0.5, 0.7, 0.55]);

  type Vis = { i: number; sx: [number, number][]; depth: number; area: number; shade: number; normal: V3 };
  const vis = new Map<number, Vis>();
  cells.forEach((cell, i) => {
    // seitlich angebaute Teile der abgewandten Seite entfallen
    if (cell.side && cell.side * c[1] < -0.12 && (cell.part?.startsWith('wheel') || cell.part?.startsWith('mirror') || cell.part === null)) return;
    const n = norm(cross(sub(cell.v[1], cell.v[0]), sub(cell.v[2], cell.v[0])));
    const m = mid(cell.v);
    const o = sub(m, cell.out);
    const nn: V3 = dot(n, o) < 0 ? [-n[0], -n[1], -n[2]] : n;
    if (dot(nn, c) < 0.03) return;
    const sx = cell.v.map((q): [number, number] => [dot(q, right), -dot(q, up)]);
    let area = 0;
    for (let a = 0; a < sx.length; a++) { const b = (a + 1) % sx.length; area += sx[a][0] * sx[b][1] - sx[b][0] * sx[a][1]; }
    const shade = dot([dot(nn, right), dot(nn, up), dot(nn, c)], lightCam);
    vis.set(i, { i, sx, depth: dot(m, c), area: Math.abs(area) / 2, shade, normal: nn });
  });
  const all = [...vis.values()].flatMap((v) => v.sx);
  const minX = Math.min(...all.map((p) => p[0])), maxX = Math.max(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1])), maxY = Math.max(...all.map((p) => p[1]));
  const s = Math.min((W - 2 * PAD) / (maxX - minX), (H - 2 * PAD - 18) / (maxY - minY));
  const ox = (W - s * (maxX - minX)) / 2 - s * minX, oy = (H - 18 - s * (maxY - minY)) / 2 - s * minY + 4;
  const T = (p: [number, number]): string => `${Math.round((p[0] * s + ox) * 10) / 10} ${Math.round((p[1] * s + oy) * 10) / 10}`;
  const TN = (p: [number, number]): [number, number] => [p[0] * s + ox, p[1] * s + oy];

  // Ebenen: 0 Karosserie (nach Tiefe) · 1 Radlauf-Blenden · 2 Räder · 3 Front-/Heckpartie · 4 Spiegel
  const layerOf = (part: string | null) => (part === null ? (cells[0] ? 1 : 1) : part.startsWith('wheel') ? 2 : part.startsWith('mirror') ? 4 : FASCIA.has(part) ? 3 : 0);
  const groups = new Map<string, { part: string | null; layer: number; ids: number[] }>();
  for (const v of vis.values()) {
    const cell = cells[v.i];
    const layerPart = cell.part;
    // Radlauf-Blenden (part null, dunkel, seitlich) liegen über der Karosserie; Bauch/Unterboden-Zellen ohne Seite bleiben ganz hinten
    const isArch = layerPart === null && cell.side !== undefined;
    const layer = isArch ? 1 : layerPart === null ? -1 : layerOf(layerPart);
    const gk = isArch ? `arch${cell.side}` : String(layerPart);
    const g = groups.get(gk) ?? { part: isArch ? null : layerPart, layer, ids: [] };
    g.ids.push(v.i);
    groups.set(gk, g);
  }
  const meanDepth = (ids: number[]) => ids.reduce((s2, i) => s2 + vis.get(i)!.depth, 0) / ids.length;
  const ordered = [...groups.values()].sort((a, b) => a.layer - b.layer || meanDepth(a.ids) - meanDepth(b.ids));

  const shapes: Shape[] = [];
  const anchors: Record<string, [number, number]> = {};
  const areaBy = new Map<string, number>();
  const toneOrder: Tone[] = ['dark', 'tire', 'body', 'glass', 'rim'];
  for (const g of ordered) {
    for (const tone of toneOrder) {
      const ids = g.ids.filter((i) => cells[i].tone === tone);
      if (!ids.length) continue;
      const d = ids.map((i) => `M${vis.get(i)!.sx.map(T).join('L')}Z`).join('');
      // Konturen
      const segs: string[] = [];
      for (const i of ids) {
        const cell = cells[i];
        cell.v.forEach((p, k) => {
          const q = cell.v[(k + 1) % cell.v.length];
          const a = vkey(p), b = vkey(q);
          const owners = edgeMap.get(a < b ? `${a}~${b}` : `${b}~${a}`) ?? [];
          let draw = false;
          if (owners.length < 2) draw = true;
          else for (const o of owners) {
            if (o === i) continue;
            const oc = cells[o];
            if (!vis.has(o)) { draw = true; break; }
            if (oc.part !== cell.part || oc.tone !== cell.tone) { if (o > i || !ids.includes(o)) { draw = true; break; } }
          }
          if (draw) { const pa = vis.get(i)!.sx[k], pb = vis.get(i)!.sx[(k + 1) % cell.v.length]; segs.push(`M${T(pa)}L${T(pb)}`); }
        });
      }
      const sh: Record<number, string[]> = { 0: [], 1: [], 3: [], 4: [] };
      for (const i of ids) {
        const v = vis.get(i)!;
        const lvl: 0 | 1 | 2 | 3 | 4 = v.shade > 0.82 ? 0 : v.shade > 0.6 ? 1 : v.shade > 0.34 ? 2 : v.shade > 0.12 ? 3 : 4;
        if (lvl !== 2) sh[lvl].push(`M${v.sx.map(T).join('L')}Z`);
      }
      shapes.push({ part: g.part, tone, d, e: segs.join(''), shades: ([0, 1, 3, 4] as const).filter((k) => sh[k].length).map((k) => ({ k, d: sh[k].join('') })) });
    }
    if (g.part) {
      let a = 0, ax = 0, ay = 0;
      for (const i of g.ids) { const v = vis.get(i)!; const m = v.sx.reduce((q, p) => [q[0] + p[0] / v.sx.length, q[1] + p[1] / v.sx.length], [0, 0]); const pt = TN(m as [number, number]); a += v.area; ax += pt[0] * v.area; ay += pt[1] * v.area; }
      if (a > 0) {
        // Markierung auf die dem Flächenschwerpunkt nächste sichtbare Zelle des Teils setzen (der Schwerpunkt selbst kann in einer Aussparung liegen, z. B. im Radlauf)
        const cx = ax / a, cy = ay / a;
        let best: [number, number] = [cx, cy], bd = Infinity;
        for (const i of g.ids) {
          if (cells[i].tone === 'tire' || cells[i].tone === 'dark') continue;
          const v = vis.get(i)!;
          if (v.area * s * s < 6) continue;
          const m = TN(v.sx.reduce((q, p) => [q[0] + p[0] / v.sx.length, q[1] + p[1] / v.sx.length], [0, 0]) as [number, number]);
          const dd = (m[0] - cx) ** 2 + (m[1] - cy) ** 2;
          if (dd < bd) { bd = dd; best = m; }
        }
        anchors[g.part] = [Math.round(best[0]), Math.round(best[1])];
        areaBy.set(g.part, a * s * s);
      }
    }
  }
  const parts = [...areaBy.entries()].filter(([, a]) => a > 60).map(([id]) => id);
  for (const id of Object.keys(anchors)) if (!parts.includes(id)) delete anchors[id];
  const [x0, x1, y1] = [Math.min(...all.map((p) => p[0] * s + ox)), Math.max(...all.map((p) => p[0] * s + ox)), Math.max(...all.map((p) => p[1] * s + oy))];
  const view: ProjectedView = { key, label: def.label, viewBox: `0 0 ${W} ${H}`, width: W, height: H, shapes, parts, anchors, shadow: { cx: (x0 + x1) / 2, cy: y1 - 2, rx: (x1 - x0) * 0.46, ry: top ? 0 : 9 } };
  cache.set(key, view);
  return view;
}

/** Teile, die auf der Karte angeklickt werden können (mindestens in einer Ansicht sichtbar). */
export const MAPPED_PART_IDS = (): string[] => [...new Set(VIEW_KEYS.flatMap((k) => projectView(k).parts))];

/* ------------------------------------------------------------ Schadenarten & Status (Karte) */

export const DAMAGE_KINDS = ['CURRENT', 'PRIOR', 'USAGE', 'REPAIRED', 'CHECK'] as const;
export type DamageKindKey = (typeof DAMAGE_KINDS)[number];
/** Farbe + Symbol + Text: nie nur Farbe (Barrierefreiheit). */
export const KIND_META: Record<DamageKindKey, { label: string; short: string; icon: string; color: string; rank: number }> = {
  CURRENT: { label: 'Aktueller Schaden', short: 'Aktuell', icon: '✕', color: '#d9362b', rank: 5 },
  PRIOR: { label: 'Vorschaden', short: 'Vorschaden', icon: '◷', color: '#e8830c', rank: 4 },
  CHECK: { label: 'Zu prüfen', short: 'Prüfen', icon: '?', color: '#2f7be8', rank: 3 },
  USAGE: { label: 'Gebrauchsspur', short: 'Gebrauch', icon: '≈', color: '#d6a900', rank: 2 },
  REPAIRED: { label: 'Repariert', short: 'Repariert', icon: '✓', color: '#1f9d63', rank: 1 },
};
export const SEVERITIES = ['LIGHT', 'MEDIUM', 'HEAVY'] as const;
export type SeverityKey = (typeof SEVERITIES)[number];
export const SEVERITY_LABELS: Record<SeverityKey, string> = { LIGHT: 'Leicht', MEDIUM: 'Mittel', HEAVY: 'Schwer' };

/** Auf der Karte gewinnt je Teil der Eintrag mit dem höchsten Rang (aktueller Schaden vor Vorschaden usw.). */
export function topKind(kinds: DamageKindKey[]): DamageKindKey | null {
  return kinds.length ? kinds.reduce((a, b) => (KIND_META[b].rank > KIND_META[a].rank ? b : a)) : null;
}
