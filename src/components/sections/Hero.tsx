'use client';

import Link from 'next/link';
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef, useState } from 'react';
import { Magnetic } from '@/components/ui/Magnetic';
import { SplitChars, SplitLines } from '@/components/ui/SplitText';
import { CafeCanvas } from '@/components/scene/CafeCanvas';

/* =====================================================================
   CINEMATIC HERO — funktioniert wie ein kurzer Film, nicht wie ein Banner.

   Phase 1  fast schwarzer Hintergrund, leichter Lichtschein
   Phase 2  Café-Szene wird sichtbar (Canvas)
   Phase 3  Logo/Signet kommt herein
   Phase 4  Headline "ROSE CAFÉ" → "Bremen. Dein Moment."
   Phase 5  CTA erscheint
   Phase 6  Scroll steuert Kamera, Licht, Text-Austritt, Navigation

   Die Bühne zieht sich am Ende der Story-Strecke zurück (scale 1→.88,
   radius 0→32px) und übergibt an die helle Content-Section — der
   wiederkehrende "Bühnen-Rückzug".
   ===================================================================== */

export function Hero() {
  const track = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [camProgress, setCamProgress] = useState(0.02);

  const { scrollYProgress } = useScroll({ target: track, offset: ['start start', 'end end'] });

  /* Kamera 0→1 über die gesamte Hero+Story-Fahrt (0–70% der Strecke),
     danach beginnt der Bühnen-Rückzug (70–100%). */
  const camRaw = useTransform(scrollYProgress, [0, 0.7], [0, 1]);
  useMotionValueEvent(camRaw, 'change', (v) => setCamProgress(v));

  const stageScale = useTransform(scrollYProgress, [0.7, 1], [1, 0.88]);
  const stageRadius = useTransform(scrollYProgress, [0.7, 1], [0, 40]);
  const heroTextOpacity = useTransform(scrollYProgress, [0, 0.18], [1, 0]);
  const heroTextY = useTransform(scrollYProgress, [0, 0.22], [0, -70]);
  const navSolidAt = useTransform(scrollYProgress, [0, 0.06], [0, 1]);
  void navSolidAt;

  return (
    <section id="top" aria-label="Rose Café Bremen — Intro" className="relative bg-night">
      <div ref={track} className="story__track" style={{ height: reduced ? '100svh' : '260vh' }}>
        <motion.div
          className="story__stage stage-retreat"
          style={reduced ? undefined : { scale: stageScale, borderRadius: stageRadius }}
        >
          <CafeCanvas
            progress={reduced ? 0.05 : camProgress}
            variant="hero"
            announceReady
            className="absolute inset-0"
          />
          <div className="grain-layer" />
          <div className="pointer-events-none absolute inset-0 vignette-night" />

          {/* Phase 1–5: Wortmarke, Headline, CTA */}
          <motion.div
            className="pointer-events-none absolute inset-0 flex flex-col justify-end pb-[clamp(3rem,8vh,6.5rem)]"
            style={{ paddingInline: 'var(--pad)', opacity: reduced ? 1 : heroTextOpacity, y: reduced ? 0 : heroTextY }}
          >
            <div className="mx-auto w-full max-w-shell">
              <motion.p
                className="eyebrow eyebrow-night mb-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                Café · Bremen-Schwachhausen
              </motion.p>

              <h1 className="display text-h1 text-bone">
                <span className="block">
                  <SplitChars text="ROSE" delay={650} stagger={55} />
                </span>
                <span className="block text-rose-pale">
                  <SplitChars text="CAFÉ" delay={950} stagger={55} />
                </span>
              </h1>

              <div className="mt-6 max-w-[34ch] text-lead text-bone/75">
                <SplitLines lines={['Bremen.', 'Dein Moment.']} delay={1500} stagger={140} />
              </div>

              <motion.div
                className="pointer-events-auto mt-9 flex flex-wrap gap-[.85rem]"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.9, ease: [0.16, 1, 0.3, 1] }}
              >
                <Magnetic strength={0.3}>
                  <Link href="#visit" className="btn" data-cursor="cta" data-cursor-label="RESERVE">
                    Tisch reservieren <span aria-hidden="true" className="arw">→</span>
                  </Link>
                </Magnetic>
                <Magnetic strength={0.24}>
                  <Link href="#food" className="btn btn-ghost btn-night" data-cursor="special" data-cursor-label="EXPLORE">
                    Speisekarte entdecken
                  </Link>
                </Magnetic>
              </motion.div>
            </div>
          </motion.div>

          {!reduced && (
            <div
              className="pointer-events-none absolute bottom-6 left-1/2 z-[2] flex -translate-x-1/2 items-center gap-3 font-mono text-[.6rem] uppercase tracking-[.24em] text-bone/40"
              aria-hidden="true"
            >
              <span className="block h-[38px] w-px animate-scroll-hint bg-[linear-gradient(rgba(233,201,201,.7),transparent)]" />
              Scrollen
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
