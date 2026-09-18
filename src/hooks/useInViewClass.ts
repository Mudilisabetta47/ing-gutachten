'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Viewport Activation für die Reveal Engine: ein Element bekommt die Klasse
 * `is-in`, sobald es sichtbar wird — einmalig, ohne Re-Render-Kaskaden.
 * Ersetzt "20 IntersectionObserver pro Section" durch einen geteilten Hook.
 */
export function useInViewClass<T extends HTMLElement>(margin = '0px 0px -12% 0px') {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: margin, threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);

  return { ref, inView };
}
