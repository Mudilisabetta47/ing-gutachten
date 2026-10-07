import Link from 'next/link';
import { HOME_SERVICES } from '@/lib/content';
import { Reveal } from '@/components/ui/Reveal';
import { SplitWords } from '@/components/ui/Split';
import { Arrow } from '@/components/ui/Icon';

/** Technische Strichzeichnungen je Leistung – zeichnen sich beim Hover. */
const GLYPHS: Record<string, string[]> = {
  '01': ['M10 60 H46 L58 36 H86 L96 60 H110', 'M52 36 L64 18 L92 18 L100 36', 'M70 60 l8 -14 l8 14 l8 -14'],
  '02': ['M14 14 H78 V74 H14 Z', 'M26 30 H66 M26 44 H66 M26 58 H48', 'M84 40 L104 40 M94 30 L94 50'],
  '03': ['M8 62 H20 C22 46 38 46 40 62 H80 C82 46 98 46 100 62 H112', 'M20 46 L34 28 H80 L96 46', 'M57 28 V46'],
  '04': ['M10 70 L34 40 L56 54 L82 20 L108 34', 'M10 78 H110', 'M34 40 V78 M82 20 V78'],
  '05': ['M12 50 H40 L48 36 H70 L78 50 H108', 'M16 70 H104', 'M30 24 H58 M80 24 H100'],
};

export function Leistungen() {
  return (
    <section className="theme-light section relative" id="leistungen" aria-labelledby="svc-h">
      <div className="shell">
        <div className="mb-[clamp(2.5rem,6vw,5rem)] flex flex-wrap items-end justify-between gap-6">
          <div className="grid gap-4">
            <p className="eyebrow">Leistungen</p>
            <h2 id="svc-h" className="display text-h2">
              <SplitWords text="Was wir begutachten." />
            </h2>
          </div>
          <Reveal variant="fade">
            <Link href="/leistungen" className="tlink text-signal-bright" data-cursor="link" data-cursor-label="MEHR">
              Alle Leistungen <Arrow />
            </Link>
          </Reveal>
        </div>

        <ul className="border-t border-line">
          {HOME_SERVICES.map((s, i) => (
            <li key={s.num} className="group relative border-b border-line">
              <Reveal variant="clip" delay={i * 0.05}>
                <div className="grid items-center gap-x-8 gap-y-3 py-[clamp(1.4rem,3.2vw,2.6rem)] sm:grid-cols-[4.5rem_1fr_auto] lg:grid-cols-[5.5rem_minmax(0,2.4fr)_minmax(0,1fr)_auto]">
                  <span className="mono-label text-signal-bright">{s.num}</span>

                  <Link
                    href={s.href}
                    data-cursor="link"
                    data-cursor-label="GUTACHTEN"
                    className="display block [overflow-wrap:anywhere] text-[clamp(1.35rem,.5rem+5.8vw,5.2rem)] uppercase leading-[.92] tracking-[-.04em] transition-transform duration-[600ms] ease-out after:absolute after:inset-0 after:content-[''] group-hover:translate-x-3 group-focus-within:translate-x-3"
                  >
                    {s.title}
                  </Link>

                  <p className="max-w-[26ch] text-fg-dim sm:col-start-2 lg:col-start-3">{s.line}</p>

                  <span className="relative hidden h-[84px] w-[120px] sm:block lg:justify-self-end" aria-hidden="true">
                    <svg viewBox="0 0 120 90" fill="none" className="absolute inset-0 h-full w-full text-signal-bright">
                      {GLYPHS[s.num].map((d, k) => (
                        <path
                          key={k}
                          d={d}
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          pathLength={1}
                          strokeDasharray="1"
                          className="opacity-30 transition-[stroke-dashoffset,opacity] duration-[900ms] ease-out [stroke-dashoffset:0] group-hover:opacity-100 group-hover:[animation:glyphDraw_1.1s_var(--ease)_both]"
                          style={{ animationDelay: `${k * 0.12}s` }}
                        />
                      ))}
                    </svg>
                  </span>
                </div>
              </Reveal>

              {s.sub && (
                <ul className="relative z-[2] -mt-2 mb-[clamp(1.2rem,2.4vw,2rem)] flex flex-wrap gap-2 sm:pl-[calc(4.5rem+2rem)] lg:pl-[calc(5.5rem+2rem)]">
                  {s.sub.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="inline-block rounded-full px-[.9rem] py-[.42rem] text-[.82rem] text-fg-dim transition-colors hover:bg-signal hover:text-white"
                        style={{ boxShadow: 'inset 0 0 0 1px rgb(var(--c-line))' }}
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
