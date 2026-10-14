/**
 * ING Studio – reine Fensterverwaltung (ohne React, ohne Browser). Alles hier ist deterministisch und testbar:
 * Geometrie, Andocken (Snapping), Fokus-Reihenfolge, Speichern/Wiederherstellen des Layouts.
 */
import { z } from 'zod';

export const TASKBAR_H = 64;
export const MIN_W = 360;
export const MIN_H = 240;
export const SNAP_EDGE = 10;
export const MAX_WINDOWS = 12;

export type Bounds = { x: number; y: number; w: number; h: number };
export type Viewport = { w: number; h: number };
export type SnapSide = 'left' | 'right';

export type WinState = Bounds & {
  id: string;
  appId: string;
  url: string;
  title: string;
  min: boolean;
  max: boolean;
  snap: SnapSide | null;
  /** Fenstergröße vor Maximieren/Andocken, für „Wiederherstellen“ */
  restore: Bounds | null;
  z: number;
};

export type StudioState = { windows: WinState[]; focus: string | null; seq: number; zTop: number };
export const emptyState = (): StudioState => ({ windows: [], focus: null, seq: 0, zTop: 10 });

/** Nutzbare Fläche über der Taskleiste. */
export const workArea = (vp: Viewport): Bounds => ({ x: 0, y: 0, w: vp.w, h: Math.max(MIN_H, vp.h - TASKBAR_H) });

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), Math.max(lo, hi));

/** Fenster bleibt greifbar: Titelleiste immer sichtbar, Größe in sinnvollen Grenzen. */
export function clampBounds(b: Bounds, area: Bounds): Bounds {
  const w = clamp(Math.round(b.w), Math.min(MIN_W, area.w), area.w);
  const h = clamp(Math.round(b.h), Math.min(MIN_H, area.h), area.h);
  const x = clamp(Math.round(b.x), area.x - w + 120, area.x + area.w - 120);
  const y = clamp(Math.round(b.y), area.y, area.y + area.h - 44);
  return { x, y, w, h };
}

/** Startgröße und -position: gestaffelt (Kaskade), damit neue Fenster nicht exakt übereinander liegen. */
export function cascadeBounds(index: number, area: Bounds, want?: { w: number; h: number }): Bounds {
  const w = Math.min(want?.w ?? 1040, area.w - 40);
  const h = Math.min(want?.h ?? 680, area.h - 24);
  const step = 34;
  const maxSteps = Math.max(1, Math.floor((Math.min(area.w - w, area.h - h)) / step));
  const k = index % (maxSteps + 1);
  return clampBounds({ x: Math.round((area.w - w) / 2) - 90 + k * step, y: Math.round((area.h - h) / 2) - 24 + k * step, w, h }, area);
}

export const snapBounds = (side: SnapSide, area: Bounds): Bounds => ({ x: side === 'left' ? area.x : area.x + Math.floor(area.w / 2), y: area.y, w: Math.floor(area.w / 2), h: area.h });
export const maximizedBounds = (area: Bounds): Bounds => ({ ...area });

/** Zielzone beim Ziehen: Rand links/rechts → Hälfte, Oberkante → maximieren. */
export function snapZone(pointer: { x: number; y: number }, area: Bounds): SnapSide | 'max' | null {
  if (pointer.y <= area.y + SNAP_EDGE) return 'max';
  if (pointer.x <= area.x + SNAP_EDGE) return 'left';
  if (pointer.x >= area.x + area.w - SNAP_EDGE) return 'right';
  return null;
}
export const zoneBounds = (zone: SnapSide | 'max', area: Bounds): Bounds => (zone === 'max' ? maximizedBounds(area) : snapBounds(zone, area));

/** Zieht man ein maximiertes/angedocktes Fenster an der Titelleiste, springt es auf die gemerkte Größe unter den Mauszeiger zurück. */
export function restoreUnderPointer(win: WinState, pointer: { x: number; y: number }, area: Bounds): Bounds {
  const r = win.restore ?? { x: win.x, y: win.y, w: Math.round(win.w * 0.8), h: Math.round(win.h * 0.8) };
  const ratio = win.w > 0 ? (pointer.x - win.x) / win.w : 0.5;
  return clampBounds({ x: pointer.x - r.w * clamp(ratio, 0.1, 0.9), y: Math.max(area.y, pointer.y - 18), w: r.w, h: r.h }, area);
}

/* ------------------------------------------------------------ Aktionen */

export type Action =
  | { type: 'open'; appId: string; url: string; title: string; area: Bounds; size?: { w: number; h: number }; saved?: Bounds | null; forceNew?: boolean }
  | { type: 'focus'; id: string }
  | { type: 'minimize'; id: string }
  | { type: 'toggleMax'; id: string; area: Bounds }
  | { type: 'close'; id: string }
  | { type: 'bounds'; id: string; bounds: Bounds; area: Bounds }
  | { type: 'drag'; id: string; bounds: Bounds }
  | { type: 'snap'; id: string; to: SnapSide | 'max'; area: Bounds; /** Fenstergröße/-ort vor dem Ziehen – dorthin geht „Wiederherstellen“ zurück */ from?: Bounds }
  | { type: 'meta'; id: string; title?: string; url?: string }
  | { type: 'cycle'; dir: 1 | -1 }
  | { type: 'showDesktop' }
  | { type: 'closeAll' }
  | { type: 'relayout'; area: Bounds }
  | { type: 'load'; windows: WinState[] };

