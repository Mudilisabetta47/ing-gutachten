'use client';

import Link from 'next/link';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { AREA_CITIES, REGIONS, type AreaCity } from '@/lib/content';
import { Reveal } from '@/components/ui/Reveal';
import { Slug } from '@/components/ui/Slug';

export function ServiceMap() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const [active, setActive] = useState<AreaCity | null>(null);

  return (
    <section className="section" id="einsatzgebiet" aria-labelledby="map-h">
      <div className="shell">
        <Slug left="Vor-Ort-Service" right="Region Hannover" />

        <div ref={ref} className="grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:gap-[clamp(2rem,4vw,4rem)]">
          <Reveal direction="scale" className="map-radial relative aspect-[4/3] overflow-hidden rounded-[22px]">
            <svg viewBox="0 0 100 75" aria-hidden="true" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <g stroke="#5ac8e8" strokeOpacity=".08" strokeWidth=".2">
                <path d="M0 18h100M0 37h100M0 56h100M20 0v75M40 0v75M60 0v75M80 0v75" />
              </g>
              {/* Einsatzbereich: weiche Fläche um die vier Orte (schematisch) */}
              <path
                d="M30 9 L52 14 L78 16 L92 24 L93 36 L70 46 L56 56 L38 58 L16 61 L5 52 L6 40 L20 24 Z"
                fill="rgba(107,168,255,.055)"
                stroke="rgba(107,168,255,.32)"
                strokeWidth=".35"
                strokeLinejoin="round"
              />
              {/* Verbindungen vom Büro in Hannover zu den weiteren Orten */}
              <g stroke="rgba(107,168,255,.38)" strokeWidth=".3" strokeDasharray="1.1 1.5" fill="none">
                <path d="M34.5 20 L48.3 42.3" />
                <path d="M34.5 20 L83.8 30.1" />
                <path d="M34.5 20 L11.5 47.3" />
              </g>
              <circle cx="34.5" cy="20" r="7.5" fill="none" stroke="rgba(107,168,255,.3)" strokeWidth=".3" />
            </svg>
            <span className="pointer-events-none absolute bottom-3 left-4 font-mono text-[.55rem] uppercase tracking-[.16em] text-fg-mute">
              Schematische Darstellung
            </span>

            {AREA_CITIES.map((r, i) => {
              const on = active?.name === r.name;
              return (
                /* Äußeres Element zentriert den Punkt exakt auf (x|y); das innere animiert nur Einblenden. */
                <div key={r.name} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${r.x}%`, top: `${r.y}%` }}>
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <button
                      type="button"
                      onClick={() => setActive(r)}
                      aria-pressed={on}
                      aria-label={`${r.name} anzeigen`}
                      className="group relative grid h-4 w-4 cursor-pointer place-items-center border-0 bg-transparent p-0 before:absolute before:-inset-3 before:content-['']"
                    >
                      <i
                        className={`block rounded-full transition-all duration-300 ease-out ${r.home ? 'h-[13px] w-[13px]' : 'h-[10px] w-[10px]'} ${
                          on
                            ? 'scale-125 bg-signal'
                            : r.home
                              ? 'bg-signal-bright group-hover:scale-125 group-focus-visible:scale-125'
                              : 'bg-measure group-hover:scale-125 group-hover:bg-signal group-focus-visible:scale-125 group-focus-visible:bg-signal'
                        }`}
                        style={{ boxShadow: on ? '0 0 0 7px rgba(107,168,255,.16)' : '0 0 0 4px rgba(90,200,232,.14)' }}
                        aria-hidden="true"
                      />
                      <span
                        className={`pointer-events-none absolute top-full mt-2 whitespace-nowrap ${r.x > 75 ? 'right-[-4px]' : r.x < 16 ? 'left-[-4px]' : 'left-1/2 -translate-x-1/2'} font-mono text-[.8rem] uppercase tracking-[.1em] transition-colors ${
                          on ? 'text-fg' : 'text-fg-dim group-hover:text-fg'
                        }`}
                      >
                        {r.name}
                      </span>
                    </button>
                  </motion.div>
                </div>
              );
            })}
          </Reveal>

          <div className="grid gap-6">
            <p className="eyebrow">Einsatzgebiet</p>
            <Reveal>
              <h2 id="map-h" className="display text-[clamp(1.9rem,4vw,3.2rem)]">
                Wir kommen zum Fahrzeug –
                <br />
                nicht umgekehrt.
              </h2>
            </Reveal>
            <Reveal delay={0.06}>
              <p className="lead">
                Vom Büro in Hannover aus begutachten wir in Hannover, Hildesheim, Braunschweig und Hameln.
                Tippen Sie auf einen Ort für Details zum jeweiligen Gebiet.
              </p>
            </Reveal>

            <div className="min-h-[110px]" aria-live="polite">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active?.name ?? 'default'}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="eyebrow">Einsatzgebiet</span>
                  <h3 className="mt-2 font-display text-h3 font-semibold">
                    {active ? active.name : 'Hannover, Hildesheim, Braunschweig und Hameln'}
                  </h3>
                  <p className="text-fg-mute">
                    {active
                      ? active.note
                      : 'Vor-Ort-Besichtigungen in der Region – wir kommen dorthin, wo sich das Fahrzeug befindet.'}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="grid gap-3">
              <p className="font-mono text-[.62rem] uppercase tracking-[.18em] text-fg-mute">Einsatzbereich</p>
              <div className="flex flex-wrap gap-[.4rem]">
                {AREA_CITIES.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setActive(c)}
                    aria-pressed={active?.name === c.name}
                    className={`min-h-11 rounded-full px-[1rem] py-[.45rem] text-[.88rem] transition-colors ${
                      active?.name === c.name ? 'bg-signal text-white' : 'text-fg-dim hover:bg-signal hover:text-white focus-visible:bg-signal focus-visible:text-white'
                    }`}
                    style={{ boxShadow: active?.name === c.name ? 'none' : 'inset 0 0 0 1px #232b33' }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <p className="mt-2 font-mono text-[.62rem] uppercase tracking-[.18em] text-fg-mute">Schwerpunkte im Raum Hannover</p>
              <div className="flex flex-wrap gap-[.4rem]">
                {REGIONS.map((r) =>
                  r.slug ? (
                    <Link
                      key={r.name}
                      href={`/kfz-gutachter/${r.slug}`}
                      className="rounded-full px-[.85rem] py-[.45rem] text-[.82rem] text-fg-dim transition-all hover:bg-signal hover:text-white focus-visible:bg-signal focus-visible:text-white"
                      style={{ boxShadow: 'inset 0 0 0 1px #232b33' }}
                    >
                      {r.name}
                    </Link>
                  ) : (
                    <span
                      key={r.name}
                      className="rounded-full px-[.85rem] py-[.45rem] text-[.82rem] text-fg-dim"
                      style={{ boxShadow: 'inset 0 0 0 1px #232b33' }}
                    >
                      {r.name}
                    </span>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
