'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { SERVICES } from '@/lib/content';
import { Icon, Arrow } from '@/components/ui/Icon';
import { Reveal } from '@/components/ui/Reveal';
import { Slug } from '@/components/ui/Slug';

/**
 * Horizontale Story mit nativem Scroll-Snapping: auf Touch wischt man,
 * auf Desktop führen Pfeiltasten und Buttons. Kein Scroll-Hijacking –
 * das bleibt auf Trackpads berechenbar.
 */
export function Services() {
  const track = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0.12);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setProgress(max > 0 ? Math.max(el.scrollLeft / max, 0.12) : 1);
    setAtStart(el.scrollLeft < 8);
    setAtEnd(el.scrollLeft > max - 8);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [update]);

  const step = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector('article');
    const delta = (card ? card.clientWidth : 320) + 16;
    el.scrollBy({ left: dir * delta, behavior: 'smooth' });
  };

  return (
    <section className="section" id="leistungen" aria-labelledby="svc-h">
      <div className="shell">
        <Slug left="Leistungen" right="06 Gutachtenarten" />
        <div className="mb-[clamp(2.5rem,6vw,4.5rem)] grid max-w-4xl gap-[1.1rem]">
          <p className="eyebrow">Vom Parkrempler bis zum Oldtimer</p>
          <Reveal>
            <h2 id="svc-h" className="display text-h2">
              Für jedes Fahrzeug
              <br />
              das richtige Gutachten.
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="lead">
              Sechs Schwerpunkte, ein Anspruch: nachvollziehbare Zahlen, saubere Fotodokumentation und ein
              Ergebnis, mit dem Versicherung und Anwalt sofort arbeiten können.
            </p>
          </Reveal>
        </div>
      </div>

      <div
        ref={track}
        onScroll={update}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') step(1);
          if (e.key === 'ArrowLeft') step(-1);
        }}
        tabIndex={0}
        role="region"
        aria-label="Leistungen, horizontal scrollbar"
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto"
        style={{ paddingInline: 'var(--pad)', marginInline: 'calc(var(--pad) * -1)', scrollPaddingInline: 'var(--pad)' }}
      >
        {SERVICES.map((s) => (
          <article
            key={s.href}
            data-cursor="link"
            data-cursor-label="ÖFFNEN"
            className="svc-card group relative isolate flex min-h-[min(74vh,520px)] flex-none snap-center flex-col justify-end overflow-hidden rounded-[22px] bg-ink-700 p-6 transition-transform duration-500 ease-out hover:-translate-y-1.5 lg:p-8"
            style={{ flexBasis: 'min(82vw, 340px)', boxShadow: 'inset 0 0 0 1px #232b33' }}
          >
            <span
              className="svc-art absolute inset-0 -z-10 transition-transform duration-1000 ease-out group-hover:scale-105"
              style={{ background: s.gradient }}
            />
            <span className="absolute left-6 top-6 font-mono text-[.68rem] tracking-[.2em] text-fg-mute lg:left-8">
              {s.num} / 06
            </span>
            <span className="mb-auto pt-14 text-signal transition-transform duration-500 ease-out group-hover:-translate-y-1.5">
              <Icon name={s.icon} size={40} />
            </span>
            <h3 className="mb-2 font-display text-h3 font-semibold">{s.title}</h3>
            <p className="max-w-[34ch] text-[.92rem] text-fg-dim">{s.teaser}</p>
            <ul className="mt-4 flex flex-wrap gap-[.35rem]">
              {s.tags.map((t) => (
                <li
                  key={t}
                  className="rounded-full px-[.6rem] py-[.28rem] font-mono text-[.62rem] uppercase tracking-[.1em] text-fg-mute"
                  style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.075)' }}
                >
                  {t}
                </li>
              ))}
            </ul>
            <Link
              href={s.href}
              className="tlink mt-[1.1rem] text-signal opacity-100 transition-all duration-500 ease-out lg:translate-y-2 lg:opacity-50 lg:group-hover:translate-y-0 lg:group-hover:opacity-100"
            >
              Mehr erfahren <Arrow />
              <span className="sr-only"> zu {s.title}</span>
            </Link>
          </article>
        ))}
      </div>

      <div className="shell mt-7 flex items-center gap-[.6rem]">
        <SliderButton onClick={() => step(-1)} disabled={atStart} label="Vorherige Leistung">
          ←
        </SliderButton>
        <SliderButton onClick={() => step(1)} disabled={atEnd} label="Nächste Leistung">
          →
        </SliderButton>
        <span className="relative ml-[.6rem] h-px flex-1 overflow-hidden bg-line" aria-hidden="true">
          <i
            className="absolute inset-0 origin-left bg-signal transition-transform duration-300 ease-out"
            style={{ transform: `scaleX(${progress})` }}
          />
        </span>
        <Link href="/leistungen" className="tlink ml-4">
          Alle Leistungen <Arrow />
        </Link>
      </div>
    </section>
  );
}

function SliderButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-[46px] w-[46px] place-items-center rounded-full bg-transparent text-fg transition-all duration-300 hover:scale-105 hover:bg-white/[.07] disabled:cursor-default disabled:opacity-30 disabled:hover:scale-100"
      style={{ boxShadow: 'inset 0 0 0 1px #232b33' }}
    >
      {children}
    </button>
  );
}
