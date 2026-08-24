'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Dezenter Custom Cursor: kleiner Punkt, der bei interaktiven Elementen
 * zu einem Ring wächst. Nur Maus, nie Touch, nie bei reduzierter Bewegung.
 */
export function CustomCursor() {
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<'idle' | 'btn' | 'media' | 'link'>('idle');
  const [label, setLabel] = useState('');

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (reduced || !fine) return;
    setEnabled(true);

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;
    let raf = 0;
    let visible = false;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (!visible) {
        visible = true;
        ring.current?.style.setProperty('opacity', '1');
        dot.current?.style.setProperty('opacity', '1');
      }
      if (dot.current) dot.current.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
    };

    const onOver = (e: MouseEvent) => {
      const t = (e.target as HTMLElement | null)?.closest<HTMLElement>('a, button, [data-cursor]');
      if (!t) {
        setMode('idle');
        setLabel('');
        return;
      }
      const m = t.dataset.cursor;
      if (m === 'media') {
        setMode('media');
        setLabel(t.dataset.cursorLabel ?? 'ANSEHEN');
      } else if (m === 'link') {
        setMode('link');
        setLabel(t.dataset.cursorLabel ?? 'ÖFFNEN');
      } else {
        setMode('btn');
        setLabel('');
      }
    };

    const onLeave = () => {
      visible = false;
      ring.current?.style.setProperty('opacity', '0');
      dot.current?.style.setProperty('opacity', '0');
    };

    const loop = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  if (!enabled) return null;

  const size = mode === 'media' ? 104 : mode === 'link' ? 74 : mode === 'btn' ? 66 : 44;

  return (
    <>
      <div
        ref={ring}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[999] grid place-items-center rounded-full opacity-0 mix-blend-difference transition-[width,height,margin,background-color,border-color] duration-300 ease-out"
        style={{
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          border: mode === 'btn' ? '1px solid transparent' : '1px solid rgba(255,255,255,.55)',
          background:
            mode === 'btn' ? 'rgba(255,255,255,.9)' : mode === 'media' ? 'rgba(255,255,255,.12)' : 'transparent',
        }}
      >
        <span className="font-mono text-[.55rem] tracking-[.14em] text-white">{label}</span>
      </div>
      <div
        ref={dot}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[999] -ml-[2.5px] -mt-[2.5px] h-[5px] w-[5px] rounded-full bg-white opacity-0 mix-blend-difference"
        style={{ visibility: mode === 'idle' ? 'visible' : 'hidden' }}
      />
    </>
  );
}
