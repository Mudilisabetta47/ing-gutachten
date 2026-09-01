'use client';

import Link from 'next/link';
import { motion, useInView, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef, useState } from 'react';
import { SETTLEMENT_STEPS, SETTLEMENT_VIDEO, SETTLEMENT_WEEKS, VEHICLE_CATEGORIES } from '@/lib/content';
import { Icon, Arrow } from '@/components/ui/Icon';
import { Slug } from '@/components/ui/Slug';

const EASE = [0.16, 1, 0.3, 1] as const;

/* --- 1. Regulierungsablauf als Fortschrittslinie ----------------------- */
export function SettlementFlow() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 80%', 'end 55%'] });
  const width = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <div ref={ref}>
      {/* Waagerecht ab Tablet, senkrecht auf dem Telefon – die Linie führt jeweils in Leserichtung. */}
      <div className="relative hidden md:block">
        <div className="absolute left-0 right-0 top-[22px] h-px bg-line" aria-hidden="true">
          <motion.span
            className="block h-full origin-left bg-signal-bright"
            style={{ width: reduced ? '100%' : width }}
          />
        </div>
        <ol className="relative grid grid-cols-5 gap-4">
          {SETTLEMENT_STEPS.map((s, i) => (
            <motion.li
              key={s.title}
              initial={reduced ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '0px 0px -15% 0px' }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
            >
              <span className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-ink-900 font-mono text-[.7rem] text-fg-mute"
                style={{ boxShadow: 'inset 0 0 0 1px #232b33' }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mb-1 font-display text-[1.05rem] font-semibold">{s.title}</h3>
              <p className="text-[.86rem] text-fg-mute">{s.text}</p>
            </motion.li>
          ))}
        </ol>
      </div>

      <ol className="relative grid gap-6 md:hidden">
        <div className="absolute bottom-2 left-[21px] top-2 w-px bg-line" aria-hidden="true" />
        {SETTLEMENT_STEPS.map((s, i) => (
          <motion.li
            key={s.title}
            className="relative flex gap-4"
            initial={reduced ? false : { opacity: 0, x: 12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '0px 0px -10% 0px' }}
            transition={{ duration: 0.45, delay: i * 0.06, ease: EASE }}
          >
            <span className="z-[1] grid h-11 w-11 flex-none place-items-center rounded-full bg-ink-900 font-mono text-[.7rem] text-fg-mute"
              style={{ boxShadow: 'inset 0 0 0 1px #232b33' }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <div>
              <h3 className="mb-1 font-display text-[1.05rem] font-semibold">{s.title}</h3>
              <p className="text-[.88rem] text-fg-mute">{s.text}</p>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

/* --- 2. Wochen-Timeline ------------------------------------------------ */
export function WeeksTimeline() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduced = useReducedMotion();

  return (
    <div ref={ref} className="grid gap-px overflow-hidden rounded-[22px] border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
      {SETTLEMENT_WEEKS.map((w, i) => (
        <motion.div
          key={w.week}
          className="relative bg-ink-900 p-[clamp(1.3rem,3vw,1.9rem)]"
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: i * 0.12, ease: EASE }}
        >
          <motion.span
            className="absolute inset-x-0 top-0 h-[2px] origin-left bg-signal-bright"
            initial={reduced ? false : { scaleX: 0 }}
            animate={inView ? { scaleX: 1 } : {}}
            transition={{ duration: 0.7, delay: 0.2 + i * 0.15, ease: EASE }}
          />
          <span className="font-mono text-[.62rem] uppercase tracking-[.2em] text-signal-bright">{w.week}</span>
          <p className="mt-3 text-[.9rem] text-fg-dim">{w.text}</p>
        </motion.div>
      ))}
    </div>
  );
}

/* --- 3. Videobereich ---------------------------------------------------- */
export function VideoSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  const start = () => {
    setPlaying(true);
    void video.current?.play();
  };

  return (
    <motion.div
      ref={ref}
      initial={reduced ? false : { opacity: 0, scale: 0.98 }}
      animate={inView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.8, ease: EASE }}
      className="group relative overflow-hidden rounded-[22px] border border-line"
    >
      {SETTLEMENT_VIDEO.src ? (
        <>
          <video
            ref={video}
            className="aspect-video w-full bg-ink-850 object-cover"
            poster={SETTLEMENT_VIDEO.poster}
            controls={playing}
            playsInline
            preload="none"
            onPlay={() => setPlaying(true)}
          >
            <source src={SETTLEMENT_VIDEO.src} type="video/mp4" />
            Ihr Browser kann dieses Video nicht abspielen.
          </video>

          {!playing && (
            <button
              type="button"
              onClick={start}
              className="absolute inset-0 grid place-items-center bg-ink-900/45 transition-colors duration-500 hover:bg-ink-900/30"
              aria-label={`Video abspielen: ${SETTLEMENT_VIDEO.title}`}
            >
              <span className="grid h-20 w-20 place-items-center rounded-full bg-signal text-white transition-transform duration-500 ease-out group-hover:scale-110">
                <svg width="22" height="24" viewBox="0 0 22 24" fill="currentColor" aria-hidden="true">
                  <path d="M0 0l22 12L0 24z" />
                </svg>
              </span>
            </button>
          )}
        </>
      ) : (
        /* Solange keine Videodatei hinterlegt ist: ruhiger Platzhalter
           statt kaputtem Player. Siehe SETTLEMENT_VIDEO in content.ts. */
        <div className="relative aspect-video w-full overflow-hidden bg-ink-850">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SETTLEMENT_VIDEO.poster} alt="" aria-hidden="true" className="h-full w-full object-cover opacity-45" />
          <div className="absolute inset-0 grid place-content-center justify-items-center gap-3 bg-ink-900/55 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full border border-line text-signal-bright">
              <svg width="18" height="20" viewBox="0 0 22 24" fill="currentColor" aria-hidden="true">
                <path d="M0 0l22 12L0 24z" />
              </svg>
            </span>
            <p className="font-mono text-[.62rem] uppercase tracking-[.22em] text-fg-mute">
              Videobereich vorbereitet
            </p>
          </div>
        </div>
      )}

      <figcaption className="flex items-center justify-between gap-4 border-t border-line px-5 py-3">
        <span className="font-display text-[.95rem] font-semibold">{SETTLEMENT_VIDEO.title}</span>
        <span className="font-mono text-[.6rem] uppercase tracking-[.2em] text-fg-mute">{SETTLEMENT_VIDEO.caption}</span>
      </figcaption>
    </motion.div>
  );
}

