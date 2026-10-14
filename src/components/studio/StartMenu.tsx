'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { StudioAppDto } from '@/lib/studio-apps';
import type { StudioPrefs } from '@/lib/studio';
import { softLabel } from '@/lib/studio-apps';
import { StudioIcon, SysIcon } from './StudioIcon';

type Hit = { id: string; label: string; sub: string; href: string };
type Found = { cases?: Hit[]; customers?: Hit[]; vehicles?: Hit[]; leads?: Hit[]; invoices?: Hit[]; reports?: Hit[]; tasks?: Hit[] };
const GROUPS: [keyof Found, string][] = [['cases', 'Fälle'], ['customers', 'Kunden'], ['vehicles', 'Fahrzeuge'], ['leads', 'Anfragen'], ['invoices', 'Rechnungen'], ['reports', 'Gutachten'], ['tasks', 'Aufgaben']];

type Row = { key: string; kind: 'app' | 'hit' | 'recent'; label: string; sub?: string; icon: string; run: () => void; group: string };

/**
 * Startmenü: App-Suche und Datensuche (Fälle, Kunden, Fahrzeuge …) in einem Feld, darunter angeheftete Apps und zuletzt Geöffnetes.
 * Treffer öffnen in einem eigenen Fenster (forceNew), damit die geöffnete Liste daneben stehen bleibt.
 */
