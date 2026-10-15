'use client';

import type { ReactNode } from 'react';

/** Lichtkegel, der dem Mauszeiger über Karten mit `data-glow` folgt (nur Maus; Touch und Tastatur bleiben unberührt). */
export function PointerGlow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={className}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return;
        const t = (e.target as HTMLElement).closest<HTMLElement>('[data-glow]');
        if (!t) return;
        const r = t.getBoundingClientRect();
        t.style.setProperty('--mx', `${Math.round(e.clientX - r.left)}px`);
        t.style.setProperty('--my', `${Math.round(e.clientY - r.top)}px`);
      }}
    >
      {children}
    </div>
  );
}
