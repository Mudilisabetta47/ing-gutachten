'use client';

import Link from 'next/link';
import { useState } from 'react';
import { DAMAGE_ZONES } from '@/lib/content';
import { Reveal } from '@/components/ui/Reveal';
import { SplitWords } from '@/components/ui/Split';
import { Arrow } from '@/components/ui/Icon';

/**
 * Schaden-Konfigurator: Fahrzeug im Zentrum, Hotspots statt Textblöcken.
 * Hotspot → eine kurze Aussage → mögliche Gutachtenart → CTA.
 */
export function DamageConfigurator({ ctaHref = '#anfrage' }: { ctaHref?: string }) {
  const [active, setActive] = useState(DAMAGE_ZONES[0]);

  return (
    <section className="theme-dark section relative" id="schadenfall" aria-labelledby="dmg-h">
      <div className="shell">
        <div className="mb-[clamp(2rem,5vw,4rem)] grid gap-4">
          <p className="eyebrow">Schadenfall</p>
          <h2 id="dmg-h" className="display text-h2">
            <SplitWords text="Wo ist der Schaden?" />
          </h2>
          <Reveal delay={0.1}>
            <p className="lead">Stelle wählen.</p>
          </Reveal>
        </div>

        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_.9fr] lg:gap-[clamp(2rem,5vw,6rem)]">
          <Reveal variant="scale">
            <div className="stage-radial relative overflow-hidden rounded-[26px] p-[clamp(1rem,3vw,2.4rem)]">
              <div className="relative mx-auto w-full max-w-[400px]">
                <CarTopView activeKey={active.key} />
                {DAMAGE_ZONES.map((zone) => {
                  const on = zone.key === active.key;
                  return (
                    <button
                      key={zone.key}
                      type="button"
                      onClick={() => setActive(zone)}
                      onMouseEnter={() => setActive(zone)}
                      onFocus={() => setActive(zone)}
                      aria-pressed={on}
                      aria-label={`${zone.title}: ${zone.text}`}
                      data-cursor="link"
                      data-cursor-label={zone.title.toUpperCase()}
                      className="group absolute -translate-x-1/2 -translate-y-1/2 border-0 bg-transparent p-3"
                      style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
                    >
                      <span
                        className={`relative grid h-[34px] w-[34px] place-items-center rounded-full transition-all duration-500 ease-out ${
                          on ? 'scale-125 bg-signal' : 'bg-signal-soft group-hover:scale-110 group-hover:bg-signal'
                        }`}
                        style={{ boxShadow: on ? '0 0 0 8px rgba(107,168,255,.18)' : 'inset 0 0 0 1px rgba(107,168,255,.4)' }}
                      >
                        {!on && <span className="absolute inset-0 animate-ping-slow rounded-full border border-signal-bright" />}
                        <i className={`block h-[7px] w-[7px] rounded-full ${on ? 'bg-ink-900' : 'bg-signal-bright'}`} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Reveal>

          <div className="grid content-center gap-6" role="region" aria-live="polite" aria-label="Gewählte Schadenstelle">
            <div key={active.key} className="grid animate-fade-swap gap-5">
              <span className="mono-label text-signal-bright">{active.index}</span>
              <h3 className="display text-[clamp(2.4rem,1.2rem+4.4vw,5rem)] uppercase leading-[.92] tracking-[-.04em]">{active.title}</h3>
              <p className="lead">{active.text}</p>
              <ul className="flex flex-wrap gap-2">
                {active.checks.map((c) => (
                  <li
                    key={c}
                    className="mono-label rounded-full px-3 py-[.45rem] text-fg-dim"
                    style={{ boxShadow: 'inset 0 0 0 1px rgb(var(--c-line))' }}
                  >
                    {c}
                  </li>
                ))}
              </ul>
              <p className="text-fg-mute">
                Passend: <Link href={active.href} className="text-signal-bright underline underline-offset-4">{active.kind}</Link>
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link href={ctaHref} className="btn" data-cursor="link" data-cursor-label="ANFRAGEN">
                  Schaden melden <Arrow />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Technische Draufsicht – aktive Zone wird als Messfeld hervorgehoben. */
function CarTopView({ activeKey }: { activeKey: string }) {
  const zoneRect: Record<string, { x: number; y: number; w: number; h: number }> = {
    front: { x: 92, y: 22, w: 216, h: 120 },
    side: { x: 26, y: 220, w: 70, h: 270 },
    rear: { x: 92, y: 570, w: 216, h: 130 },
    paint: { x: 250, y: 330, w: 100, h: 200 },
    chassis: { x: 20, y: 470, w: 100, h: 110 },
    structure: { x: 106, y: 228, w: 188, h: 230 },
  };
  const z = zoneRect[activeKey];
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
      <path d="M200 26c-72 0-118 34-128 108l-10 152c-6 84-6 176 0 258l8 92c4 34 44 48 130 48s126-14 130-48l8-92c6-82 6-174 0-258l-10-152C318 60 272 26 200 26Z" fill="url(#topBody)" stroke="#4a5663" strokeWidth="1.6" />
      <path d="M200 150c-46 0-74 16-84 44l-8 24h184l-8-24c-10-28-38-44-84-44Z" fill="#0b1016" stroke="#5ac8e8" strokeOpacity=".35" />
      <rect x="106" y="228" width="188" height="230" rx="26" fill="#0c1116" stroke="#3a4550" />
      <path d="M108 486h184l10 30c-30 12-64 16-102 16s-72-4-102-16Z" fill="#0b1016" stroke="#5ac8e8" strokeOpacity=".35" />
      <rect x="150" y="40" width="100" height="10" rx="5" fill="#6ba8ff" fillOpacity=".55" />
      <rect x="150" y="678" width="100" height="10" rx="5" fill="#ff6a5e" fillOpacity=".35" />
      <g fill="#5ac8e8" fillOpacity=".5" fontFamily="monospace" fontSize="11" letterSpacing="1.5">
        <text x="200" y="16" textAnchor="middle">FRONT</text>
        <text x="200" y="712" textAnchor="middle">HECK</text>
      </g>
      {z && (
        <rect
          x={z.x}
          y={z.y}
          width={z.w}
          height={z.h}
          rx="14"
          fill="rgba(107,168,255,.12)"
          stroke="#6ba8ff"
          strokeWidth="1.4"
          strokeDasharray="5 5"
          style={{ transition: 'all .6s cubic-bezier(.16,1,.3,1)' }}
        />
      )}
    </svg>
  );
}
