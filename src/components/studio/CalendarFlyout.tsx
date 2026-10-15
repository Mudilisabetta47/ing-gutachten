'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Appt = { id: string; startsAt: string; endsAt: string; kind: string; status: string; caseNumber: string; who: string; expert: string; href: string };
const TZ = 'Europe/Berlin';
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
const hm = (iso: string) => new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso));
const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Kalender in der Taskleiste (Klick auf die Uhr): Monatsraster mit Terminpunkten, Tagesliste, Sprung in den ING Kalender, Link zur Kalender-Synchronisierung. */
export function CalendarFlyout({ canView, onOpen, onClose }: { canView: boolean; onOpen: (href: string, label: string) => void; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const today = useMemo(() => dayKey(new Date()), []);
  const [ym, setYm] = useState(today.slice(0, 7));
  const [sel, setSel] = useState(today);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'error'>(canView ? 'loading' : 'ok');

  useEffect(() => {
    const down = (e: PointerEvent) => { const t = e.target as HTMLElement; if (!root.current?.contains(t) && !t.closest('[data-cal-toggle]')) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', down, true); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down, true); document.removeEventListener('keydown', key); };
  }, [onClose]);

  const load = useCallback(async (m: string) => {
    if (!canView) return;
    setState('loading');
    try {
      const r = await fetch(`/api/studio/kalender?monat=${m}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('x');
      const j = (await r.json()) as { appointments: Appt[] };
      setAppts(j.appointments); setState('ok');
    } catch { setState('error'); }
  }, [canView]);
  useEffect(() => { void load(ym); }, [ym, load]);

  const byDay = useMemo(() => {
    const m = new Map<string, Appt[]>();
    for (const a of appts) { const k = dayKey(new Date(a.startsAt)); m.set(k, [...(m.get(k) ?? []), a]); }
    return m;
  }, [appts]);

  const [y, mo] = ym.split('-').map(Number);
  const firstOffset = (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => new Date(Date.UTC(y, mo - 1, 1 - firstOffset + i, 12)).toISOString().slice(0, 10));
  const shift = (n: number) => { const d = new Date(Date.UTC(y, mo - 1 + n, 1)); setYm(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`); };
  const list = (byDay.get(sel) ?? []).filter((a) => a.status !== 'CANCELLED' && a.status !== 'NO_SHOW');
  const selLabel = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${sel}T12:00:00Z`));

  return (
    <div ref={root} className="st-cal" role="dialog" aria-label="Kalender">
      <header>
        <h3>{MONTHS[mo - 1]} {y}</h3>
        <div>
          <button type="button" className="st-iconbtn" aria-label="Vorheriger Monat" onClick={() => shift(-1)}><span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>‹</span></button>
          <button type="button" className="st-link" onClick={() => { setYm(today.slice(0, 7)); setSel(today); }}>Heute</button>
          <button type="button" className="st-iconbtn" aria-label="Nächster Monat" onClick={() => shift(1)}><span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>›</span></button>
        </div>
      </header>
      <div className="st-cal-grid" role="group" aria-label={`${MONTHS[mo - 1]} ${y}`}>
        {WD.map((d) => <span key={d} className="st-cal-wd" aria-hidden="true">{d}</span>)}
        {cells.map((c) => {
          const n = (byDay.get(c) ?? []).filter((a) => a.status !== 'CANCELLED' && a.status !== 'NO_SHOW').length;
          const other = c.slice(0, 7) !== ym;
          return (
            <button key={c} type="button" data-day={c} className={`st-cal-day${other ? ' is-other' : ''}${c === today ? ' is-today' : ''}${c === sel ? ' is-sel' : ''}`} onClick={() => setSel(c)} aria-label={`${c.slice(8)}.${c.slice(5, 7)}.${n ? `, ${n} Termine` : ''}`} aria-current={c === today ? 'date' : undefined} aria-pressed={c === sel}>
              <b>{Number(c.slice(8))}</b>
              {n > 0 && <i className="st-cal-dot" aria-hidden="true">{n > 1 ? n : ''}</i>}
            </button>
          );
        })}
      </div>
      <div className="st-cal-list">
        <h4>{selLabel}</h4>
        {!canView ? <p className="st-start-msg">Für dieses Konto sind keine Termine freigegeben.</p>
          : state === 'loading' ? <p className="st-start-msg">Lädt …</p>
          : state === 'error' ? <p className="st-start-msg">Termine konnten nicht geladen werden. <button type="button" className="st-link" onClick={() => void load(ym)}>Erneut versuchen</button></p>
          : list.length === 0 ? <p className="st-start-msg">Keine Termine an diesem Tag.</p>
          : (
            <ul>
              {list.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => { onOpen(a.href, `Fall ${a.caseNumber}`); onClose(); }}>
                    <b>{hm(a.startsAt)}–{hm(a.endsAt)}</b>
                    <span>{a.kind} · {a.who}<small>{a.caseNumber} · {a.expert}</small></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
      </div>
      <footer>
        {canView && <button type="button" className="st-link" onClick={() => { onOpen(`/admin/termine/?datum=${sel}`, 'ING Kalender'); onClose(); }}>ING Kalender öffnen</button>}
        <button type="button" className="st-link" onClick={() => { onOpen('/admin/profil/#kalender', 'Kalender verbinden'); onClose(); }}>Mit meinem Kalender verbinden</button>
      </footer>
    </div>
  );
}
