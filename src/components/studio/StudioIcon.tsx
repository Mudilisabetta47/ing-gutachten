import type { CSSProperties } from 'react';

/**
 * ING-Iconset: eigene App-Symbole (abgerundete Kachel mit Verlauf + schlichtes Linien-Piktogramm).
 * Alle Glyphen sind selbst gezeichnet (24×24, 1.8 Strichstärke) – keine Fremd-Iconsets.
 */
type Tone = [string, string];
const BLUE: Tone = ['#4f8cff', '#1f5fe0'];
const DEEP: Tone = ['#3b6fe8', '#1a3fa8'];
const CYAN: Tone = ['#3cc4e8', '#1b78c9'];
const TEAL: Tone = ['#27c4a8', '#157fa6'];
const INDIGO: Tone = ['#7a7cf0', '#3f43c4'];
const SLATE: Tone = ['#5d7596', '#2f3f5c'];
const AMBER: Tone = ['#f0b04a', '#d0702c'];

const GLYPHS: Record<string, { tone: Tone; d: string[] }> = {
  faelle: { tone: BLUE, d: ['M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z', 'M7.5 13h9M7.5 16h5'] },
  anfragen: { tone: INDIGO, d: ['M4 13.5 6.2 5.8A1.5 1.5 0 0 1 7.6 4.7h8.8a1.5 1.5 0 0 1 1.4 1.1L20 13.5', 'M4 13.5h4.2l1 2.2h5.6l1-2.2H20v4.2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.7z'] },
  kunden: { tone: CYAN, d: ['M9.5 11a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z', 'M3.5 19.5c.4-3.3 2.8-5.3 6-5.3s5.6 2 6 5.3', 'M16.5 5.4a3 3 0 0 1 0 5.7M18 14.6c1.7.6 2.8 2 3 4.2'] },
  fahrzeuge: { tone: DEEP, d: ['M4 15.5v-3.2l1.7-4A2 2 0 0 1 7.5 7h9a2 2 0 0 1 1.8 1.3l1.7 4v3.2', 'M3.5 15.5h17v2.2a.8.8 0 0 1-.8.8H18a1.5 1.5 0 0 1-3 0H9a1.5 1.5 0 0 1-3 0H4.3a.8.8 0 0 1-.8-.8z', 'M5.6 12.2h12.8'] },
  schadenaufnahme: { tone: AMBER, d: ['M4 8.5a2 2 0 0 1 2-2h1.6l1.1-1.6h6.6l1.1 1.6H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M12 16.2a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z'] },
  kalkulation: { tone: TEAL, d: ['M7 3.8h10a1.5 1.5 0 0 1 1.5 1.5v13.4A1.5 1.5 0 0 1 17 20.2H7a1.5 1.5 0 0 1-1.5-1.5V5.3A1.5 1.5 0 0 1 7 3.8z', 'M8.5 7.5h7M9 11.5h.01M12 11.5h.01M15 11.5h.01M9 14.5h.01M12 14.5h.01M15 14.5h.01M9 17.2h.01M12 17.2h.01M15 17.2h.01'] },
  bewertung: { tone: INDIGO, d: ['M4.5 17a7.5 7.5 0 1 1 15 0', 'M12 17l3.6-5.2', 'M7 17h.01M17 17h.01M12 9.5h.01'] },
  gutachten: { tone: BLUE, d: ['M7 3.8h7l4 4v11.4a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5V5.3A1.5 1.5 0 0 1 7 3.8z', 'M14 3.8v4h4', 'M8.8 14.2l2.1 2.1 4.1-4.4'] },
  finanzen: { tone: TEAL, d: ['M7.5 4.2h9a1 1 0 0 1 1 1v14.6l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2V5.2a1 1 0 0 1 1-1z', 'M9.4 9.6h4.6M9.4 12.4h5.2'] },
  kalender: { tone: DEEP, d: ['M5.5 5.8h13a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.3v-11a1.5 1.5 0 0 1 1.5-1.5z', 'M4 10h16M8.5 3.8v3.4M15.5 3.8v3.4', 'M8.4 14h.01M12 14h.01M15.6 14h.01'] },
  dokumente: { tone: SLATE, d: ['M8 6.5V5.3A1.5 1.5 0 0 1 9.5 3.8h6l3.5 3.5v9.4a1.5 1.5 0 0 1-1.5 1.5H16', 'M5 8.3A1.5 1.5 0 0 1 6.5 6.8h6l3.5 3.5v8.4a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 5 18.7z', 'M8.5 13.2h4.2M8.5 16h3'] },
  aufgaben: { tone: CYAN, d: ['M9.6 6.6h9.4M9.6 12h9.4M9.6 17.4h9.4', 'M4.6 6.8l1.1 1.1 2-2.2M4.6 12.2l1.1 1.1 2-2.2M4.6 17.6l1.1 1.1 2-2.2'] },
  fahrzeugdaten: { tone: INDIGO, d: ['M12 9.2c3.9 0 7-1.1 7-2.5S15.9 4.2 12 4.2 5 5.3 5 6.7s3.1 2.5 7 2.5z', 'M5 6.7v10.6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6.7', 'M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5'] },
  auswertungen: { tone: TEAL, d: ['M5 19.2V12M10 19.2V6.8M15 19.2v-9M20 19.2V4.2', 'M3.8 19.2h17'] },
  uebersicht: { tone: BLUE, d: ['M4.5 5.2h6.2v6.2H4.5zM13.3 5.2h6.2v3.6h-6.2zM13.3 11.4h6.2v7.4h-6.2zM4.5 14h6.2v4.8H4.5z'] },
  stammdaten: { tone: SLATE, d: ['M5.5 19.5V6.2a1.4 1.4 0 0 1 1.4-1.4h6.2a1.4 1.4 0 0 1 1.4 1.4v13.3', 'M14.5 10.2h2.6a1.4 1.4 0 0 1 1.4 1.4v7.9', 'M3.8 19.5h16.4M8.4 8.2h2.6M8.4 11.4h2.6M8.4 14.6h2.6'] },
  verwaltung: { tone: SLATE, d: ['M5 7.5h8M17 7.5h2M5 16.5h2M11 16.5h8', 'M15 7.5a2 2 0 1 0 0 .01zM9 16.5a2 2 0 1 0 0 .01z'] },
  benutzer: { tone: DEEP, d: ['M12 3.8l6.5 2.4v5.3c0 4.1-2.7 7.1-6.5 8.7-3.8-1.6-6.5-4.6-6.5-8.7V6.2z', 'M12 11.2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M8.6 15.6c.5-1.7 1.8-2.6 3.4-2.6s2.9.9 3.4 2.6'] },
  protokoll: { tone: SLATE, d: ['M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16z', 'M12 7.8V12l3 1.8'] },
  settings: { tone: SLATE, d: ['M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z', 'M19.2 13.4l1.4 1-1.6 2.8-1.7-.5a6.7 6.7 0 0 1-1.7 1l-.3 1.8h-3.2l-.3-1.8a6.7 6.7 0 0 1-1.7-1l-1.7.5-1.6-2.8 1.4-1a6.6 6.6 0 0 1 0-2l-1.4-1 1.6-2.8 1.7.5a6.7 6.7 0 0 1 1.7-1l.3-1.8h3.2l.3 1.8c.6.2 1.2.6 1.7 1l1.7-.5 1.6 2.8-1.4 1a6.6 6.6 0 0 1 0 2z'] },
};

