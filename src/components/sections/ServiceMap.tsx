'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BIZ, REGIONS, type Region } from '@/lib/content';
import { Reveal } from '@/components/ui/Reveal';
import { SplitWords } from '@/components/ui/Split';
import { Arrow } from '@/components/ui/Icon';

/** Hannover / Vor-Ort-Service: Karte + eine kurze Aussage + Adresse. */
export function ServiceMap({ headingId = 'map-h', title = 'Hannover. Vor Ort.' }: { headingId?: string; title?: string }) {
  const [active, setActive] = useState<Region | null>(null);

  return (
    <section className="theme-light section relative" id="einsatzgebiet" aria-labelledby={headingId}>
      <div className="shell grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:gap-[clamp(2rem,5vw,6rem)]">
        <Reveal variant="scale" className="theme-dark map-radial relative aspect-[4/3] overflow-hidden rounded-[26px]">
          <svg viewBox="0 0 100 75" aria-hidden="true" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            <g stroke="#5ac8e8" strokeOpacity=".1" strokeWidth=".2">
              <path d="M0 18h100M0 37h100M0 56h100M20 0v75M40 0v75M60 0v75M80 0v75" />
            </g>
            <path d="M8 40 L26 30 L44 34 L52 22 L66 26 L78 40 L70 56 L52 66 L34 60 L16 54 Z" fill="rgba(107,168,255,.05)" stroke="rgba(107,168,255,.35)" strokeWidth=".35" />
            <path d="M14 8 C34 26 48 34 92 58" stroke="rgba(255,255,255,.09)" strokeWidth=".5" fill="none" />
            <path d="M4 62 C30 52 56 44 96 12" stroke="rgba(255,255,255,.09)" strokeWidth=".5" fill="none" />
            <circle cx="50" cy="47" r="1.2" fill="#6ba8ff" />
          </svg>

          {REGIONS.map((r) => {
            const on = active?.name === r.name;
            return (
              <div key={r.name} className="absolute -translate-x-1/2 -translate-y-full" style={{ left: `${r.x}%`, top: `${r.y}%` }}>
                <button
                  type="button"
                  onClick={() => setActive(r)}
                  onMouseEnter={() => setActive(r)}
                  aria-pressed={on}
                  className={`group grid cursor-pointer justify-items-center gap-1 border-0 bg-transparent p-1 font-mono text-[.56rem] uppercase tracking-[.1em] transition-colors sm:text-[.6rem] ${
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
                  <span className="hidden sm:inline">{r.name}</span>
                  <span className="sr-only sm:hidden">{r.name}</span>
                </button>
              </div>
            );
          })}
        </Reveal>

        <div className="grid gap-6">
          <p className="eyebrow">Einsatzgebiet</p>
          <h2 id={headingId} className="display text-h2">
            <SplitWords text={title} />
          </h2>
          <Reveal delay={0.1}>
            <p className="lead">Wir kommen zum Fahrzeug – nach Hause, in die Werkstatt oder zum Unfallort.</p>
          </Reveal>

          <p className="min-h-[3.2rem] text-fg-dim" aria-live="polite">
            {active ? (
              <>
                <strong className="font-display text-fg">{active.name}</strong> – {active.note}
              </>
            ) : (
              'Punkt wählen für Details zum Gebiet.'
            )}
          </p>

          <address className="not-italic text-fg-dim">
            <span className="mono-label block text-fg-mute">Büro</span>
            {BIZ.street}, {BIZ.zip} {BIZ.city}
          </address>

          <div className="flex flex-wrap gap-[.4rem]">
            {REGIONS.filter((r) => r.slug).map((r) => (
              <Link
                key={r.name}
                href={`/kfz-gutachter/${r.slug}`}
                className="rounded-full px-[.85rem] py-[.45rem] text-[.82rem] text-fg-dim transition-colors hover:bg-signal hover:text-white"
                style={{ boxShadow: 'inset 0 0 0 1px rgb(var(--c-line))' }}
              >
                {r.name}
              </Link>
            ))}
          </div>

          <Link href="/kfz-gutachter-hannover" className="tlink w-fit text-signal-bright" data-cursor="link" data-cursor-label="MEHR">
            Kfz-Gutachter Hannover <Arrow />
          </Link>
        </div>
      </div>
    </section>
  );
}
