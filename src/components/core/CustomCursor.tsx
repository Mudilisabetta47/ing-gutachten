'use client';

import { useEffect, useRef, useState } from 'react';

type Mode = 'idle' | 'cta' | 'media' | 'menu' | 'special';

const SIZE: Record<Mode, number> = { idle: 14, cta: 88, media: 108, menu: 72, special: 96 };

/**
 * Custom Cursor — Teil der zentralen Motion Engine, nicht pro Section neu
 * gebaut. Zustände: idle (Punkt + Ring), cta (OPEN/RESERVE), media (VIEW),
 * menu, special (EXPLORE). Folgt der Maus weich verzögert. Nur Zeigergeräte,
 * niemals Touch, niemals bei reduzierter Bewegung.
 */
export function CustomCursor() {
  const ring = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<Mode>('idle');
  const [label, setLabel] = useState('');

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (reduced || !fine) return;
    setEnabled(true);
    document.documentElement.classList.add('has-cursor');

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
      }
    };

    const onOver = (e: MouseEvent) => {
      const t = (e.target as HTMLElement | null)?.closest<HTMLElement>('a, button, [data-cursor]');
      if (!t) {
        setMode('idle');
        setLabel('');
        return;
      }
      const m = t.dataset.cursor as Mode | undefined;
      if (m === 'media') {
        setMode('media');
        setLabel(t.dataset.cursorLabel ?? 'VIEW');
      } else if (m === 'special') {
        setMode('special');
        setLabel(t.dataset.cursorLabel ?? 'EXPLORE');
      } else if (m === 'menu') {
        setMode('menu');
        setLabel(t.dataset.cursorLabel ?? '');
      } else {
        setMode('cta');
        setLabel(t.dataset.cursorLabel ?? '');
      }
    };

    const onLeave = () => {
      visible = false;
      ring.current?.style.setProperty('opacity', '0');
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
      document.documentElement.classList.remove('has-cursor');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  if (!enabled) return null;

  const size = SIZE[mode];

  return (
    <div
      ref={ring}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[999] grid place-items-center rounded-full opacity-0 mix-blend-difference transition-[width,height,margin,background-color,border-color] duration-300 ease-out"
      style={{
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        border: mode === 'idle' ? '1px solid rgba(255,255,255,.6)' : '1px solid transparent',
        background:
          mode === 'idle'
            ? 'rgba(255,255,255,.94)'
            : mode === 'media' || mode === 'menu'
              ? 'rgba(255,255,255,.14)'
              : 'rgba(255,255,255,.94)',
      }}
    >
      {mode === 'idle' ? (
        <span className="block h-[4px] w-[4px] rounded-full bg-transparent" />
      ) : (
        <span className="font-mono text-[.58rem] tracking-[.16em] text-white">
          {mode === 'cta' || mode === 'special' ? '' : label}
        </span>
      )}
      {(mode === 'cta' || mode === 'special') && (
        <span className="font-mono text-[.58rem] tracking-[.16em] text-night">{label}</span>
      )}
    </div>
  );
}
