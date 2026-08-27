'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { DAMAGE_ZONES } from '@/lib/content';
import { Reveal } from '@/components/ui/Reveal';
import { Slug } from '@/components/ui/Slug';
import { Arrow } from '@/components/ui/Icon';

export function DamageConfigurator() {
  const [active, setActive] = useState(DAMAGE_ZONES[0]);

  return (
    <section className="section border-y border-line bg-ink-850" id="schadenfall" aria-labelledby="dmg-h">
      <div className="shell">
        <Slug left="Schadenfall" right="Interaktive Prüfzonen" />

        <div className="mb-[clamp(2.5rem,6vw,4.5rem)] grid max-w-4xl gap-[1.1rem]">
          <p className="eyebrow">Was wir uns ansehen</p>
          <Reveal>
            <h2 id="dmg-h" className="display text-h2">
              Sechs Zonen.
              <br />
              Ein vollständiges Bild.
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="lead">
              Wählen Sie einen Bereich – wir zeigen, was bei diesem Schadentyp geprüft wird und welche Positionen
              im Gutachten landen. Genau diese Systematik nutzen wir auch bei der Besichtigung vor Ort.
            </p>
          </Reveal>
        </div>

        <div className="grid items-center gap-6 lg:grid-cols-[1.25fr_.75fr] lg:gap-[clamp(2rem,4vw,4rem)]">
          <div className="stage-radial overflow-hidden rounded-[22px] p-[clamp(1rem,3vw,2.2rem)]">
            <div className="relative mx-auto w-full max-w-[420px]">
              <CarTopView />
              {DAMAGE_ZONES.map((zone) => {
                const on = zone.key === active.key;
                return (
                  <button
                    key={zone.key}
                    type="button"
                    onClick={() => setActive(zone)}
                    onMouseEnter={() => setActive(zone)}
                    aria-pressed={on}
                    aria-label={`Schadenzone ${zone.title} anzeigen`}
                    className="group absolute -translate-x-1/2 -translate-y-1/2 border-0 bg-transparent p-0"
                    style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
                  >
                    <span
                      className={`relative grid h-[34px] w-[34px] place-items-center rounded-full transition-all duration-500 ease-out ${
                        on ? 'scale-110 bg-signal' : 'bg-signal-soft group-hover:scale-110 group-hover:bg-signal'
                      }`}
                      style={{ boxShadow: on ? 'none' : 'inset 0 0 0 1px rgba(107,168,255,.38)' }}
                    >
                      {!on && (
                        <span className="absolute inset-0 animate-ping-slow rounded-full border border-signal-bright" />
                      )}
                      <i className={`block h-[7px] w-[7px] rounded-full ${on ? 'bg-ink-900' : 'bg-signal group-hover:bg-ink-900'}`} />
                    </span>
                    <span
                      className={`absolute left-[44px] top-1/2 hidden -translate-y-1/2 whitespace-nowrap font-mono text-[.62rem] uppercase tracking-[.16em] transition-opacity lg:block ${
                        on ? 'text-fg opacity-100' : 'text-fg-dim opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {zone.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="panel min-h-[270px]" role="region" aria-live="polite" aria-label="Details zur gewählten Schadenzone">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active.key}
                  initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="grid content-start gap-[.9rem]"
                >
                  <span className="font-mono text-[.68rem] tracking-[.2em] text-signal-bright">{active.index}</span>
                  <h3 className="font-display text-2xl font-semibold tracking-[-.02em]">{active.title}</h3>
                  <p className="text-fg-mute">{active.text}</p>
                  <ul className="mt-[.3rem] grid gap-2">
                    {active.points.map((p) => (
                      <li key={p} className="flex gap-3 text-[.92rem] text-fg-dim">
                        <span className="mt-[.55em] h-[6px] w-[6px] flex-none rounded-full bg-measure" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <Link href="/unfallgutachten" className="tlink mt-[.4rem] text-signal-bright">
                    Unfallgutachten anfordern <Arrow />
                  </Link>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-6 flex flex-wrap gap-[.4rem]" aria-label="Schadenzonen">
              {DAMAGE_ZONES.map((zone) => {
                const on = zone.key === active.key;
                return (
                  <button
                    key={zone.key}
                    type="button"
                    onClick={() => setActive(zone)}
                    aria-pressed={on}
                    className={`cursor-pointer rounded-full border-0 px-4 py-2 font-mono text-[.68rem] uppercase tracking-[.12em] transition-colors ${
                      on ? 'bg-signal text-white' : 'bg-transparent text-fg-mute hover:text-fg'
                    }`}
                    style={{ boxShadow: on ? 'none' : 'inset 0 0 0 1px #232b33' }}
                  >
                    {zone.title}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Technische Draufsicht statt Stockfoto – passt zur Messtechnik-Positionierung. */
function CarTopView() {
  return (
    <svg viewBox="0 0 400 720" fill="none" aria-hidden="true" className="w-full">
      <defs>
        <linearGradient id="topBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#232b34" />
          <stop offset="1" stopColor="#0e1217" />
        </linearGradient>
      </defs>
      <g stroke="#5ac8e8" strokeOpacity=".14" strokeWidth="1">
        <path d="M200 6v708M20 360h360" />
        <circle cx="200" cy="360" r="230" strokeDasharray="3 9" />
      </g>
      <rect x="26" y="168" width="30" height="86" rx="10" fill="#0a0d11" stroke="#39434e" />
      <rect x="344" y="168" width="30" height="86" rx="10" fill="#0a0d11" stroke="#39434e" />
      <rect x="26" y="470" width="30" height="86" rx="10" fill="#0a0d11" stroke="#39434e" />
      <rect x="344" y="470" width="30" height="86" rx="10" fill="#0a0d11" stroke="#39434e" />
      <path
        d="M200 26c-72 0-118 34-128 108l-10 152c-6 84-6 176 0 258l8 92c4 34 44 48 130 48s126-14 130-48l8-92c6-82 6-174 0-258l-10-152C318 60 272 26 200 26Z"
        fill="url(#topBody)"
        stroke="#4a5663"
        strokeWidth="1.6"
      />
      <path d="M200 150c-46 0-74 16-84 44l-8 24h184l-8-24c-10-28-38-44-84-44Z" fill="#0b1016" stroke="#5ac8e8" strokeOpacity=".35" />
      <rect x="106" y="228" width="188" height="230" rx="26" fill="#0c1116" stroke="#3a4550" />
      <path d="M108 486h184l10 30c-30 12-64 16-102 16s-72-4-102-16Z" fill="#0b1016" stroke="#5ac8e8" strokeOpacity=".35" />
      <g stroke="#ffffff" strokeOpacity=".1">
        <path d="M70 300h34M296 300h34M70 470h34M296 470h34" />
        <path d="M104 232v224M296 232v224" />
      </g>
      <rect x="150" y="40" width="100" height="10" rx="5" fill="#6ba8ff" fillOpacity=".55" />
      <rect x="150" y="678" width="100" height="10" rx="5" fill="#ff6a5e" fillOpacity=".35" />
      <g fill="#5ac8e8" fillOpacity=".5" fontFamily="monospace" fontSize="11" letterSpacing="1.5">
        <text x="200" y="16" textAnchor="middle">FRONT</text>
        <text x="200" y="712" textAnchor="middle">HECK</text>
      </g>
    </svg>
  );
}
