'use client';

import Link from 'next/link';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { Magnetic } from '@/components/ui/Magnetic';
import { SplitLines } from '@/components/ui/SplitText';

/** FINAL CTA (180vh) — letzter Bühnen-Rückzug vor dem Footer. */
export function FinalCta() {
  const track = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: track, offset: ['start start', 'end end'] });

  const scale = useTransform(scrollYProgress, [0.35, 1], [1, 0.9]);
  const radius = useTransform(scrollYProgress, [0.35, 1], [0, 40]);
  const glowOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.5, 1, 0.6]);

  return (
    <section className="relative bg-night" aria-labelledby="cta-h">
      <div ref={track} className="story__track" style={{ height: reduced ? 'auto' : '180vh' }}>
        <motion.div
          className={`story__stage stage-retreat grid place-items-center text-center ${reduced ? 'relative h-auto py-[var(--section-y)]' : ''}`}
          style={reduced ? undefined : { scale, borderRadius: radius }}
        >
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ opacity: reduced ? 0.7 : glowOpacity, background: 'radial-gradient(60% 55% at 50% 40%, rgba(184,99,111,.28), transparent 70%)' }}
          />
          <div className="shell relative">
            <p className="eyebrow eyebrow-night mb-6 justify-center">Reserviere deinen Moment</p>
            <h2 id="cta-h" className="display mx-auto text-h1 text-bone" style={{ maxWidth: '16ch' }}>
              <SplitLines lines={['Bis gleich', 'im Rose Café.']} stagger={130} />
            </h2>
            <div className="mt-10 flex flex-wrap justify-center gap-[.85rem]">
              <Magnetic strength={0.32}>
                <Link href="#visit" className="btn" data-cursor="cta" data-cursor-label="RESERVE">
                  Tisch reservieren <span aria-hidden="true" className="arw">→</span>
                </Link>
              </Magnetic>
              <Magnetic strength={0.24}>
                <Link href="#food" className="btn btn-ghost btn-night" data-cursor="cta">
                  Speisekarte ansehen
                </Link>
              </Magnetic>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