const topOf = (s: StudioState, exceptId?: string) => s.windows.filter((w) => !w.min && w.id !== exceptId).sort((a, b) => b.z - a.z)[0] ?? null;
const upd = (s: StudioState, id: string, f: (w: WinState) => WinState): StudioState => ({ ...s, windows: s.windows.map((w) => (w.id === id ? f(w) : w)) });

export function reducer(s: StudioState, a: Action): StudioState {
  switch (a.type) {
    case 'open': {
      const existing = a.forceNew ? undefined : s.windows.find((w) => w.appId === a.appId);
      if (existing) {
        const zTop = s.zTop + 1;
        return { ...s, zTop, focus: existing.id, windows: s.windows.map((w) => (w.id === existing.id ? { ...w, min: false, z: zTop } : w)) };
      }
      if (s.windows.length >= MAX_WINDOWS) return s;
      const seq = s.seq + 1;
      const zTop = s.zTop + 1;
      const b = a.saved ? clampBounds(a.saved, a.area) : cascadeBounds(s.windows.filter((w) => !w.max).length, a.area, a.size);
      const win: WinState = { id: `w${seq}`, appId: a.appId, url: a.url, title: a.title, ...b, min: false, max: false, snap: null, restore: null, z: zTop };
      return { windows: [...s.windows, win], focus: win.id, seq, zTop };
    }
    case 'focus': {
      const w = s.windows.find((x) => x.id === a.id);
      if (!w) return s;
      if (s.focus === a.id && !w.min) return s;
      const zTop = s.zTop + 1;
      return { ...upd(s, a.id, (x) => ({ ...x, min: false, z: zTop })), focus: a.id, zTop };
    }
    case 'minimize': {
      const next = upd(s, a.id, (x) => ({ ...x, min: true }));
      return { ...next, focus: s.focus === a.id ? (topOf(next)?.id ?? null) : s.focus };
    }
    case 'toggleMax': {
      const zTop = s.zTop + 1;
      const next = upd(s, a.id, (x) =>
        x.max || x.snap
          ? { ...x, ...clampBounds(x.restore ?? cascadeBounds(0, a.area), a.area), max: false, snap: null, restore: null, z: zTop, min: false }
          : { ...x, restore: { x: x.x, y: x.y, w: x.w, h: x.h }, ...maximizedBounds(a.area), max: true, snap: null, z: zTop, min: false });
      return { ...next, focus: a.id, zTop };
    }
    case 'close': {
      const next = { ...s, windows: s.windows.filter((w) => w.id !== a.id) };
      return { ...next, focus: s.focus === a.id ? (topOf(next)?.id ?? null) : s.focus };
    }
    case 'bounds':
      return upd(s, a.id, (x) => ({ ...x, ...clampBounds(a.bounds, a.area), max: false, snap: null, restore: x.max || x.snap ? x.restore : null }));
    case 'drag':
      // Verschieben: Größe der Vorlage wird übernommen; Maximiert/Angedockt wird dabei aufgehoben
      return upd(s, a.id, (x) => ({ ...x, ...a.bounds, max: false, snap: null, restore: null }));
    case 'snap': {
      const zTop = s.zTop + 1;
      const next = upd(s, a.id, (x) => ({
        ...x,
        restore: x.max || x.snap ? x.restore : (a.from ?? { x: x.x, y: x.y, w: x.w, h: x.h }),
        ...zoneBounds(a.to, a.area),
        max: a.to === 'max', snap: a.to === 'max' ? null : a.to, min: false, z: zTop,
      }));
      return { ...next, focus: a.id, zTop };
    }
    case 'meta':
      return upd(s, a.id, (x) => ({ ...x, ...(a.title ? { title: a.title.slice(0, 120) } : {}), ...(a.url ? { url: a.url } : {}) }));
    case 'cycle': {
      const order = [...s.windows].sort((x, y) => x.z - y.z);
      if (order.length < 2) return s;
      const cur = order.findIndex((w) => w.id === s.focus);
      // Strg+Alt+Tab: das nächst-untere Fenster nach vorn (dir=1), bzw. das oberste nach hinten
      const target = a.dir === 1 ? order[(cur <= 0 ? order.length : cur) - 1] : order[(cur + 1) % order.length];
      const zTop = s.zTop + 1;
      return { ...upd(s, target.id, (x) => ({ ...x, min: false, z: zTop })), focus: target.id, zTop };
    }
    case 'showDesktop': {
      // Alles minimieren; ist schon alles minimiert, das zuletzt aktive wiederherstellen
      if (s.windows.every((w) => w.min)) {
        const last = [...s.windows].sort((x, y) => y.z - x.z)[0];
        return last ? { ...upd(s, last.id, (x) => ({ ...x, min: false })), focus: last.id } : s;
      }
      return { ...s, windows: s.windows.map((w) => ({ ...w, min: true })), focus: null };
    }
    case 'closeAll':
      return { ...s, windows: [], focus: null };
    case 'relayout':
      // Nach Größenänderung des Browsers: angedockte/maximierte Fenster neu einpassen, freie Fenster nur zurück ins Bild holen
      return { ...s, windows: s.windows.map((w) => (w.max ? { ...w, ...maximizedBounds(a.area) } : w.snap ? { ...w, ...snapBounds(w.snap, a.area) } : { ...w, ...clampBounds(w, a.area) })) };
    case 'load': {
      const zTop = a.windows.reduce((m, w) => Math.max(m, w.z), 10);
      const top = [...a.windows].filter((w) => !w.min).sort((x, y) => y.z - x.z)[0];
      return { windows: a.windows, focus: top?.id ?? null, seq: a.windows.length, zTop };
    }
  }
}

