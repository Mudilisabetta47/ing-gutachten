'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { NavGroup } from '@/server/admin/nav';
import { AdminIcon, type IconName } from './AdminIcon';
import { CommandPalette, type Command } from './CommandPalette';
import { Menu, Popover } from './Overlay';
import { ThemeMenu, type Theme } from './ThemeMenu';
import { ToastProvider } from './Toast';

export type ShellNavItem = { href: string; label: string; icon: IconName; group: NavGroup; ready: boolean; phase: number; count?: number };
export type ShellAction = { id: string; label: string; href: string; icon: IconName };
export type ShellNotice = { id: string; label: string; href: string; count: number; tone: 'info' | 'warn' | 'danger' };

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');

/**
 * Rahmen des Operating Systems: einklappbare Seitenleiste (Desktop), kompakte Topbar mit Suche, Schnellanlage,
 * Hinweisen und Konto-Menü; mobil Drawer + untere Hauptnavigation.
 */
export function AdminShell({
  nav, groups, actions, notices, user, theme, collapsedInitially, logout, canSearch, children,
}: {
  nav: ShellNavItem[];
  groups: NavGroup[];
  actions: ShellAction[];
  notices: ShellNotice[];
  user: { name: string; role: string; email: string };
  theme: Theme;
  collapsedInitially: boolean;
  logout: ReactNode;
  canSearch: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [sheet, setSheet] = useState(false);
  const [palette, setPalette] = useState(false);
  const [collapsed, setCollapsed] = useState(collapsedInitially);

  useEffect(() => setSheet(false), [pathname]);
  useEffect(() => {
    document.body.classList.toggle('is-locked', sheet);
    return () => document.body.classList.remove('is-locked');
  }, [sheet]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); }
      if (e.key === 'Escape') setSheet(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      document.cookie = `ing_nav=${c ? 'open' : 'collapsed'}; path=/admin; max-age=31536000; samesite=lax`;
      return !c;
    });
  };

  const here = pathname.replace(/\/+$/, '') || '/';
  const active = (href: string) => (href === '/admin' ? here === '/admin' : here === href || here.startsWith(`${href}/`));
  const current = nav.find((n) => n.ready && active(n.href));
  const navCommands: Command[] = useMemo(() => nav.filter((n) => n.ready).map((n) => ({ id: n.href, label: n.label, href: n.href, icon: n.icon })), [nav]);
  const noticeTotal = notices.reduce((a, n) => a + n.count, 0);
  const mainNav = nav.filter((n) => n.ready && ['/admin', '/admin/heute', '/admin/anfragen', '/admin/faelle', '/admin/kunden'].includes(n.href)).slice(0, 5);

  const NavList = (
    <nav aria-label="Hauptnavigation" className="adm-nav">
      {groups.map((g) => {
        const items = nav.filter((n) => n.group === g);
        if (!items.length) return null;
        return (
          <div key={g} style={{ display: 'contents' }}>
            <p className="adm-nav-group">{g}</p>
            {items.map((n) =>
              n.ready ? (
                <Link key={n.href} href={n.href} className="adm-nav-item" aria-current={active(n.href) ? 'page' : undefined} title={collapsed ? n.label : undefined}>
                  <AdminIcon name={n.icon} />
                  <span className="label">{n.label}</span>
                  {n.count ? <span className="count" aria-label={`${n.count} neu`}>{n.count}</span> : null}
                </Link>
              ) : (
                <span key={n.href} className="adm-nav-item" aria-disabled="true" title={`${n.label} folgt in Phase ${n.phase}`}>
                  <AdminIcon name={n.icon} />
                  <span className="label">{n.label}</span>
                  <span className="soon">Phase {n.phase}</span>
                </span>
              ),
            )}
          </div>
        );
      })}
    </nav>
  );

  const Brand = (
    <Link href="/admin" className="adm-brand" aria-label="ING Operating System – Dashboard">
      <span className="adm-brand-mark">ING</span>
      <span className="adm-brand-logo"><span className="adm-logo" role="img" aria-label="ING Gutachten" /><small>Operating System</small></span>
    </Link>
  );

  return (
    <ToastProvider>
      <div className="adm-shell" data-collapsed={collapsed}>
        <aside className="adm-sidebar adm-sidebar-desktop">
          {Brand}
          {NavList}
          <div className="adm-side-foot">
            <button type="button" className="adm-nav-item" style={{ width: '100%', border: 0, background: 'transparent', cursor: 'pointer', font: 'inherit' }} onClick={toggle} aria-pressed={collapsed} title={collapsed ? 'Seitenleiste ausklappen' : 'Seitenleiste einklappen'}>
              <AdminIcon name="sidebar" />
              <span className="label">{collapsed ? 'Ausklappen' : 'Einklappen'}</span>
            </button>
          </div>
        </aside>

        <div style={{ minWidth: 0 }}>
          <header className="adm-topbar">
            <button type="button" className="adm-btn adm-btn-quiet adm-btn-icon adm-hide-lg-up" aria-label="Menü öffnen" aria-expanded={sheet} onClick={() => setSheet(true)}>
              <AdminIcon name="menu" className="h-5 w-5" />
            </button>
            <span className="t-2 truncate-1 adm-show-lg" style={{ fontWeight: 600, minWidth: 96 }}>{current?.label ?? 'Operating System'}</span>
            <div className="adm-top-search">
              <button type="button" onClick={() => setPalette(true)} aria-label="Suche und Befehle öffnen">
                <AdminIcon name="search" />
                <span>{canSearch ? 'Fall, Kunde, Kennzeichen, FIN suchen …' : 'Befehl suchen …'}</span>
                <kbd className="adm-kbd">⌘K</kbd>
              </button>
            </div>
            <div className="adm-top-actions">
              {actions.length > 0 && (
                <span className="qa"><Menu
                  label="Schnell anlegen"
                  triggerClassName="adm-btn adm-btn-secondary adm-btn-icon"
                  trigger={<AdminIcon name="plus" />}
                  entries={[{ kind: 'label', label: 'Neu anlegen' }, ...actions.map((a) => ({ kind: 'link' as const, label: a.label, href: a.href, icon: a.icon }))]}
                /></span>
              )}
              <Popover
                label={`Hinweise${noticeTotal ? `, ${noticeTotal} offen` : ''}`}
                trigger={<AdminIcon name="bell" />}
                badge={noticeTotal ? <span className="adm-dot" aria-hidden="true">{noticeTotal > 99 ? '99+' : noticeTotal}</span> : null}
              >
                <p className="adm-menu-label">Hinweise</p>
                {notices.length === 0 ? (
                  <p className="adm-pal-msg" style={{ padding: '10px 10px 12px' }}>Alles erledigt – keine offenen Hinweise.</p>
                ) : (
                  notices.map((n) => (
                    <Link key={n.id} href={n.href} role="menuitem" className="adm-menu-item">
                      <span className={`adm-badge adm-badge-${n.tone === 'danger' ? 'danger' : n.tone === 'warn' ? 'warn' : 'info'}`} style={{ padding: 0, background: 'transparent' }} aria-hidden="true" />
                      <span style={{ flex: 1 }}>{n.label}</span>
                      <b className="tabular">{n.count}</b>
                    </Link>
                  ))
                )}
              </Popover>
              <Popover label="Konto" triggerClassName="adm-btn adm-btn-quiet" trigger={<span className="adm-avatar">{initials(user.name)}</span>}>
                <div style={{ padding: '8px 10px 10px', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span className="adm-avatar adm-avatar-lg">{initials(user.name)}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 600 }} className="truncate-1">{user.name}</p>
                    <p className="t-3 truncate-1" style={{ margin: 0, fontSize: 12 }}>{user.role} · {user.email}</p>
                  </div>
                </div>
                <div className="adm-menu-sep" />
                <Link href="/admin/profil" role="menuitem" className="adm-menu-item"><AdminIcon name="user" />Profil &amp; Sicherheit</Link>
                <div className="adm-menu-sep" />
                <ThemeMenu initial={theme} />
                <div className="adm-menu-sep" />
                {logout}
              </Popover>
            </div>
          </header>

          <main id="admin-main" className="adm-main">{children}</main>
        </div>

        {sheet && (
          <div className="adm-navsheet adm-hide-lg-up" role="dialog" aria-modal="true" aria-label="Navigation">
            <button type="button" className="scrim" aria-label="Menü schließen" onClick={() => setSheet(false)} />
            <div className="panel">
              {Brand}
              {NavList}
              <div className="adm-side-foot">{logout}</div>
            </div>
          </div>
        )}

        <nav className="adm-bottomnav" aria-label="Schnellnavigation">
          {mainNav.map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(n.href) ? 'page' : undefined}>
              <AdminIcon name={n.icon} />
              {n.label}
            </Link>
          ))}
        </nav>

        <CommandPalette open={palette} onClose={() => setPalette(false)} navigation={navCommands} actions={actions} canSearch={canSearch} />
      </div>
    </ToastProvider>
  );
}
