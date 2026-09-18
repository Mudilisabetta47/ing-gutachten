'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

const STOPS = [
  { key: 'coffee', label: 'Kaffee', tone: '#c9a463' },
  { key: 'breakfast', label: 'Frühstück', tone: '#e9c9c9' },
  { key: 'cake', label: 'Kuchen', tone: '#b8636f' },
  { key: 'dessert', label: 'Dessert', tone: '#7d2f3a' },
  { key: 'atmosphere', label: 'Atmosphäre', tone: '#8d7a6d' },
  { key: 'rose', label: 'Rose Café', tone: '#b8636f' },
];

/**
 * HORIZONTAL SCROLL STORY — während vertikal gescrollt wird, läuft der
 * Inhalt horizontal durch. Die Section bleibt sticky, der Fortschritt
 * kommt aus derselben Scroll-Timeline wie überall sonst.
 */
export function HorizontalJourney() {
  const track = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: track, offset: ['start start', 'end end'] });
  /* translateX-Prozente beziehen sich auf die eigene (aufsummierte) Breite
     des Flex-Containers, nicht auf die Viewport-Breite — deshalb in vw
     rechnen, nicht in %. */
  const x = useTransform(scrollYProgress, [0, 1], ['0vw', `-${(STOPS.length - 1) * 100}vw`]);

  if (reduced) {
    return (
      <section aria-label="Reise durch Rose Café" className="section-tight bg-cream">
        <div className="shell no-scrollbar flex snap-x gap-4 overflow-x-auto pb-4">
          {STOPS.map((s) => (
            <Stop key={s.key} stop={s} className="w-[78vw] flex-none snap-center sm:w-[360px]" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Reise durch Rose Café" className="relative bg-cream">
      <div ref={track} className="story__track" style={{ height: `${STOPS.length * 100}vh` }}>
        <div className="story__stage flex items-center overflow-hidden">
          <motion.div className="flex" style={{ x }}>
            {STOPS.map((s) => (
              <div key={s.key} className="grid w-screen flex-none place-items-center px-[var(--pad)]">
                <Stop stop={s} className="w-full max-w-[560px]" />
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Stop({ stop, className }: { stop: (typeof STOPS)[number]; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-6 aspect-[4/3] w-full overflow-hidden rounded-[24px]" style={{ background: `linear-gradient(150deg, ${stop.tone}33, ${stop.tone}0d)` }}>
        <svg viewBox="0 0 200 150" className="h-full w-full" aria-hidden="true">
          <circle cx="100" cy="72" r="46" fill={stop.tone} fillOpacity=".28" />
          <circle cx="100" cy="72" r="26" fill={stop.tone} fillOpacity=".5" />
        </svg>
      </div>
      <p className="font-mono text-[.62rem] uppercase tracking-[.24em] text-fg-mute">Station</p>
      <h3 className="display mt-1 text-h3">{stop.label}</h3>
    </div>
  );
}