/* ------------------------------------------------------------ Speichern / Wiederherstellen */

const num = z.number().finite();
const boundsSchema = z.object({ x: num, y: num, w: num, h: num });
export const savedWindowSchema = z.object({
  appId: z.string().max(40),
  url: z.string().max(400),
  title: z.string().max(120),
  x: num, y: num, w: num, h: num,
  min: z.boolean().default(false), max: z.boolean().default(false),
  snap: z.enum(['left', 'right']).nullable().default(null),
  z: num.default(10),
});

export const studioPrefsSchema = z.object({
  settings: z.object({
    theme: z.enum(['dark', 'light', 'system']).default('dark'),
    wallpaper: z.enum(['ing-blue', 'night-drive', 'daylight']).default('ing-blue'),
    iconSize: z.enum(['sm', 'md', 'lg']).default('md'),
    desktopIcons: z.boolean().default(true),
    restoreWindows: z.boolean().default(true),
  }).default({ theme: 'dark', wallpaper: 'ing-blue', iconSize: 'md', desktopIcons: true, restoreWindows: true }),
  pinned: z.array(z.string().max(40)).max(16).default([]),
  recents: z.array(z.object({ appId: z.string().max(40), url: z.string().max(400), title: z.string().max(120), at: z.number().finite() })).max(8).default([]),
  windows: z.array(savedWindowSchema).max(MAX_WINDOWS).default([]),
  geometry: z.record(z.string().max(40), boundsSchema).default({}),
});
export type StudioPrefs = z.infer<typeof studioPrefsSchema>;
export type StudioSettings = StudioPrefs['settings'];

export const DEFAULT_PINNED = ['faelle', 'kunden', 'schadenaufnahme', 'kalkulation', 'bewertung', 'gutachten', 'finanzen', 'kalender'];

/** Gespeicherte Einstellungen lesen – kaputte oder veraltete Daten fallen auf Standardwerte zurück, nie auf einen Fehler. */
export function parsePrefs(raw: unknown): StudioPrefs {
  const r = studioPrefsSchema.safeParse(raw ?? {});
  if (r.success) return r.data;
  const partial = studioPrefsSchema.safeParse({});
  return partial.success ? partial.data : (studioPrefsSchema.parse({}));
}

/** Nur interne Adressen (/admin/…) dürfen in Fenstern geöffnet werden – nie fremde Seiten, nie javascript:. */
export function safeAppUrl(raw: string): string | null {
  if (typeof raw !== 'string' || raw.length > 400) return null;
  if (!/^\/admin(\/|\?|$)/.test(raw) || raw.startsWith('//') || /[\u0000-\u001f\\]/.test(raw)) return null;
  return raw;
}

export function toSaved(s: StudioState): StudioPrefs['windows'] {
  return [...s.windows].sort((a, b) => a.z - b.z).map((w) => ({ appId: w.appId, url: w.url, title: w.title, x: w.x, y: w.y, w: w.w, h: w.h, min: w.min, max: w.max, snap: w.snap, z: w.z }));
}

/** Gespeicherte Fenster nur mit erlaubten Apps und sicheren Adressen wiederherstellen, passend in die aktuelle Fläche. */
export function fromSaved(saved: StudioPrefs['windows'], allowedApps: ReadonlySet<string>, area: Bounds): WinState[] {
  const out: WinState[] = [];
  saved.forEach((w, i) => {
    const url = safeAppUrl(w.url);
    if (!url && w.url !== '') return;
    if (!allowedApps.has(w.appId) && w.appId !== 'settings') return;
    const b = clampBounds(w, area);
    out.push({ id: `w${i + 1}`, appId: w.appId, url: url ?? '', title: w.title, ...(w.max ? maximizedBounds(area) : w.snap ? snapBounds(w.snap, area) : b), min: w.min, max: w.max, snap: w.snap, restore: w.max || w.snap ? { x: 120 + i * 30, y: 60 + i * 30, w: Math.min(1040, area.w - 160), h: Math.min(680, area.h - 100) } : null, z: 10 + i });
  });
  return out.slice(0, MAX_WINDOWS);
}