export function StartMenu({ apps, pinned, recents, canSearch, user, logout, onOpenApp, onOpenHref, onSettings, onClose, iconForHref, onTogglePin }: {
  apps: StudioAppDto[]; pinned: string[]; recents: StudioPrefs['recents']; canSearch: boolean; user: { name: string; role: string };
  logout: ReactNode; onOpenApp: (id: string) => void; onOpenHref: (href: string, label: string) => void; onSettings: () => void; onClose: () => void;
  iconForHref: (href: string) => string; onTogglePin: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const [found, setFound] = useState<Found | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!root.current?.contains(t) && !t.closest('[data-start-toggle]')) onClose();
    };
    document.addEventListener('pointerdown', down, true);
    return () => document.removeEventListener('pointerdown', down, true);
  }, [onClose]);

  useEffect(() => {
    const term = q.trim();
    if (!canSearch || term.length < 2) { setFound(null); setState('idle'); return; }
    const mine = ++seq.current;
    const ctrl = new AbortController();
    setState('loading');
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search/?q=${encodeURIComponent(term)}`, { signal: ctrl.signal, credentials: 'same-origin', cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as Found;
        if (mine === seq.current) { setFound(json); setState('idle'); setCursor(0); }
      } catch (e) {
        if ((e as Error).name !== 'AbortError' && mine === seq.current) setState('error');
      }
    }, 180);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, canSearch]);

  const needle = q.trim().toLowerCase();
  const rows = useMemo<Row[]>(() => {
    if (!needle) return [];
    const appRows: Row[] = apps.filter((a) => a.label.toLowerCase().includes(needle) || a.hint.toLowerCase().includes(needle)).map((a) => ({ key: `app-${a.id}`, kind: 'app', label: a.label, sub: a.hint, icon: a.id, group: 'Apps', run: () => onOpenApp(a.id) }));
    const hits: Row[] = found ? GROUPS.flatMap(([k, g]) => (found[k] ?? []).map((h): Row => ({ key: `${k}-${h.id}`, kind: 'hit', label: h.label, sub: h.sub, icon: iconForHref(h.href), group: g, run: () => onOpenHref(h.href, h.label) }))) : [];
    return [...appRows, ...hits];
  }, [needle, apps, found, onOpenApp, onOpenHref, iconForHref]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (!rows.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, rows.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); rows[cursor]?.run(); onClose(); }
  };
  useEffect(() => { root.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }); }, [cursor]);

  const pinnedApps = pinned.map((id) => apps.find((a) => a.id === id)).filter((a): a is StudioAppDto => Boolean(a));
  const groups = [...new Set(apps.map((a) => a.group))];
  let lastGroup = '';

  return (
    <div ref={root} className="st-start" role="dialog" aria-label="Startmenü" onKeyDown={onKey}>
      <div className="st-start-search">
        <SysIcon name="search" />
        <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setCursor(0); }} placeholder={canSearch ? 'Apps, Fälle, Kunden, Kennzeichen, FIN suchen …' : 'Apps suchen …'} aria-label="Suchen" autoComplete="off" spellCheck={false} />
      </div>

      <div className="st-start-scroll">
        {needle ? (
          rows.length === 0 ? (
            <p className="st-start-msg">{state === 'loading' ? 'Suche läuft …' : state === 'error' ? 'Die Suche ist gerade nicht erreichbar.' : needle.length < 2 && canSearch ? 'Mindestens 2 Zeichen eingeben.' : 'Keine Treffer.'}</p>
          ) : (
            <ul className="st-start-list" role="listbox" aria-label="Suchergebnisse">
              {rows.map((r, i) => {
                const head = r.group !== lastGroup ? ((lastGroup = r.group), <li key={`g-${r.group}`} className="st-start-grp" role="presentation">{r.group}</li>) : null;
                return (
                  <li key={r.key} role="presentation" style={{ display: 'contents' }}>
                    {head}
                    <button type="button" role="option" aria-selected={i === cursor} data-active={i === cursor} className="st-start-row" onMouseMove={() => setCursor(i)} onClick={() => { r.run(); onClose(); }}>
                      <StudioIcon id={r.icon} size={30} />
                      <span><b>{r.label}</b>{r.sub && <small>{r.sub}</small>}</span>
                    </button>
                  </li>
                );
              })}
              {state === 'loading' && <li className="st-start-msg" role="presentation">Suche läuft …</li>}
            </ul>
          )
        ) : (
          <>
            <h3 className="st-start-h">Angeheftet</h3>
            <div className="st-start-grid">
              {pinnedApps.map((a) => (
                <button key={a.id} type="button" className="st-start-app" onClick={() => { onOpenApp(a.id); onClose(); }} onContextMenu={(e) => { e.preventDefault(); onTogglePin(a.id); }} title={`${a.label} – Rechtsklick: von Taskleiste lösen`}>
                  <StudioIcon id={a.id} size={44} />
                  <span>{softLabel(a.label.replace(/^ING /, ''))}</span>
                </button>
              ))}
            </div>
            {groups.map((g) => (
              <section key={g}>
                <h3 className="st-start-h">{g}</h3>
                <ul className="st-start-list">
                  {apps.filter((a) => a.group === g).map((a) => (
                    <li key={a.id} style={{ display: 'contents' }}>
                      <button type="button" className="st-start-row" onClick={() => { onOpenApp(a.id); onClose(); }} onContextMenu={(e) => { e.preventDefault(); onTogglePin(a.id); }}>
                        <StudioIcon id={a.id} size={30} />
                        <span><b>{a.label}</b><small>{a.hint}</small></span>
                        {pinned.includes(a.id) && <i className="st-pin" aria-label="An Taskleiste angeheftet" title="An Taskleiste angeheftet" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {recents.length > 0 && (
              <section>
                <h3 className="st-start-h">Zuletzt geöffnet</h3>
                <ul className="st-start-list">
                  {recents.map((r) => (
                    <li key={r.url} style={{ display: 'contents' }}>
                      <button type="button" className="st-start-row" onClick={() => { onOpenHref(r.url, r.title); onClose(); }}>
                        <StudioIcon id={r.appId} size={30} />
                        <span><b>{r.title}</b><small>{apps.find((a) => a.id === r.appId)?.label ?? ''}</small></span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>

      <div className="st-start-foot">
        <span className="st-avatar" aria-hidden="true">{user.name.split(/\s+/).slice(0, 2).map((p) => p[0]).join('')}</span>
        <span className="st-start-user"><b>{user.name}</b><small>{user.role}</small></span>
        <button type="button" className="st-iconbtn" aria-label="Einstellungen" title="Einstellungen" onClick={() => { onSettings(); onClose(); }}><StudioIcon id="settings" size={26} /></button>
        {logout}
      </div>
    </div>
  );
}