/* --- 4. Fahrzeugklassen-Selektor --------------------------------------- */
export function VehicleSelector() {
  const reduced = useReducedMotion();

  return (
    <section className="section" aria-labelledby="veh-h">
      <div className="shell">
        <Slug left="Fahrzeugklassen" right="04 Kategorien" />
        <div className="mb-[clamp(2rem,5vw,3.5rem)] grid max-w-3xl gap-4">
          <p className="eyebrow">Was begutachtet wird</p>
          <h2 id="veh-h" className="display text-[clamp(1.8rem,4vw,3rem)]">
            Jede Fahrzeugklasse
            <br />
            hat eigene Prüfpunkte.
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {VEHICLE_CATEGORIES.map((c, i) => (
            <motion.div
              key={c.key}
              initial={reduced ? false : { opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '0px 0px -12% 0px' }}
              transition={{ duration: 0.55, delay: i * 0.08, ease: EASE }}
            >
              <Link
                href={c.href}
                className="group relative flex h-full flex-col overflow-hidden rounded-[22px] border border-line p-6 transition-colors duration-500 hover:border-signal-bright/40"
                style={{ background: 'linear-gradient(180deg, rgba(255,255,255,.032), rgba(255,255,255,.006))' }}
              >
                <span
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100"
                  style={{ background: 'radial-gradient(90% 70% at 50% 0%, rgba(107,168,255,.12), transparent 65%)' }}
                  aria-hidden="true"
                />
                <span className="relative mb-5 text-signal-bright transition-transform duration-500 ease-out group-hover:-translate-y-1 group-hover:scale-110">
                  <Icon name={c.icon} size={40} />
                </span>
                <h3 className="relative mb-2 font-display text-h3 font-semibold">{c.title}</h3>
                <p className="relative text-[.9rem] text-fg-mute">{c.note}</p>

                {/* Details erscheinen erst beim Hover – auf Touch immer sichtbar. */}
                <ul className="relative mt-4 grid gap-1 opacity-100 transition-opacity duration-500 lg:opacity-0 lg:group-hover:opacity-100">
                  {c.details.map((d) => (
                    <li key={d} className="flex gap-2 text-[.82rem] text-fg-dim">
                      <span className="mt-[.55em] h-px w-2 flex-none bg-signal-bright" aria-hidden="true" />
                      {d}
                    </li>
                  ))}
                </ul>

                <span className="relative mt-5 flex items-center gap-2 font-display text-[.88rem] font-semibold text-signal-bright">
                  Ansehen <Arrow />
                </span>
                <span
                  className="absolute inset-x-6 bottom-0 h-px origin-left scale-x-0 bg-signal-bright transition-transform duration-500 ease-out group-hover:scale-x-100"
                  aria-hidden="true"
                />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
