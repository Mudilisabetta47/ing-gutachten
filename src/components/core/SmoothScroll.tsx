'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Smooth Scrolling — Teil der zentralen rAF-Schleife.
 *
 * Der reale Scrollwert wird verwendet (Lenis scrollt das Dokument, nicht
 * einen transformierten Wrapper), damit position:sticky, position:fixed,
 * IntersectionObserver, Ankerlinks, Browser-Suche und Accessibility
 * weiterhin funktionieren.
 *
 * Desktop: sanfte Dämpfung, cinematisches Gefühl.
 * Touch: natives Scrollverhalten (kein Lenis).
 * Reduced Motion: Smooth Scroll vollständig deaktiviert.
 *
 * Die Schleife pausiert automatisch, wenn der Tab unsichtbar ist.
 */
export function SmoothScroll() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (reduced || !fine) return;

    const lenis = new Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: 1, syncTouch: false });
    let raf = 0;

    const loop = (time: number) => {
      if (!document.hidden) lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onAnchor = (e: MouseEvent) => {
      const target = (e.target as HTMLElement | null)?.closest('a[href^="#"]');
      if (!target) return;
      const id = target.getAttribute('href');
      if (!id || id.length < 2) return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el as HTMLElement, { offset: -88, duration: 1.2 });
    };
    document.addEventListener('click', onAnchor);

    return () => {
      document.removeEventListener('click', onAnchor);
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
