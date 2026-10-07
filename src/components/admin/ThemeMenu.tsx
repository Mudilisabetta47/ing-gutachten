'use client';

import { useEffect, useState } from 'react';
import { AdminIcon } from './AdminIcon';

export type Theme = 'dark' | 'light' | 'system';
const OPTIONS: { v: Theme; label: string; icon: 'moon' | 'sun' | 'monitor' }[] = [
  { v: 'dark', label: 'Dunkel', icon: 'moon' },
  { v: 'light', label: 'Hell', icon: 'sun' },
  { v: 'system', label: 'System', icon: 'monitor' },
];

/** Dunkel · Hell · System. Die Wahl liegt in einem Cookie nur für /admin, damit der Server sofort richtig rendert (kein Aufblitzen). */
export function ThemeMenu({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  useEffect(() => setTheme(initial), [initial]);
  const pick = (t: Theme) => {
    setTheme(t);
    document.querySelector('.adm-root')?.setAttribute('data-theme', t);
    document.cookie = `ing_theme=${t}; path=/admin; max-age=31536000; samesite=lax`;
  };
  return (
    <div role="group" aria-label="Darstellung">
      <p className="adm-menu-label">Darstellung</p>
      {OPTIONS.map((o) => (
        <button key={o.v} type="button" role="menuitemradio" aria-checked={theme === o.v} className="adm-menu-item" onClick={() => pick(o.v)}>
          <AdminIcon name={o.icon} />
          {o.label}
          {theme === o.v && <AdminIcon name="check" className="chk ml-auto h-4 w-4" />}
        </button>
      ))}
    </div>
  );
}
