'use client';

import Link from 'next/link';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { REGIONS, type Region } from '@/lib/content';
import { Reveal } from '@/components/ui/Reveal';
import { Slug } from '@/components/ui/Slug';

export function ServiceMap() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const [active, setActive] = useState<Region | null>(null);

  return (
    <section className="section" id="einsatzgebiet" aria-labelledby="map-h">
      <div className="shell">
        <Slug left="Vor-Ort-Service" right="Hannover + Region" />

        <div ref={ref} className="grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:gap-[clamp(2rem,4vw,4rem)]">
          <Reveal direction="scale" className="map-radial relative aspect-[4/3] overflow-hidden rounded-[22px]">
            <svg viewBox="0 0 100 75" aria-hidden="true" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <g stroke="#5ac8e8" strokeOpacity=".1" strokeWidth=".2">
                <path d="M0 18h100M0 37h100M0 56h100M20 0v75M40 0v75M60 0v75M80 0v75" />
              </g>
              <path
                d="M8 40 L26 30 L44 34 L52 22 L66 26 L78 40 L70 56 L52 66 L34 60 L16 54 Z"
                fill="rgba(107,168,255,.05)"
                stroke="rgba(107,168,255,.35)"
                strokeWidth=".35"
              />
              <path d="M14 8 C34 26 48 34 92 58" stroke="rgba(255,255,255,.09)" strokeWidth=".5" fill="none" />
              <path d="M4 62 C30 52 56 44 96 12" stroke="rgba(255,255,255,.09)" strokeWidth=".5" fill="none" />
              <circle cx="50" cy="47" r="1.2" fill="#6ba8ff" />
            </svg>

            {REGIONS.map((r, i) => {
              const on = active?.name === r.name;
              return (
                <motion.div
                  key={r.name}
                  className="absolute -translate-x-1/2 -translate-y-full"
                  style={{ left: `${r.x}%`, top: `${r.y}%` }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                >
                  <button
                    type="button"
                    onClick={() => setActive(r)}
                    className={`group grid cursor-pointer justify-items-center gap-1 border-0 bg-transparent p-0 font-mono text-[.58rem] uppercase tracking-[.1em] transition-colors ${
                      on ? 'text-fg' : 'text-fg-mute hover:text-fg'
                    }`}
                  >
                    <i
                      className={`block h-[9px] w-[9px] rounded-full transition-all duration-300 ease-out ${
                        on ? 'scale-125 bg-signal' : 'bg-measure group-hover:scale-125 group-hover:bg-signal'
                      }`}
                      style={{ boxShadow: on ? '0 0 0 7px rgba(107,168,255,.16)' : '0 0 0 4px rgba(90,200,232,.14)' }}
                      aria-hidden="true"
                    />
                    {r.name}
                  </button>
                </motion.div>
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
                Vom Büro in der Hildesheimer Straße erreichen wir Hannover und das Umland in kurzer Zeit.
                Tippen Sie auf einen Punkt für Details zum jeweiligen Gebiet.
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
                    {active ? active.name : 'Hannover und Umgebung'}
                  </h3>
                  <p className="text-fg-mute">
                    {active
                      ? active.note
                      : 'Zwölf Schwerpunktgebiete, ein Prinzip: Besichtigung dort, wo das Fahrzeug steht.'}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex flex-wrap gap-[.4rem]">
              {REGIONS.map((r) =>
                r.slug ? (
                  <Link
                    key={r.name}
                    href={`/kfz-gutachter/${r.slug}`}
                    className="rounded-full px-[.85rem] py-[.45rem] text-[.82rem] text-fg-dim transition-all hover:bg-signal hover:text-white"
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
    </section>
  );
}
