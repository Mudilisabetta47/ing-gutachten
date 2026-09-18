'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { SplitLines } from '@/components/ui/SplitText';

const LINES = ['Ein Ort', 'für gute', 'Momente.'];

/**
 * Sticky Storytelling — die Bühne bleibt gepinnt (320vh Fahrtstrecke),
 * während Zeilen nacheinander erscheinen und drei Ebenen mit
 * unterschiedlicher Geschwindigkeit parallaxen (translate3d als Funktion
 * des Sektionsfortschritts, keine zeitabhängige Kette).
 */
export function BrandStory() {
  const track = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: track, offset: ['start start', 'end end'] });

  const lineOpacity0 = useTransform(scrollYProgress, [0.08, 0.2, 0.42, 0.54], [0, 1, 1, 0.18]);
  const lineOpacity1 = useTransform(scrollYProgress, [0.24, 0.36, 0.58, 0.7], [0, 1, 1, 0.18]);
  const lineOpacity2 = useTransform(scrollYProgress, [0.4, 0.52, 0.86, 0.96], [0, 1, 1, 1]);
  const lineOpacity = [lineOpacity0, lineOpacity1, lineOpacity2];

  const decorSlowY = useTransform(scrollYProgress, [0, 1], ['-6%', '10%']);
  const decorFastY = useTransform(scrollYProgress, [0, 1], ['4%', '-16%']);
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '14%']);

  return (
    <section aria-labelledby="story-h" className="relative bg-cream">
      <div ref={track} className="story__track" style={{ height: reduced ? 'auto' : '320vh' }}>
        <div className={`story__stage overflow-hidden ${reduced ? 'relative h-auto py-[var(--section-y)]' : ''}`}>
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              y: reduced ? 0 : bgY,
              background: 'radial-gradient(120% 90% at 50% 0%, rgba(184,99,111,.10), transparent 60%)',
            }}
          />

          {/* Parallax-Deko: zwei Ebenen, zwei Geschwindigkeiten */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -left-[8%] top-[12%] h-[46vmin] w-[46vmin] rounded-full opacity-[.5] blur-[2px]"
            style={{ y: reduced ? 0 : decorSlowY, background: 'radial-gradient(circle at 40% 35%, rgba(184,99,111,.30), transparent 70%)' }}
          />
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -right-[6%] bottom-[10%] h-[30vmin] w-[30vmin] rounded-full opacity-[.4]"
            style={{ y: reduced ? 0 : decorFastY, background: 'radial-gradient(circle at 60% 40%, rgba(201,164,99,.32), transparent 70%)' }}
          />

          <div className="shell flex h-full flex-col justify-center py-[var(--section-y)]">
            <p className="eyebrow mb-8">Unsere Geschichte</p>
            <h2 id="story-h" className="display text-h1" style={{ maxWidth: '14ch' }}>
              {reduced ? (
                LINES.map((l) => <span key={l} className="block">{l}</span>)
              ) : (
                LINES.map((l, i) => (
                  <motion.span key={l} className="block" style={{ opacity: lineOpacity[i] }}>
                    {l}
                  </motion.span>
                ))
              )}
            </h2>

            <div className="mt-10 grid max-w-[52ch] gap-5 text-lead">
              <SplitLines
                lines={[
                  'Rose Café ist ein Zuhause auf Zeit — für den ersten Kaffee am Morgen,',
                  'den langsamen Brunch am Wochenende und den Kuchen am Nachmittag.',
                ]}
                delay={200}
                stagger={90}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