export const ICON_IDS = Object.keys(GLYPHS);

export function StudioIcon({ id, size = 48, label }: { id: string; size?: number; label?: string }) {
  const g = GLYPHS[id] ?? GLYPHS.uebersicht;
  const style = { width: size, height: size, borderRadius: Math.round(size * 0.26), background: `linear-gradient(145deg, ${g.tone[0]}, ${g.tone[1]})` } as CSSProperties;
  return (
    <span className="st-icon" style={style} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <svg viewBox="0 0 24 24" width={Math.round(size * 0.56)} height={Math.round(size * 0.56)} fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {g.d.map((d, i) => <path key={i} d={d} />)}
      </svg>
    </span>
  );
}

/** Kleine Symbole der Fenster- und Taskleistenbedienung (eigenständig, nicht aus dem Admin-Iconset). */
export function SysIcon({ name }: { name: 'min' | 'max' | 'restore' | 'close' | 'search' | 'bell' | 'sun' | 'moon' | 'power' | 'chevron' | 'external' | 'grid' | 'user' | 'refresh' | 'desktop' }) {
  const P: Record<string, string[]> = {
    min: ['M5 12h14'],
    max: ['M6 6h12v12H6z'],
    restore: ['M8.5 8.5V6h9.5v9.5h-2.5', 'M6 8.5h9.5V18H6z'],
    close: ['M6 6l12 12M18 6 6 18'],
    search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4'],
    bell: ['M6 17v-5.5a6 6 0 1 1 12 0V17l1.5 2h-15z', 'M10 21h4'],
    sun: ['M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z', 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4'],
    moon: ['M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z'],
    power: ['M12 3v8', 'M7 6.6a8 8 0 1 0 10 0'],
    chevron: ['M9 6l6 6-6 6'],
    external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4'],
    grid: ['M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z'],
    user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4.5 20c.6-3.6 3.4-5.6 7.5-5.6s6.9 2 7.5 5.6'],
    refresh: ['M20 11a8 8 0 0 0-14.5-4M4 4v4h4', 'M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4'],
    desktop: ['M4 5h16v11H4z', 'M9 20h6M12 16v4'],
  };
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name].map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}
