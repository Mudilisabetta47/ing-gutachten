'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import type { NavIcon } from '@/server/admin/nav';
import { AdminIcon } from './AdminIcon';
import { CommandPalette, type Command } from './CommandPalette';

export type ShellNavItem = { href: string; label: string; icon: NavIcon };

/**
 * Admin-Rahmen: feste Seitenleiste ab 1024 px, darunter Kopfzeile mit Drawer
 * (mobil bedienbar). Wenig Bewegung – nur Drawer und Hover.
 */
export function AdminShell({
  nav,
  upcoming,
  user,
  logout,
  children,
}: {
  nav: ShellNavItem[];
  upcoming: { label: string; phase: number }[];
  user: { name: string; role: string };
  logout: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.classList.toggle('is-locked', open);
    return () => document.body.classList.remove('is-locked');
  }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // trailingSlash: true → Pfade enden auf "/"; zum Vergleichen normalisieren.
  const here = pathname.replace(/\/+$/, '') || '/';
  const active = (href: string) => (href === '/admin' ? here === '/admin' : here === href || here.startsWith(`${href}/`));
  const commands: Command[] = nav.map((n) => ({ id: n.href, label: n.label, hint: 'Gehe zu', href: n.href }));

  const NavList = (
    <nav aria-label="Hauptnavigation" className="grid gap-0.5">
      {nav.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={active(n.href) ? 'page' : undefined}
          className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[.92rem] transition-colors ${
            active(n.href) ? 'bg-signal-soft text-fg' : 'text-fg-dim hover:bg-white/[.04] hover:text-fg'
          }`}
        >
          <AdminIcon name={n.icon} className={`h-[18px] w-[18px] ${active(n.href) ? 'text-signal-bright' : ''}`} />
          {n.label}
        </Link>
      ))}
      {upcoming.length > 0 && (
        <div className="mt-5 px-3">
          <p className="adm-label">Im Aufbau</p>
          <ul className="grid gap-1 text-[.82rem] text-fg-mute">
            {upcoming.map((u) => (
              <li key={u.label} className="flex justify-between gap-2">
                <span>{u.label}</span>
                <span className="font-mono text-[.62rem]">Phase {u.phase}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );

  return (
    <div className="min-h-[100svh] lg:grid lg:grid-cols-[256px_1fr]">
      {/* Seitenleiste (Desktop) */}
      <aside className="sticky top-0 hidden h-[100svh] flex-col gap-6 overflow-y-auto border-r border-line bg-ink-850 p-4 lg:flex">
        <Link href="/admin" className="flex items-center gap-2.5 px-2 py-1 font-display text-[1.05rem] font-bold tracking-[-.02em]">
          <span className="grid h-8 w-8 place-items-center rounded-[8px] bg-signal text-[.78rem] text-white">ING</span>
          Operating System
        </Link>
        {NavList}
        <div className="mt-auto grid gap-2 border-t border-line pt-4">
          <Link href="/admin/profil" className="rounded-[10px] px-3 py-2 hover:bg-white/[.04]">
            <span className="block text-[.9rem]">{user.name}</span>
            <span className="font-mono text-[.62rem] uppercase tracking-[.12em] text-fg-mute">{user.role}</span>
          </Link>
          {logout}
        </div>
      </aside>

      <div className="min-w-0">
        {/* Kopfzeile */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-ink-900/90 px-4 py-2.5 backdrop-blur lg:px-8">
          <button type="button" className="adm-btn adm-btn-ghost !px-3 lg:hidden" aria-label="Menü öffnen" aria-expanded={open} onClick={() => setOpen(true)}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <button type="button" onClick={() => setPalette(true)} className="adm-input !w-auto min-w-0 flex-1 cursor-pointer text-left text-fg-mute sm:max-w-[420px]" aria-label="Suche und Befehle öffnen">
            Suchen oder Befehl …
            <kbd className="float-right hidden rounded border border-line px-1.5 font-mono text-[.65rem] sm:inline">⌘K</kbd>
          </button>
          <span className="ml-auto hidden font-mono text-[.62rem] uppercase tracking-[.12em] text-fg-mute sm:block">{user.role}</span>
        </header>

        <main id="admin-main" className="mx-auto w-full max-w-[1240px] px-4 py-6 lg:px-8 lg:py-9">
          {children}
        </main>
      </div>

      {/* Drawer (mobil) */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button type="button" className="absolute inset-0 cursor-default bg-black/60" aria-label="Menü schließen" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(88vw,320px)] flex-col gap-5 overflow-y-auto border-r border-line bg-ink-850 p-4">
            <div className="flex items-center justify-between">
              <span className="font-display font-bold">ING Operating System</span>
              <button type="button" className="adm-btn adm-btn-ghost !px-3" onClick={() => setOpen(false)} aria-label="Menü schließen">
                ✕
              </button>
            </div>
            {NavList}
            <div className="mt-auto grid gap-2 border-t border-line pt-4">
              <Link href="/admin/profil" className="rounded-[10px] px-3 py-2">
                <span className="block text-[.95rem]">{user.name}</span>
                <span className="font-mono text-[.62rem] uppercase tracking-[.12em] text-fg-mute">{user.role}</span>
              </Link>
              {logout}
            </div>
          </div>
        </div>
      )}

      <CommandPalette open={palette} onClose={() => setPalette(false)} commands={commands} />
    </div>
  );
}
