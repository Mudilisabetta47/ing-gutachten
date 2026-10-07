import Link from 'next/link';
import { BIZ } from '@/lib/content';
import { Lines } from '@/components/ui/Split';
import { Magnetic } from '@/components/ui/Magnetic';
import { Arrow } from '@/components/ui/Icon';
import { HeroStage } from './HeroStage';

/**
 * Startseiten-Hero.
 * Semantik: genau eine H1 mit der klaren Suchintention („Kfz-Gutachter &
 * Sachverständiger in Hannover") als erste, sichtbare Zeile – die große
 * visuelle Headline folgt im selben H1. Kein versteckter Text.
 */
export function Hero() {
  return (
    <HeroStage
      background={
        <>
          <div className="hero-bg absolute inset-0" />
          <div className="hero-sweep absolute inset-0 animate-sweep" />
          <div className="absolute inset-0 opacity-[.55] [background-image:linear-gradient(rgba(107,168,255,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(107,168,255,.07)_1px,transparent_1px)] [background-size:96px_96px] [mask-image:radial-gradient(80%_70%_at_70%_55%,#000,transparent_75%)]" />
        </>
      }
      visual={
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/img/car-hero.svg" alt="" width={1240} height={620} fetchPriority="high" decoding="async" className="w-full" />
          <HeroGauges />
        </div>
      }
    >
      <div className="grid gap-10 lg:grid-cols-[1.5fr_.5fr] lg:items-end">
        <div>
          <h1 className="mb-8">
            <span
              className="enter-up mono-label mb-6 flex items-center gap-3 text-signal-bright"
              style={{ ['--d' as string]: '.1s' }}
            >
              <span className="block h-px w-8 bg-signal-line" aria-hidden="true" />
              Kfz-Gutachter &amp; Sachverständiger in Hannover
            </span>
            <Lines
              enter
              className="display block text-[clamp(3rem,1rem+8.6vw,9.6rem)] uppercase leading-[.86] tracking-[-.045em]"
              lines={[
                'Wenn es',
                'darauf',
                <span key="a" className="text-signal-bright">
                  ankommt.
                </span>,
              ]}
            />
          </h1>

          <p className="enter-up lead mb-9 max-w-[34ch]" style={{ ['--d' as string]: '.75s' }}>
            Unabhängige Kfz-Gutachten in Hannover.
          </p>

          <div className="enter-up flex flex-wrap items-center gap-[.85rem]" style={{ ['--d' as string]: '.9s' }}>
            <Magnetic strength={0.28}>
              <Link href="#anfrage" className="btn" data-cursor="link" data-cursor-label="ANFRAGEN">
                Schaden melden <Arrow />
              </Link>
            </Magnetic>
            <Magnetic strength={0.22}>
              <a href={`tel:${BIZ.phoneLink}`} className="btn btn-ghost">
                {BIZ.phoneDisplay}
              </a>
            </Magnetic>
          </div>
        </div>

        <div
          className="enter-up hidden items-center gap-3 font-mono text-[.62rem] uppercase tracking-[.22em] text-fg-mute lg:flex lg:justify-self-end"
          style={{ ['--d' as string]: '1.2s' }}
          aria-hidden="true"
        >
          <span className="block h-[52px] w-px animate-scroll-hint bg-[linear-gradient(#6ba8ff,transparent)]" />
          <span>Scrollen</span>
        </div>
      </div>
    </HeroStage>
  );
}

/** Dekorative Messmarken am Fahrzeug – rein visuell, aria-hidden. */
function HeroGauges() {
  return (
    <svg viewBox="0 0 1240 620" className="pointer-events-none absolute inset-0 hidden h-full w-full xl:block" aria-hidden="true" fill="none">
      <g stroke="#6ba8ff" strokeOpacity=".55" strokeWidth="1.2" strokeDasharray="3 6">
        <path d="M980 250 L930 168" />
        <path d="M300 420 L170 500" />
      </g>
      <g fill="#6ba8ff">
        <circle cx="980" cy="250" r="4" />
        <circle cx="300" cy="420" r="4" />
      </g>
      <g fontFamily="monospace" fontSize="14" letterSpacing="2.6" fill="#bcd9ff" fillOpacity=".85">
        <text x="930" y="154" textAnchor="middle">MESSPUNKT 03</text>
        <text x="40" y="512">ACHSE · VERMESSEN</text>
      </g>
    </svg>
  );
}
