'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminIcon, type IconName } from './AdminIcon';

export type Command = { id: string; label: string; href: string; icon: IconName };
type Hit = { id: string; label: string; sub: string; href: string };
type Result = { query: string; cases: Hit[]; customers: Hit[]; vehicles: Hit[]; leads: Hit[]; invoices: Hit[]; reports: Hit[]; tasks: Hit[] };
type Row = { key: string; group: string; label: string; sub?: string; href: string; icon: IconName };

const GROUPS: [keyof Omit<Result, 'query'>, string, IconName][] = [
  ['cases', 'Fälle', 'case'],
  ['customers', 'Kunden', 'users'],
  ['vehicles', 'Fahrzeuge', 'car'],
  ['leads', 'Anfragen', 'inbox'],
  ['invoices', 'Rechnungen', 'receipt'],
  ['reports', 'Gutachten', 'doc'],
  ['tasks', 'Aufgaben', 'checksq'],
];

/**
 * Command Center (⌘K / Strg+K): echte Datensuche (Fallnummer, Kunde, Telefon, E-Mail, Kennzeichen, FIN),
 * Schnellaktionen und Navigation. Die Treffer kommen vom Server und sind bereits nach Rolle gefiltert.
 */
export function CommandPalette({ open, onClose, navigation, actions, canSearch }: { open: boolean; onClose: () => void; navigation: Command[]; actions: Command[]; canSearch: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const [data, setData] = useState<Result | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (open) {
      setQ(''); setCursor(0); setData(null); setState('idle');
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (!open || !canSearch || term.length < 2) { setData(null); setState('idle'); return; }
    const mine = ++seq.current;
    const ctrl = new AbortController();
    setState('loading');
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search/?q=${encodeURIComponent(term)}`, { signal: ctrl.signal, credentials: 'same-origin', cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as Result;
        if (mine === seq.current) { setData(json); setState('idle'); setCursor(0); }
      } catch (e) {
        if ((e as Error).name !== 'AbortError' && mine === seq.current) setState('error');
      }
    }, 180);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, open, canSearch]);

  const rows = useMemo<Row[]>(() => {
    const needle = q.trim().toLowerCase();
    const match = (c: Command) => !needle || c.label.toLowerCase().includes(needle);
    const found: Row[] = data ? GROUPS.flatMap(([k, g, icon]) => data[k].map((h) => ({ key: `${k}${h.id}`, group: g, label: h.label, sub: h.sub, href: h.href, icon }))) : [];
    const act = actions.filter(match).map((c) => ({ key: `a${c.id}`, group: 'Schnellaktionen', label: c.label, href: c.href, icon: c.icon }));
    const nav = navigation.filter(match).map((c) => ({ key: `n${c.id}`, group: 'Gehe zu', label: c.label, href: c.href, icon: c.icon }));
    return [...found, ...act, ...nav];
  }, [q, navigation, actions, data]);

  useEffect(() => { list.current?.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' }); }, [cursor]);

  if (!open) return null;
  const go = (r?: Row) => { if (!r) return; onClose(); router.push(r.href); };
  const hasData = rows.some((r) => r.group !== 'Schnellaktionen' && r.group !== 'Gehe zu');
  const noHits = canSearch && q.trim().length >= 2 && state === 'idle' && data && !hasData;

  return (
    <div className="adm-pal" role="dialog" aria-modal="true" aria-label="Suche und Befehle">
      <button type="button" className="scrim" aria-label="Schließen" onClick={onClose} />
      <div className="adm-pal-box">
        <div className="adm-pal-input">
          <AdminIcon name="search" />
          <input
            ref={input}
            value={q}
            onChange={(e) => { setQ(e.target.value); setCursor(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, rows.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); go(rows[cursor]); }
              else if (e.key === 'Escape') onClose();
            }}
            placeholder={canSearch ? 'Fall, Kunde, Kennzeichen, FIN suchen …' : 'Wohin?'}
            aria-label="Suche"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="adm-kbd">Esc</kbd>
        </div>
        <ul id="cmdk-list" role="listbox" className="adm-pal-list" ref={list}>
          {state === 'loading' && <li className="adm-pal-msg" role="presentation">Suche …</li>}
          {state === 'error' && <li role="alert" className="adm-pal-msg t-danger">Die Suche ist gerade nicht erreichbar.</li>}
          {noHits && <li className="adm-pal-msg" role="presentation">Keine Treffer für „{q.trim()}“.</li>}
          {rows.map((r, i) => (
            <li key={r.key} role="presentation">
              {(i === 0 || rows[i - 1].group !== r.group) && <p className="adm-pal-group">{r.group}</p>}
              <button type="button" role="option" aria-selected={i === cursor} className="adm-pal-item" onMouseMove={() => setCursor(i)} onClick={() => go(r)}>
                <AdminIcon name={r.icon} />
                <span className="l"><b>{r.label}</b>{r.sub ? <small>{r.sub}</small> : null}</span>
                <AdminIcon name="chevronRight" className="enter h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <div className="adm-pal-foot"><span>↑↓ wählen</span><span>↵ öffnen</span><span>Esc schließen</span></div>
      </div>
    </div>
  );
}
