'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { FLOW_STEPS } from '@/lib/content';
import { Reveal } from '@/components/ui/Reveal';
import { Slug } from '@/components/ui/Slug';

/**
 * Ablauf als Route: eine Linie füllt sich mit dem Scrollfortschritt,
 * die jeweils aktive Station wird hervorgehoben.
 */
export function FlowTimeline({ withHeading = true }: { withHeading?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: wrap,
    offset: ['start 65%', 'end 60%'],
  });
  const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section className="section" id="ablauf" aria-labelledby="flow-h">
      <div className="shell">
        {withHeading ? (
          <>
            <Slug left="Ablauf" right="05 Stationen" />
            <div className="mb-[clamp(2.5rem,6vw,4.5rem)] grid max-w-4xl gap-[1.1rem]">
              <p className="eyebrow">So funktioniert es</p>
              <Reveal>
                <h2 id="flow-h" className="display text-h2">
                  Vom Anruf bis zur
                  <br />
                  Auszahlung.
                </h2>
              </Reveal>
              <Reveal delay={0.08}>
                <p className="lead">
                  Sie müssen nichts vorbereiten und keine Formulare ausfüllen. Wir übernehmen den technischen
                  Teil – Sie behalten die Entscheidung.
                </p>
              </Reveal>
            </div>
          </>
        ) : (
          <h2 id="flow-h" className="sr-only">
            Ablauf der Schadenabwicklung
          </h2>
        )}

        <div ref={wrap} className="relative">
          <div className="absolute bottom-0 left-[19px] top-0 w-px bg-line lg:left-1/2" aria-hidden="true">
            <motion.i
              className="absolute inset-0 block origin-top bg-[linear-gradient(180deg,#6ba8ff,#5ac8e8)]"
              style={{ scaleY: reduced ? 1 : scaleY }}
            />
          </div>

          <div className="grid gap-[clamp(2.5rem,7vh,5rem)]">
            {FLOW_STEPS.map((step, i) => (
              <Step key={step.num} step={step} flip={i % 2 === 1} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Step({ step, flip }: { step: (typeof FLOW_STEPS)[number]; flip: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 40%'] });
  const opacity = useTransform(scrollYProgress, [0, 0.2, 1], [0.55, 1, 1]);

  return (
    <motion.article
      ref={ref}
      className="relative pl-[3.6rem] lg:grid lg:grid-cols-2 lg:items-center lg:gap-16 lg:pl-0"
      style={{ opacity }}
    >
      <span className="absolute left-0 top-[.2rem] z-[2] grid h-10 w-10 place-items-center rounded-full bg-ink-900 font-mono text-[.72rem] text-fg-mute lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2"
        style={{ boxShadow: 'inset 0 0 0 1px #232b33' }}
      >
        {step.num}
      </span>

      <div className={`grid gap-[.6rem] ${flip ? 'lg:col-start-2' : ''}`}>
        <h3 className="font-display text-[clamp(1.3rem,3vw,2rem)] font-semibold tracking-[-.02em]">{step.title}</h3>
        <p className="max-w-[44ch] text-[.98rem] text-fg-dim">{step.text}</p>
      </div>

      <div
        className={`hidden font-mono text-[.7rem] uppercase tracking-[.18em] text-fg-mute lg:block ${
          flip ? 'lg:col-start-1 lg:row-start-1 lg:text-right' : ''
        }`}
      >
        <b className="mb-[.2rem] block font-display text-[1.6rem] tracking-[-.02em] text-measure">{step.when}</b>
        {step.duration}
      </div>
    </motion.article>
  );
}
