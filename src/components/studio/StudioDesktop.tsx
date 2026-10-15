'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import {
  TASKBAR_H, emptyState, fromSaved, reducer, safeAppUrl, toSaved, workArea, zoneBounds,
  type Action, type Bounds, type StudioPrefs, type StudioSettings,
} from '@/lib/studio';
import { SETTINGS_APP, appIdForHref, isDetailPath, softLabel, type StudioAppDto } from '@/lib/studio-apps';
import { ContextMenu, type MenuItem } from './ContextMenu';
import { NotificationCenter, type Notice, type Notif } from './NotificationCenter';
import { CalendarFlyout } from './CalendarFlyout';
import { SettingsWindow } from './SettingsWindow';
import { StartMenu } from './StartMenu';
import { StudioIcon, SysIcon } from './StudioIcon';
import { Wallpaper } from './Wallpaper';
import { Window, type Zone } from './Window';
import { markReadAction } from '@/app/admin/(panel)/aufgaben/actions';

type Props = {
  apps: StudioAppDto[];
  prefs: StudioPrefs;
  user: { name: string; role: string; email: string };
  initialNotices: Notice[];
  initialNotifs: Notif[];
  canSearch: boolean;
  logout: ReactNode;
};
type Ctx = { x: number; y: number; items: MenuItem[] } | null;

const stripSuffix = (t: string) => t.replace(/\s*·\s*ING OS\s*$/, '').trim();
const MOBILE_MAX = 899;

/**
 * ING Studio – der Desktop. Jede Anwendung ist ein echtes Fenster mit der jeweiligen Fachseite (gleiche Daten, Rechte und Speicherung wie
 * im ING Operating System). Fenster bleiben beim Minimieren bestehen – ungespeicherte Eingaben gehen beim Wechseln nicht verloren.
 */
