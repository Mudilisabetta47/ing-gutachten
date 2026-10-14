'use client';

import type { StudioSettings } from '@/lib/studio';

const SHORTCUTS: [string, string][] = [
  ['Strg/⌘ + K', 'Startmenü und Suche öffnen'],
  ['Strg + Alt + ← / →', 'Fenster links / rechts andocken'],
  ['Strg + Alt + ↑', 'Maximieren / Wiederherstellen'],
  ['Strg + Alt + ↓', 'Minimieren'],
  ['Strg + Alt + W', 'Aktives Fenster schließen'],
  ['Strg + Alt + Tab', 'Zwischen Fenstern wechseln'],
  ['Strg + Alt + D', 'Desktop anzeigen'],
  ['Doppelklick Titelleiste', 'Maximieren / Wiederherstellen'],
  ['Ziehen an den Rand', 'Andocken (oben = maximieren)'],
  ['⌘- oder Umschalt-Klick, Mittelklick auf Link', 'In neuem Fenster öffnen'],
  ['Rechtsklick', 'Kontextmenü (Desktop, Symbole, Taskleiste, Links)'],
];
const WALLS: { id: StudioSettings['wallpaper']; label: string }[] = [{ id: 'ing-blue', label: 'ING Blau' }, { id: 'night-drive', label: 'Nachtfahrt' }, { id: 'daylight', label: 'Tageslicht' }];

/** Eingebaute Systemeinstellungen des Studios – gespeichert pro Benutzerkonto, nicht pro Browser. */
export function SettingsWindow({ settings, onChange, onReset, user, saving }: {
  settings: StudioSettings; onChange: (patch: Partial<StudioSettings>) => void; onReset: () => void; user: { name: string; role: string; email: string }; saving: 'idle' | 'saving' | 'saved' | 'error';
}) {
  return (
    <div className="st-settings">
      <section>
        <h3>Darstellung</h3>
        <div className="st-seg" role="radiogroup" aria-label="Darstellung">
          {(['dark', 'light', 'system'] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={settings.theme === t} onClick={() => onChange({ theme: t })}>{t === 'dark' ? 'Dunkel' : t === 'light' ? 'Hell' : 'System'}</button>
          ))}
        </div>
      </section>
      <section>
        <h3>Hintergrund</h3>
        <div className="st-walls" role="radiogroup" aria-label="Hintergrund">
          {WALLS.map((w) => (
            <button key={w.id} type="button" role="radio" aria-checked={settings.wallpaper === w.id} className="st-wall-pick" data-wall={w.id} onClick={() => onChange({ wallpaper: w.id })}>
              <span className="st-wall-thumb" data-wall={w.id} />
              {w.label}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3>Desktop</h3>
        <label className="st-check"><input type="checkbox" checked={settings.desktopIcons} onChange={(e) => onChange({ desktopIcons: e.target.checked })} /> Verknüpfungen auf dem Desktop anzeigen</label>
        <div className="st-seg" role="radiogroup" aria-label="Symbolgröße">
          {(['sm', 'md', 'lg'] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={settings.iconSize === s} onClick={() => onChange({ iconSize: s })}>{s === 'sm' ? 'Klein' : s === 'md' ? 'Mittel' : 'Groß'}</button>
          ))}
        </div>
        <label className="st-check"><input type="checkbox" checked={settings.restoreWindows} onChange={(e) => onChange({ restoreWindows: e.target.checked })} /> Geöffnete Fenster beim nächsten Start wiederherstellen</label>
      </section>
      <section>
        <h3>Fenster-Layout</h3>
        <p className="st-muted">Positionen und Größen werden pro App in Ihrem Konto gemerkt.</p>
        <button type="button" className="st-btn" onClick={onReset}>Layout zurücksetzen</button>
      </section>
      <section>
        <h3>Tastenkürzel</h3>
        <dl className="st-keys">
          {SHORTCUTS.map(([k, d]) => (<div key={k}><dt><kbd>{k}</kbd></dt><dd>{d}</dd></div>))}
        </dl>
      </section>
      <section>
        <h3>Konto & System</h3>
        <dl className="st-keys">
          <div><dt>Angemeldet als</dt><dd>{user.name} · {user.role}</dd></div>
          <div><dt>E-Mail</dt><dd>{user.email}</dd></div>
          <div><dt>Speichern</dt><dd>{saving === 'saving' ? 'Wird gespeichert …' : saving === 'error' ? 'Speichern fehlgeschlagen – Änderungen gelten nur bis zum Neuladen' : 'Automatisch im Konto'}</dd></div>
          <div><dt>Offline-Betrieb</dt><dd>Nicht verfügbar – das System braucht eine Verbindung zum Server.</dd></div>
        </dl>
      </section>
    </div>
  );
}
