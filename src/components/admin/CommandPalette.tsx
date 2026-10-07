'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

export type Command = { id: string; label: string; hint?: string; href: string };

/**
 * Befehlspalette (⌘K / Strg+K). Phase 1: Navigation. Ab Phase 2 kommt die
 * serverseitige Datensuche (Fallnummer, Kunde, Kennzeichen, FIN, Telefon, E-Mail,
 * Schadennummer) über denselben Dialog dazu.
 */
export function CommandPalette({ open, onClose, commands }: { open: boolean; onClose: () => void; commands: Command[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? commands.filter((c) => c.label.toLowerCase().includes(needle)) : commands;
  }, [q, commands]);

  useEffect(() => {
    if (open) {
      setQ('');
      setCursor(0);
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  const go = (c?: Command) => {
    if (!c) return;
    onClose();
    router.push(c.href);
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-start justify-items-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Suche und Befehle">
      <button type="button" className="absolute inset-0 cursor-default bg-black/60" aria-label="Schließen" onClick={onClose} />
      <div className="relative w-full max-w-[560px] overflow-hidden rounded-[14px] border border-line bg-ink-850 shadow-[0_30px_80px_-20px_rgba(0,0,0,.8)]">
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              go(results[cursor]);
            } else if (e.key === 'Escape') onClose();
          }}
          placeholder="Wohin?"
          aria-label="Befehl eingeben"
          className="w-full border-0 border-b border-line bg-transparent px-4 py-3.5 text-[1rem] text-fg outline-none placeholder:text-fg-mute"
        />
        <ul role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {results.length === 0 && <li className="px-3 py-3 text-[.9rem] text-fg-mute">Keine Treffer.</li>}
          {results.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === cursor}>
              <button
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(c)}
                className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-[8px] border-0 px-3 py-2.5 text-left text-[.92rem] ${i === cursor ? 'bg-signal-soft text-fg' : 'bg-transparent text-fg-dim'}`}
              >
                {c.label}
                {c.hint && <span className="font-mono text-[.6rem] uppercase tracking-[.12em] text-fg-mute">{c.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