export function StudioDesktop({ apps, prefs, user, initialNotices, initialNotifs, canSearch, logout }: Props) {
  const [vp, setVp] = useState({ w: 1440, h: 900 });
  const area = useMemo<Bounds>(() => workArea(vp), [vp]);
  const [st, dispatch] = useReducer(reducer, undefined, emptyState);
  const [settings, setSettings] = useState<StudioSettings>(prefs.settings);
  const [pinned, setPinned] = useState<string[]>(prefs.pinned);
  const [recents, setRecents] = useState(prefs.recents);
  const geometry = useRef<StudioPrefs['geometry']>(prefs.geometry);
  const [ready, setReady] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [ctx, setCtx] = useState<Ctx>(null);
  const [zone, setZone] = useState<Zone>(null);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [notices, setNotices] = useState(initialNotices);
  const [notifs, setNotifs] = useState(initialNotifs);
  const [notifLoaded, setNotifLoaded] = useState(true);
  const [now, setNow] = useState<Date | null>(null);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loaded, setLoaded] = useState<Set<string>>(new Set());

  const frames = useRef(new Map<string, HTMLIFrameElement>());
  const allowed = useMemo(() => new Set(apps.map((a) => a.id)), [apps]);
  const canCalendar = allowed.has('kalender');
  const appById = useMemo(() => new Map(apps.map((a) => [a.id, a])), [apps]);
  const themeRef = useRef(settings.theme);
  themeRef.current = settings.theme;
  const stateRef = useRef(st);
  stateRef.current = st;
  const areaRef = useRef(area);
  areaRef.current = area;

  /* ---------- Start: Größe, Layout wiederherstellen, mobil umleiten ---------- */
  useEffect(() => {
    if (window.innerWidth <= MOBILE_MAX) { window.location.replace('/admin/'); return; }
    const v = { w: window.innerWidth, h: window.innerHeight };
    setVp(v);
    if (prefs.settings.restoreWindows && prefs.windows.length) dispatch({ type: 'load', windows: fromSaved(prefs.windows, allowed, workArea(v)) });
    setReady(true);
    const onResize = () => {
      if (window.innerWidth <= MOBILE_MAX) { window.location.replace('/admin/'); return; }
      const nv = { w: window.innerWidth, h: window.innerHeight };
      setVp(nv);
      dispatch({ type: 'relayout', area: workArea(nv) });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // einmalig beim Start
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Uhr ---------- */
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  /* ---------- Darstellung: Cookie für eingebettete Seiten + Nachricht an offene Fenster ---------- */
  useEffect(() => {
    document.cookie = `ing_theme=${settings.theme}; path=/admin; max-age=31536000; samesite=lax`;
    frames.current.forEach((f) => f.contentWindow?.postMessage({ source: 'ing-studio', type: 'theme', value: settings.theme }, window.location.origin));
  }, [settings.theme]);

  /* ---------- Öffnen ---------- */
  const rememberRecent = useCallback((appId: string, url: string, title: string) => {
    const path = url.split('?')[0];
    if (!isDetailPath(url) || !allowed.has(appId)) return;
    setRecents((r) => [{ appId, url, title: title.slice(0, 120), at: Date.now() }, ...r.filter((x) => x.url.split('?')[0] !== path)].slice(0, 8));
  }, [allowed]);

  const openApp = useCallback((id: string, opts: { forceNew?: boolean } = {}) => {
    const cur = stateRef.current;
    if (id === SETTINGS_APP.id) {
      const existing = cur.windows.find((w) => w.appId === id);
      if (existing) { dispatch({ type: 'focus', id: existing.id }); return; }
      dispatch({ type: 'open', appId: id, url: '', title: SETTINGS_APP.label, area: areaRef.current, size: SETTINGS_APP.size, saved: geometry.current[id] ?? null });
      return;
    }
    const app = appById.get(id);
    if (!app) return;
    const existing = opts.forceNew ? undefined : cur.windows.find((w) => w.appId === id);
    if (existing) { dispatch({ type: 'focus', id: existing.id }); return; }
    dispatch({ type: 'open', appId: id, url: app.href, title: app.label, area: areaRef.current, size: app.size, saved: geometry.current[id] ?? null, forceNew: opts.forceNew });
  }, [appById]);

  const openHref = useCallback((href: string, label?: string) => {
    const url = safeAppUrl(href);
    if (!url) return;
    const appId = appIdForHref(url, allowed);
    const app = appById.get(appId);
    const title = label?.trim() || app?.label || 'Fenster';
    dispatch({ type: 'open', appId, url, title, area: areaRef.current, size: app?.size, forceNew: true });
    rememberRecent(appId, url, title);
  }, [allowed, appById, rememberRecent]);

  const iconForHref = useCallback((href: string) => appIdForHref(href, allowed), [allowed]);

  /* ---------- Tastenkürzel (auch aus eingebetteten Seiten weitergeleitet) ---------- */
  const shortcut = useCallback((k: { code: string; ctrl: boolean; alt: boolean; shift: boolean; meta: boolean }): boolean => {
    if ((k.ctrl || k.meta) && !k.alt && k.code === 'KeyK') { setStartOpen((o) => !o); setNotifOpen(false); setCalOpen(false); return true; }
    if (!(k.ctrl && k.alt)) return false;
    const cur = stateRef.current;
    const fw = cur.windows.find((w) => w.id === cur.focus && !w.min);
    const a = areaRef.current;
    switch (k.code) {
      case 'ArrowLeft': if (fw) dispatch({ type: 'snap', id: fw.id, to: 'left', area: a }); return true;
      case 'ArrowRight': if (fw) dispatch({ type: 'snap', id: fw.id, to: 'right', area: a }); return true;
      case 'ArrowUp': if (fw) dispatch({ type: 'toggleMax', id: fw.id, area: a }); return true;
      case 'ArrowDown': if (fw) dispatch(fw.max || fw.snap ? { type: 'toggleMax', id: fw.id, area: a } : { type: 'minimize', id: fw.id }); return true;
      case 'KeyW': if (fw) dispatch({ type: 'close', id: fw.id }); return true;
      case 'Tab': case 'KeyJ': dispatch({ type: 'cycle', dir: k.shift ? -1 : 1 }); return true;
      case 'KeyD': dispatch({ type: 'showDesktop' }); return true;
      default: return false;
    }
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (shortcut({ code: e.code, ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, meta: e.metaKey })) e.preventDefault();
      else if (e.key === 'Escape') { setStartOpen(false); setNotifOpen(false); setCalOpen(false); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shortcut]);

  /* ---------- Nachrichten aus den Fenstern ---------- */
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { source?: string; type?: string; [k: string]: unknown } | null;
      if (d?.source !== 'ing-embed') return;
      let winId: string | null = null;
      let frame: HTMLIFrameElement | null = null;
      frames.current.forEach((f, id) => { if (f.contentWindow === e.source) { winId = id; frame = f; } });
      if (!winId || !frame) return;
      const w = stateRef.current.windows.find((x) => x.id === winId);
      switch (d.type) {
        case 'nav': {
          const href = String(d.href ?? '');
          if (!w || !safeAppUrl(href)) return;
          const title = stripSuffix(String(d.title ?? '')) || w.title;
          dispatch({ type: 'meta', id: w.id, title: `${appById.get(w.appId)?.label ?? ''}${title && title !== appById.get(w.appId)?.label ? ` · ${title}` : ''}`.replace(/^ · /, ''), url: href });
          rememberRecent(w.appId, href, title);
          break;
        }
        case 'ready': (frame as HTMLIFrameElement).contentWindow?.postMessage({ source: 'ing-studio', type: 'theme', value: themeRef.current }, window.location.origin); break;
        case 'focus': dispatch({ type: 'focus', id: winId }); setStartOpen(false); setNotifOpen(false); setCalOpen(false); break;
        case 'open': openHref(String(d.href ?? ''), String(d.label ?? '')); break;
        case 'key': shortcut({ code: String(d.code ?? ''), ctrl: Boolean(d.ctrl), alt: Boolean(d.alt), shift: Boolean(d.shift), meta: Boolean(d.meta) }); break;
        case 'auth': window.location.href = '/admin/login/?weiter=/studio/'; break;
        case 'ctx': {
          const r = (frame as HTMLIFrameElement).getBoundingClientRect();
          const href = String(d.href ?? ''), label = String(d.label ?? '');
          dispatch({ type: 'focus', id: winId });
          setCtx({
            x: r.left + Number(d.x ?? 0), y: r.top + Number(d.y ?? 0),
            items: [
              { label: 'Im Fenster öffnen', onClick: () => { (frame as HTMLIFrameElement).contentWindow?.location.assign(href); } },
              { label: 'In neuem Fenster öffnen', onClick: () => openHref(href, label) },
              { sep: true, label: '' },
              { label: 'Adresse kopieren', onClick: () => { void navigator.clipboard?.writeText(`${window.location.origin}${href}`).catch(() => undefined); } },
            ],
          });
          break;
        }
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [appById, openHref, rememberRecent, shortcut]);

  /* ---------- Hinweise laden ---------- */
  const refreshState = useCallback(async () => {
    try {
      const res = await fetch('/api/studio/state/', { credentials: 'same-origin', cache: 'no-store' });
      if (res.status === 401) { window.location.href = '/admin/login/?weiter=/studio/'; return; }
      if (!res.ok) return;
      const j = (await res.json()) as { notices: Notice[]; notifications: Notif[] };
      setNotices(j.notices); setNotifs(j.notifications); setNotifLoaded(true);
    } catch { /* offline: letzten Stand behalten */ }
  }, []);
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) void refreshState(); }, 60_000);
    return () => clearInterval(t);
  }, [refreshState]);

  /* ---------- Speichern (pro Benutzerkonto, verzögert) ---------- */
  const payload = useCallback(() => {
    for (const w of stateRef.current.windows) if (!w.max && !w.snap && !w.min) geometry.current[w.appId] = { x: w.x, y: w.y, w: w.w, h: w.h };
    return { settings, pinned, recents, windows: toSaved(stateRef.current), geometry: geometry.current };
  }, [settings, pinned, recents]);
  const first = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(async (keepalive = false) => {
    setSaving('saving');
    try {
      const res = await fetch('/api/studio/prefs/', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()), keepalive });
      setSaving(res.ok ? 'saved' : 'error');
    } catch { setSaving('error'); }
  }, [payload]);
  useEffect(() => {
    if (!ready) return;
    if (first.current) { first.current = false; return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, 900);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [st.windows, settings, pinned, recents, ready, flush]);
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flush(true); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [flush]);

  /* ---------- Aktionen ---------- */
  const togglePin = useCallback((id: string) => setPinned((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(0, 16))), []);
  const patchSettings = (patch: Partial<StudioSettings>) => setSettings((s) => ({ ...s, ...patch }));
  const resetLayout = async () => {
    if (!window.confirm('Fensterpositionen und angeheftete Apps auf Standard zurücksetzen?')) return;
    geometry.current = {};
    dispatch({ type: 'closeAll' });
    setPinned([]);
    setRecents([]);
    try { await fetch('/api/studio/prefs/', { method: 'DELETE', credentials: 'same-origin' }); } catch { /* wird beim nächsten Speichern überschrieben */ }
    window.location.reload();
  };
  const markAllRead = async () => {
    await markReadAction({});
    void refreshState();
  };

  const focusedWin = st.windows.find((w) => w.id === st.focus && !w.min) ?? null;
  const dispatchW = dispatch as (a: Action) => void;

  const taskbarApps = useMemo(() => {
    const ids = [...pinned.filter((id) => allowed.has(id))];
    for (const w of st.windows) if (!ids.includes(w.appId)) ids.push(w.appId);
    return ids;
  }, [pinned, st.windows, allowed]);
  const labelOf = (id: string) => (id === SETTINGS_APP.id ? SETTINGS_APP.label : appById.get(id)?.label ?? id);

  const clickTask = (id: string) => {
    const ws = st.windows.filter((w) => w.appId === id);
    if (!ws.length) { openApp(id); return; }
    const top = [...ws].sort((a, b) => b.z - a.z)[0];
    const activeHere = ws.find((w) => w.id === st.focus && !w.min);
    if (activeHere) {
      if (ws.length > 1) { const next = [...ws].sort((a, b) => a.z - b.z)[0]; dispatch({ type: 'focus', id: next.id }); } else dispatch({ type: 'minimize', id: activeHere.id });
    } else dispatch({ type: 'focus', id: top.id });
  };
  const taskMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const ws = st.windows.filter((w) => w.appId === id);
    const items: MenuItem[] = [{ label: ws.length ? 'Neues Fenster' : 'Öffnen', onClick: () => openApp(id, { forceNew: true }), disabled: id === SETTINGS_APP.id && ws.length > 0 }];
    if (ws.length) items.push({ label: ws.length > 1 ? `Alle ${ws.length} Fenster schließen` : 'Fenster schließen', onClick: () => ws.forEach((w) => dispatch({ type: 'close', id: w.id })), danger: true });
    if (id !== SETTINGS_APP.id) items.push({ sep: true, label: '' }, { label: pinned.includes(id) ? 'Von Taskleiste lösen' : 'An Taskleiste anheften', onClick: () => togglePin(id) });
    setCtx({ x: e.clientX, y: Math.max(8, e.clientY - 12 - items.length * 34), items });
  };
  const desktopMenu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.st-win, .st-taskbar, .st-start, .st-notif, .st-dicon')) return;
    e.preventDefault();
    setStartOpen(false); setNotifOpen(false); setCalOpen(false);
    setCtx({
      x: e.clientX, y: e.clientY,
      items: [
        { label: 'Hinweise aktualisieren', onClick: () => void refreshState() },
        { label: 'Desktop anzeigen', onClick: () => dispatch({ type: 'showDesktop' }), hint: 'Strg+Alt+D', disabled: st.windows.length === 0 },
        { label: 'Alle Fenster schließen', onClick: () => dispatch({ type: 'closeAll' }), disabled: st.windows.length === 0, danger: true },
        { sep: true, label: '' },
        { label: settings.desktopIcons ? 'Desktop-Symbole ausblenden' : 'Desktop-Symbole einblenden', onClick: () => patchSettings({ desktopIcons: !settings.desktopIcons }) },
        { label: 'Einstellungen', onClick: () => openApp(SETTINGS_APP.id) },
        { sep: true, label: '' },
        { label: 'Klassische Ansicht (Operating System)', onClick: () => { window.location.href = '/admin/'; } },
      ],
    });
  };
  const titleMenu = (e: React.MouseEvent, wid: string) => {
    e.preventDefault();
    const w = st.windows.find((x) => x.id === wid);
    if (!w) return;
    setCtx({
      x: e.clientX, y: e.clientY,
      items: [
        { label: w.max || w.snap ? 'Wiederherstellen' : 'Maximieren', onClick: () => dispatch({ type: 'toggleMax', id: wid, area }), hint: 'Strg+Alt+↑' },
        { label: 'Minimieren', onClick: () => dispatch({ type: 'minimize', id: wid }), hint: 'Strg+Alt+↓' },
        { label: 'Links andocken', onClick: () => dispatch({ type: 'snap', id: wid, to: 'left', area }), hint: 'Strg+Alt+←' },
        { label: 'Rechts andocken', onClick: () => dispatch({ type: 'snap', id: wid, to: 'right', area }), hint: 'Strg+Alt+→' },
        { sep: true, label: '' },
        ...(w.appId !== SETTINGS_APP.id ? [{ label: 'Neu laden', onClick: () => frames.current.get(wid)?.contentWindow?.location.reload() }] : []),
        { label: 'Schließen', onClick: () => dispatch({ type: 'close', id: wid }), danger: true, hint: 'Strg+Alt+W' },
      ],
    });
  };
  const iconMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation();
    setSelected(id);
    setCtx({ x: e.clientX, y: e.clientY, items: [{ label: 'Öffnen', onClick: () => openApp(id) }, { label: 'In neuem Fenster öffnen', onClick: () => openApp(id, { forceNew: true }) }, { sep: true, label: '' }, { label: pinned.includes(id) ? 'Von Taskleiste lösen' : 'An Taskleiste anheften', onClick: () => togglePin(id) }] });
  };

  const unreadCount = notifs.filter((n) => !n.read).length;
  const badge = notices.reduce((a, n) => a + n.count, 0) + unreadCount;
  const clock = now ? new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(now) : '';
  const date = now ? new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }).format(now) : '';
  const zoneRect = zone ? zoneBounds(zone, area) : null;

  return (
    <div className={`st-root${dragging ? ' is-dragging' : ''}`} data-theme={settings.theme} data-icons={settings.iconSize} onContextMenu={desktopMenu} onPointerDown={(e) => { if (!(e.target as HTMLElement).closest('.st-dicon')) setSelected(null); }}>
      <Wallpaper kind={settings.wallpaper} />

      {/* Desktop-Verknüpfungen */}
      {settings.desktopIcons && (
        <ul className="st-dicons" aria-label="Desktop-Verknüpfungen" style={{ maxHeight: area.h - 24 }}>
          {apps.map((a) => (
            <li key={a.id}>
              <button type="button" className={`st-dicon${selected === a.id ? ' is-sel' : ''}`} onClick={() => setSelected(a.id)} onDoubleClick={() => openApp(a.id)} onKeyDown={(e) => { if (e.key === 'Enter') openApp(a.id); }} onContextMenu={(e) => iconMenu(e, a.id)} title={`${a.label} – ${a.hint}`}>
                <StudioIcon id={a.id} size={settings.iconSize === 'lg' ? 64 : settings.iconSize === 'sm' ? 40 : 52} />
                <span>{softLabel(a.label.replace(/^ING /, ''))}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {st.windows.length === 0 && ready && (
        <div className="st-hello" aria-live="polite">
          <h1>Willkommen, {user.name.split(' ')[0]}.</h1>
          <p>Doppelklick auf eine Verknüpfung oder <kbd>Strg</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd> für Apps und Suche.</p>
        </div>
      )}

      {/* Fenster */}
      <div className="st-layer">
        {st.windows.map((w) => {
          const isSettings = w.appId === SETTINGS_APP.id;
          return (
            <Window key={w.id} win={w} area={area} focused={st.focus === w.id && !w.min} dispatch={dispatchW} setZone={setZone} setDragging={setDragging} iconId={w.appId} onTitleContext={(e) => titleMenu(e, w.id)}>
              {isSettings ? (
                <SettingsWindow settings={settings} onChange={patchSettings} onReset={() => void resetLayout()} user={user} saving={saving} />
              ) : (
                <>
                  <iframe
                    ref={(el) => { if (el) frames.current.set(w.id, el); else frames.current.delete(w.id); }}
                    className="st-frame"
                    src={w.url}
                    title={w.title}
                    onLoad={() => setLoaded((s) => (s.has(w.id) ? s : new Set(s).add(w.id)))}
                  />
                  {!loaded.has(w.id) && <div className="st-loading" role="status"><i /><span>{appById.get(w.appId)?.label ?? 'App'} wird geladen …</span></div>}
                </>
              )}
            </Window>
          );
        })}
        {zoneRect && <div className="st-snap" style={{ left: zoneRect.x + 6, top: zoneRect.y + 6, width: zoneRect.w - 12, height: zoneRect.h - 12 }} aria-hidden="true" />}
      </div>

      {/* Startmenü und Benachrichtigungen */}
      {startOpen && (
        <StartMenu
          apps={apps} pinned={pinned.filter((id) => allowed.has(id))} recents={recents} canSearch={canSearch} user={user} logout={logout}
          onOpenApp={(id) => openApp(id)} onOpenHref={openHref} onSettings={() => openApp(SETTINGS_APP.id)} onClose={() => setStartOpen(false)} iconForHref={iconForHref} onTogglePin={togglePin}
        />
      )}
      {notifOpen && (
        <NotificationCenter notices={notices} notifications={notifs} loaded={notifLoaded} onOpen={openHref} onMarkRead={() => void markAllRead()} onRefresh={() => void refreshState()} onClose={() => setNotifOpen(false)} />
      )}

      {calOpen && <CalendarFlyout canView={canCalendar} onOpen={openHref} onClose={() => setCalOpen(false)} />}

      {/* Taskleiste */}
      <footer className="st-taskbar" style={{ height: TASKBAR_H }} onContextMenu={(e) => { if (!(e.target as HTMLElement).closest('.st-task')) e.preventDefault(); }}>
        <div className="st-bar">
          <button type="button" data-start-toggle className={`st-start-btn${startOpen ? ' is-on' : ''}`} aria-label="Startmenü" aria-expanded={startOpen} title="Start (Strg+K)" onClick={() => { setStartOpen((o) => !o); setNotifOpen(false); }}>
            <span className="st-ing" aria-hidden="true">ING</span>
          </button>
          <button type="button" className="st-search-btn" onClick={() => { setStartOpen(true); setNotifOpen(false); }} aria-label="Suchen">
            <SysIcon name="search" /><span>Suchen</span>
          </button>
          <nav className="st-tasks" aria-label="Apps">
            {taskbarApps.map((id) => {
              const ws = st.windows.filter((w) => w.appId === id);
              const active = ws.some((w) => w.id === st.focus && !w.min);
              return (
                <button key={id} type="button" className={`st-task${ws.length ? ' is-run' : ''}${active ? ' is-active' : ''}`} aria-label={`${labelOf(id)}${ws.length ? ` (${ws.length} Fenster)` : ''}`} aria-pressed={active} title={labelOf(id)} onClick={() => clickTask(id)} onContextMenu={(e) => taskMenu(e, id)}>
                  <StudioIcon id={id} size={32} />
                  {ws.length > 1 && <b className="st-task-n">{ws.length}</b>}
                </button>
              );
            })}
          </nav>
          <div className="st-tray">
            <button type="button" data-notif-toggle className="st-iconbtn st-bellbtn" aria-label={`Benachrichtigungen${badge ? `, ${badge} offen` : ''}`} aria-expanded={notifOpen} onClick={() => { setNotifOpen((o) => !o); setStartOpen(false); if (!notifOpen) void refreshState(); }}>
              <SysIcon name="bell" />
              {badge > 0 && <span className="st-badge">{badge > 99 ? '99+' : badge}</span>}
            </button>
            <button type="button" className="st-iconbtn" aria-label={settings.theme === 'light' ? 'Dunkel schalten' : 'Hell schalten'} title={settings.theme === 'light' ? 'Dunkelmodus' : 'Hellmodus'} onClick={() => patchSettings({ theme: settings.theme === 'light' ? 'dark' : 'light' })}>
              <SysIcon name={settings.theme === 'light' ? 'moon' : 'sun'} />
            </button>
            <button type="button" data-cal-toggle className={`st-clock${calOpen ? ' is-on' : ''}`} onClick={() => { setCalOpen((o) => !o); setStartOpen(false); setNotifOpen(false); }} title="Kalender" aria-expanded={calOpen} aria-label={`Uhrzeit ${clock}, Kalender öffnen`}>
              <b>{clock}</b><small>{date}</small>
            </button>
            <button type="button" className="st-showdesk" onClick={() => dispatch({ type: 'showDesktop' })} title="Desktop anzeigen (Strg+Alt+D)" aria-label="Desktop anzeigen" />
          </div>
        </div>
      </footer>

      {ctx && <ContextMenu x={ctx.x} y={ctx.y} items={ctx.items} onClose={() => setCtx(null)} />}
      {focusedWin && <p className="sr-only" aria-live="polite">{focusedWin.title} aktiv</p>}
    </div>
  );
}
