'use client';

import { memo, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { MIN_H, MIN_W, clampBounds, restoreUnderPointer, snapZone, type Action, type Bounds, type SnapSide, type WinState } from '@/lib/studio';
import { StudioIcon, SysIcon } from './StudioIcon';

type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
const DIRS: Dir[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
export type Zone = SnapSide | 'max' | null;

/**
 * Ein Fenster des ING Studios: Titelleiste (ziehen, Doppelklick = maximieren), Fensterknöpfe, Größenänderung an allen Kanten,
 * Andocken am Rand. Der Inhalt (iframe oder eingebaute App) bleibt auch minimiert eingehängt – Eingaben gehen nicht verloren.
 */
function WindowImpl({ win, area, focused, dispatch, setZone, setDragging, onTitleContext, iconId, children }: {
  win: WinState; area: Bounds; focused: boolean; dispatch: Dispatch<Action>; setZone: (z: Zone) => void; setDragging: (d: boolean) => void;
  onTitleContext: (e: React.MouseEvent) => void; iconId: string; children: ReactNode;
}) {
  const live = useRef(win);
  live.current = win;
  const [grab, setGrab] = useState(false);

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    dispatch({ type: 'focus', id: win.id });
    const sx = e.clientX, sy = e.clientY;
    let origin = { x: live.current.x, y: live.current.y };
    let size = { w: live.current.w, h: live.current.h };
    // Ort vor dem Ziehen merken: Andocken + „Wiederherstellen“ führt genau dorthin zurück
    let from: Bounds | undefined = live.current.max || live.current.snap ? (live.current.restore ?? undefined) : { x: live.current.x, y: live.current.y, w: live.current.w, h: live.current.h };
    let started = false;
    let zone: Zone = null;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!started) {
        if (Math.hypot(dx, dy) < 4) return;
        started = true; setGrab(true); setDragging(true);
        const w = live.current;
        if (w.max || w.snap) {
          const nb = restoreUnderPointer(w, { x: ev.clientX, y: ev.clientY }, area);
          dispatch({ type: 'drag', id: w.id, bounds: nb });
          origin = { x: nb.x - dx, y: nb.y - dy }; size = { w: nb.w, h: nb.h };
          from = nb;
        }
      }
      const b = clampBounds({ x: origin.x + dx, y: origin.y + dy, ...size }, area);
      dispatch({ type: 'drag', id: win.id, bounds: b });
      zone = snapZone({ x: ev.clientX, y: ev.clientY }, area);
      setZone(zone);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      if (started) {
        setGrab(false); setDragging(false); setZone(null);
        if (zone) dispatch({ type: 'snap', id: win.id, to: zone, area, from });
      }
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  const startResize = (dir: Dir) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || win.max) return;
    e.stopPropagation();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    dispatch({ type: 'focus', id: win.id });
    setDragging(true);
    const sx = e.clientX, sy = e.clientY;
    const s = { x: live.current.x, y: live.current.y, w: live.current.w, h: live.current.h };
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      let { x, y, w, h } = s;
      if (dir.includes('e')) w = Math.max(MIN_W, s.w + dx);
      if (dir.includes('s')) h = Math.max(MIN_H, s.h + dy);
      if (dir.includes('w')) { w = Math.max(MIN_W, s.w - dx); x = s.x + (s.w - w); }
      if (dir.includes('n')) { h = Math.max(MIN_H, s.h - dy); y = Math.max(0, s.y + (s.h - h)); h = s.y + s.h - y; }
      dispatch({ type: 'bounds', id: win.id, bounds: { x, y, w, h }, area });
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      setDragging(false);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  const cls = ['st-win', focused && 'is-focus', win.min && 'is-min', win.max && 'is-max', win.snap && 'is-snap', grab && 'is-grab'].filter(Boolean).join(' ');
  return (
    <section
      className={cls}
      data-win={win.id}
      data-app={win.appId}
      role="group"
      aria-label={win.title}
      aria-hidden={win.min ? true : undefined}
      style={{ left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }}
      onPointerDownCapture={() => { if (!focused) dispatch({ type: 'focus', id: win.id }); }}
    >
      <div className="st-title" onPointerDown={startDrag} onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest('button')) dispatch({ type: 'toggleMax', id: win.id, area }); }} onContextMenu={onTitleContext}>
        <StudioIcon id={iconId} size={22} />
        <span className="st-title-text">{win.title}</span>
        <div className="st-wbtns">
          <button type="button" aria-label="Minimieren" title="Minimieren" onClick={() => dispatch({ type: 'minimize', id: win.id })}><SysIcon name="min" /></button>
          <button type="button" aria-label={win.max || win.snap ? 'Wiederherstellen' : 'Maximieren'} title={win.max || win.snap ? 'Wiederherstellen' : 'Maximieren'} onClick={() => dispatch({ type: 'toggleMax', id: win.id, area })}><SysIcon name={win.max || win.snap ? 'restore' : 'max'} /></button>
          <button type="button" className="is-close" aria-label="Schließen" title="Schließen" onClick={() => dispatch({ type: 'close', id: win.id })}><SysIcon name="close" /></button>
        </div>
      </div>
      <div className="st-body">{children}</div>
      {!win.max && DIRS.map((d) => <div key={d} className={`st-rz st-rz-${d}`} onPointerDown={startResize(d)} aria-hidden="true" />)}
    </section>
  );
}
export const Window = memo(WindowImpl);
