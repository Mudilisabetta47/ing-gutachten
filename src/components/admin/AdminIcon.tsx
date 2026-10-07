/**
 * Einheitliches Linien-Icon-Set (24er Raster, 1.6 Strichstärke, runde Enden).
 * Ein Stil, keine Mischung. Icons unterstützen den Text, ersetzen ihn nicht.
 */
const PATHS = {
  home: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10',
  today: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  inbox: 'M4 13l2.5-8h11L20 13v6H4zM4 13h5l1 2h4l1-2h5',
  case: 'M4 7h16v12H4zM9 7V5h6v2M4 12h16',
  users: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-3A3.5 3.5 0 0 0 6 17.5V19M11 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm9 8v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 5.2a3 3 0 0 1 0 5.6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1',
  car: 'M5 16.5V12l1.8-4.5a2 2 0 0 1 1.9-1.3h6.6a2 2 0 0 1 1.9 1.3L19 12v4.5M5 12h14M7 16.5v2M17 16.5v2M7.5 14.2h.01M16.5 14.2h.01',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  doc: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  map: 'M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Zm0-8a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  book: 'M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10',
  log: 'M5 4h14v16H5zM8.5 9h7M8.5 12.5h7M8.5 16h4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-2.3a7.6 7.6 0 0 0 0-1.4l1.8-1.4-1.8-3.1-2.1.8a7.6 7.6 0 0 0-1.2-.7L15.7 4h-3.6l-.4 2.1a7.6 7.6 0 0 0-1.2.7l-2.1-.8-1.8 3.1 1.8 1.4a7.6 7.6 0 0 0 0 1.4l-1.8 1.4 1.8 3.1 2.1-.8c.4.3.8.5 1.2.7l.4 2.1h3.6l.4-2.1c.4-.2.8-.4 1.2-.7l2.1.8 1.8-3.1Z',
  plus: 'M12 5v14M5 12h14',
  menu: 'M4 7h16M4 12h16M4 17h16',
  bell: 'M6 17V11a6 6 0 1 1 12 0v6l1.5 2h-15zM10 21h4',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  chevronUp: 'M6 15l6-6 6 6',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  sidebar: 'M4 5h16v14H4zM9 5v14',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z',
  monitor: 'M4 5h16v11H4zM9 20h6M12 16v4',
  phone: 'M6.5 4h3l1.5 4-2 1.4a11 11 0 0 0 5.6 5.6L16 13l4 1.5v3a2 2 0 0 1-2 2A14.5 14.5 0 0 1 4.5 6a2 2 0 0 1 2-2Z',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  x: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  alert: 'M12 4 2.8 19.5h18.4zM12 10v4.5M12 17.2v.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8v.01',
  filter: 'M4 6h16M7 12h10M10 18h4',
  edit: 'M5 19l1-4L16.5 4.5a2 2 0 0 1 3 3L9 18z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  logout: 'M10 4H5v16h5M15 8l4 4-4 4M19 12H9',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5H5V6h5',
  shield: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z',
  photo: 'M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5M9 9.5h.01',
  navigate: 'M20 4 4 11l7 2 2 7z',
  note: 'M5 4h14v12l-4 4H5zM15 20v-4h4',
  archive: 'M4 5h16v4H4zM6 9v10h12V9M10 13h4',
} as const;

export type IconName = keyof typeof PATHS;
export type NavIcon = IconName;

export function AdminIcon({ name, className = 'h-[17px] w-[17px]' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
