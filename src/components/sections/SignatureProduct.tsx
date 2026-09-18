'use client';

import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef, useState } from 'react';
import { SIGNATURE } from '@/lib/content';
import { CafeCanvas } from '@/components/scene/CafeCanvas';
import { SplitChars } from '@/components/ui/SplitText';

/**
 * SIGNATURE PRODUCT HERO — ein einziger Hauptdarsteller.
 * Beim Scrollen kommt das Produkt näher, der Hintergrund hellt auf,
 * Text und Preis verschieben sich. Am Ende zieht sich das Produkt
 * wieder zurück.
 */
export function SignatureProduct() {
  const track = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0.05);

  const { scrollYProgress } = useScroll({ target: track, offset: ['start start', 'end end'] });
  useMotionValueEvent(scrollYProgress, 'change', setProgress);

  const bgOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.4, 1, 0.4]);
  const priceY = useTransform(scrollYProgress, [0.15, 0.55], [40, 0]);
  const priceOpacity = useTransform(scrollYProgress, [0.15, 0.4, 0.85, 1], [0, 1, 1, 0]);
  const nameOpacity = useTransform(scrollYProgress, [0, 0.2, 0.85, 1], [0, 1, 1, 0]);
  const beamX = useTransform(scrollYProgress, [0, 1], ['-6%', '6%']);

  return (
    <section id="signature" aria-labelledby="sig-h" className="relative bg-night">
      <div ref={track} className="story__track" style={{ height: reduced ? '100svh' : '300vh' }}>
        <div className="story__stage">
          <CafeCanvas progress={reduced ? 0.4 : progress} variant="signature" className="absolute inset-0" />
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              opacity: reduced ? 0.7 : bgOpacity,
              background: 'radial-gradient(60% 60% at 50% 40%, rgba(233,201,201,.16), transparent 70%)',
            }}
          />
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-1/4 -top-1/4 h-[80%]"
            style={{
              x: reduced ? 0 : beamX,
              background: 'radial-gradient(45% 55% at 50% 30%, rgba(255,224,180,.16), transparent 72%)',
            }}
          />
          <div className="grain-layer" />

          <div className="relative flex h-full flex-col items-center justify-between py-[clamp(3rem,8vh,6rem)] text-center" style={{ paddingInline: 'var(--pad)' }}>
            <motion.p className="eyebrow eyebrow-night" style={{ opacity: reduced ? 1 : nameOpacity }}>
              {SIGNATURE.eyebrow}
            </motion.p>

            <div />

            <motion.div style={{ opacity: reduced ? 1 : priceOpacity, y: reduced ? 0 : priceY }}>
              <h2 id="sig-h" className="display text-[clamp(2.6rem,9vw,6.5rem)] text-bone">
                <SplitChars text={SIGNATURE.name} stagger={40} />
              </h2>
              <p className="mx-auto mt-4 max-w-[46ch] text-lead text-bone/70">{SIGNATURE.description}</p>
              <p className="mt-6 font-mono text-[1.3rem] tracking-[.08em] text-rose-pale">{SIGNATURE.price}</p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
