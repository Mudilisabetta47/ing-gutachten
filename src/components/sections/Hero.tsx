'use client';

import Link from 'next/link';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { BIZ } from '@/lib/content';
import { SplitLines } from '@/components/ui/SplitLines';
import { Magnetic } from '@/components/ui/Magnetic';
import { Arrow } from '@/components/ui/Icon';

const META = [
  { dt: 'Erfahrung', dd: 'über 15 Jahre' },
  { dt: 'Termin', dd: 'meist in 24–48 Stunden' },
  { dt: 'Vor Ort', dd: 'Hannover & Umgebung' },
];

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });

  /* Drei Ebenen, drei Geschwindigkeiten – der Tiefeneindruck entsteht
     aus der Differenz, nicht aus der Menge an Bewegung. */
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '22%']);
  const carY = useTransform(scrollYProgress, [0, 1], ['0%', '-6%']);
  const carScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  const contentY = useTransform(scrollYProgress, [0, 0.85], [0, 60]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.05]);
  const contentBlur = useTransform(scrollYProgress, [0, 0.85], ['blur(0px)', 'blur(7px)']);

  return (
    <section
      ref={ref}
      id="top"
      className="relative isolate flex min-h-screen items-center overflow-hidden pb-[clamp(2rem,6vh,4.5rem)] lg:items-end"
      style={{ minHeight: '100svh', paddingTop: '7.5rem' }}
    >
      <motion.div
        aria-hidden="true"
        className="hero-bg absolute inset-x-0 -top-[8%] bottom-0 -z-20"
        style={{ y: reduced ? 0 : bgY }}
      />
      <div className="hero-sweep pointer-events-none absolute inset-0 -z-10 animate-sweep" aria-hidden="true" />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[16%] top-[13%] -z-10 w-[152%] opacity-[.42] lg:bottom-[12%] lg:right-[-3%] lg:top-auto lg:w-[min(78%,980px)] lg:opacity-100"
      >
        <motion.img
          src="/assets/img/car-hero.svg"
          alt=""
          width={1240}
          height={620}
          fetchPriority="high"
          style={{ y: reduced ? 0 : carY, scale: reduced ? 1 : carScale }}
          initial={reduced ? false : { opacity: 0, x: '9%' }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1.9, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <motion.div
        className="shell relative z-[2] w-full"
        style={{ y: reduced ? 0 : contentY, opacity: reduced ? 1 : contentOpacity, filter: reduced ? 'none' : contentBlur }}
      >
        <div className="grid gap-9 lg:grid-cols-[1.35fr_.65fr] lg:items-end lg:gap-12">
          <div>
            <motion.p
              className="eyebrow mb-6"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              Kfz-Sachverständigenbüro · Hannover
            </motion.p>

            <h1 className="display mb-6 text-h1">
              <SplitLines
                lines={[
                  'Ihr Schaden.',
                  <span
                    key="accent"
                    className="inline-block bg-[linear-gradient(96deg,#6ba8ff,#dbeaff_50%,#4b93f5)] bg-clip-text text-transparent"
                  >
                    Unsere Expertise.
                  </span>,
                ]}
              />
            </h1>

            <motion.p
              className="lead"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              Unabhängige Kfz-Gutachten in Hannover – schnell, präzise und auf Ihrer Seite. Wir dokumentieren
              beweissicher, beziffern jede Schadenposition und begleiten Sie bis zur Regulierung.
            </motion.p>

            <motion.div
              className="mt-9 flex flex-wrap gap-[.85rem]"
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.48, ease: [0.16, 1, 0.3, 1] }}
            >
              <Magnetic strength={0.28}>
                <Link href="#anfrage" className="btn">
                  Jetzt Gutachten anfordern <Arrow />
                </Link>
              </Magnetic>
              <Magnetic strength={0.22}>
                <a href={`tel:${BIZ.phoneLink}`} className="btn btn-ghost">
                  Termin vereinbaren
                </a>
              </Magnetic>
            </motion.div>
          </div>

          <motion.dl
            className="grid grid-cols-2 gap-x-6 gap-y-4 border-l border-line pl-6 sm:grid-cols-1"
            initial={false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            {META.map((m) => (
              <div key={m.dt}>
                <dt className="font-mono text-[.65rem] uppercase tracking-[.2em] text-fg-mute">{m.dt}</dt>
                <dd className="mt-[.15rem] font-display text-[1.02rem] font-semibold">{m.dd}</dd>
              </div>
            ))}
            <div>
              <dt className="font-mono text-[.65rem] uppercase tracking-[.2em] text-fg-mute">Direkt</dt>
              <dd className="mt-[.15rem] font-display text-[1.02rem] font-semibold">
                <a href={`tel:${BIZ.phoneLink}`} className="transition-colors hover:text-signal-bright">
                  {BIZ.phoneDisplay}
                </a>
              </dd>
            </div>
          </motion.dl>
        </div>
      </motion.div>

      <div
        className="absolute bottom-5 z-[3] hidden items-center gap-3 font-mono text-[.62rem] uppercase tracking-[.22em] text-fg-mute lg:flex"
        style={{ left: 'var(--pad)' }}
        aria-hidden="true"
      >
        <span className="block h-[42px] w-px animate-scroll-hint bg-[linear-gradient(#6ba8ff,transparent)]" />
        <span>Scrollen</span>
      </div>
    </section>
  );
}
