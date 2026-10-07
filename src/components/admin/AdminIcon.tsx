import type { NavIcon } from '@/server/admin/nav';

const PATHS: Record<NavIcon, string> = {
  home: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10',
  users: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-3A3.5 3.5 0 0 0 6 17.5V19M11 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm9 8v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 5.2a3 3 0 0 1 0 5.6',
  log: 'M5 4h14v16H5zM8.5 9h7M8.5 12.5h7M8.5 16h4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-2.3a7.6 7.6 0 0 0 0-1.4l1.8-1.4-1.8-3.1-2.1.8a7.6 7.6 0 0 0-1.2-.7L15.7 4h-3.6l-.4 2.1a7.6 7.6 0 0 0-1.2.7l-2.1-.8-1.8 3.1 1.8 1.4a7.6 7.6 0 0 0 0 1.4l-1.8 1.4 1.8 3.1 2.1-.8c.4.3.8.5 1.2.7l.4 2.1h3.6l.4-2.1c.4-.2.8-.4 1.2-.7l2.1.8 1.8-3.1Z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1',
  inbox: 'M4 13l2.5-8h11L20 13v6H4zM4 13h5l1 2h4l1-2h5',
  case: 'M4 7h16v12H4zM9 7V5h6v2M4 12h16',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  doc: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
};

export function AdminIcon({ name, className = 'h-[18px] w-[18px]' }: { name: NavIcon; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
