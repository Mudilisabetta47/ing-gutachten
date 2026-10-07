'use client';

import { useEffect, useState } from 'react';
import { AdminIcon } from './AdminIcon';
import { Popover } from './Overlay';

export type ColumnDef = { key: string; label: string; defaultOn: boolean };

/** Spaltenauswahl für Tabellen (merkt sich die Wahl im Browser). Der Server rendert die Standardspalten, das Skript passt sie danach an. */
export function ColumnPicker({ tableId, columns }: { tableId: string; columns: ColumnDef[] }) {
  const storeKey = `ing_cols_${tableId}`;
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(columns.map((c) => [c.key, c.defaultOn])));
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) setOn((cur) => ({ ...cur, ...(JSON.parse(raw) as Record<string, boolean>) }));
    } catch { /* ohne Speicher: Standard */ }
  }, [storeKey]);
  useEffect(() => {
    const el = document.getElementById(tableId);
    if (!el) return;
    for (const c of columns) {
      if (on[c.key]) el.removeAttribute(`data-hide-${c.key}`);
      else el.setAttribute(`data-hide-${c.key}`, '1');
    }
  }, [on, tableId, columns]);
  const toggle = (k: string) =>
    setOn((cur) => {
      const next = { ...cur, [k]: !cur[k] };
      try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* egal */ }
      return next;
    });
  return (
    <Popover label="Spalten wählen" triggerClassName="adm-btn adm-btn-secondary" trigger={<><AdminIcon name="filter" />Spalten</>} align="right">
      <div onChange={(e) => e.stopPropagation()}>
      <p className="adm-menu-label">Angezeigte Spalten</p>
      {columns.map((c) => (
        <label key={c.key} className="adm-menu-item" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={on[c.key]} onChange={() => toggle(c.key)} style={{ width: 16, height: 16, accentColor: 'rgb(var(--a-blue))' }} />
          {c.label}
        </label>
      ))}
      </div>
    </Popover>
  );
}
