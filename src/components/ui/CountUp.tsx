'use client';

import { useEffect, useRef, useState } from 'react';

/** Zählt beim Einblenden von 0 bis zum Zielwert. Ohne JavaScript und bei reduzierter Bewegung steht sofort der Endwert da. */
export function CountUp({ to, suffix = '', duration = 1500 }: { to: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(to);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver === 'undefined') return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // schon sichtbar: kein Flackern, Endwert bleibt
    setN(0);
    let raf = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    io.observe(el);
    // Per Sprungmarke vorbeigescrollt? Dann nie bei 0 stehen bleiben.
    const passed = () => { if (el.getBoundingClientRect().bottom < 0) { io.disconnect(); setN(to); window.removeEventListener('scroll', passed); } };
    window.addEventListener('scroll', passed, { passive: true });
    return () => { io.disconnect(); cancelAnimationFrame(raf); window.removeEventListener('scroll', passed); };
  }, [to, duration]);
  return <span ref={ref}>{n}{suffix}</span>;
}
