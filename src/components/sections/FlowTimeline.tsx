'use client';

import { useMotionValueEvent, useScroll } from 'framer-motion';
import { useCallback, useEffect, useRef } from 'react';
import { FLOW_STEPS } from '@/lib/content';
import { Reveal } from '@/components/ui/Reveal';
import { Slug } from '@/components/ui/Slug';

/**
 * Ablauf als Route: eine Linie füllt sich kontinuierlich mit dem Scrollfortschritt
 * (0 % leer → 100 % voll, rückwärts läuft sie zurück); jede Station wird beim
 * Erreichen hervorgehoben.
 *
 * Architektur wie CrashSequence/AblaufRail: ein `useScroll`-Fortschritt, EINE
 * Subscription, direkte Schreibzugriffe auf transform/opacity der DOM-Knoten –
 * kein React-State pro Scrollframe. Ohne JavaScript und bei Reduced Motion ist
 * die Linie vollständig gefüllt und alle Stationen sind voll sichtbar.
 */
export function FlowTimeline({ withHeading = true }: { withHeading?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLElement>(null);
  const steps = useRef<(HTMLElement | null)[]>([]);
  const active = useRef(false);

  const { scrollYProgress } = useScroll({ target: wrap, offset: ['start 70%', 'end 60%'] });

  const apply = useCallback((p: number) => {
    if (!active.current) return;
    const v = Math.min(1, Math.max(0, p));
    if (line.current) line.current.style.transform = `scaleY(${v.toFixed(4)})`;
    const n = FLOW_STEPS.length;
    steps.current.forEach((el, i) => {
      if (!el) return;
      // Station i liegt bei (i + .5) / n der Linie; weiche Hervorhebung um diesen Punkt
      const t = Math.min(1, Math.max(0, (v * n - i + 0.15) / 0.6));
      el.style.opacity = (0.5 + 0.5 * t).toFixed(3);
      el.dataset.reached = t >= 0.99 ? 'true' : 'false';
    });
  }, []);

  useMotionValueEvent(scrollYProgress, 'change', apply);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      active.current = !mq.matches;
      if (active.current) {
        apply(scrollYProgress.get());
      } else {
        // Reduced Motion: statisch und vollständig
        if (line.current) line.current.style.transform = 'scaleY(1)';
        steps.current.forEach((el) => {
          if (!el) return;
          el.style.opacity = '1';
          el.dataset.reached = 'true';
        });
      }
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [apply, scrollYProgress]);

  return (
    <section className="section" id="ablauf" aria-labelledby="flow-h">
      <div className="shell">
        {withHeading ? (
          <>
            <Slug left="Ablauf" right="04 Schritte" />
            <div className="mb-[clamp(2.5rem,6vw,4.5rem)] grid max-w-4xl gap-[1.1rem]">
              <p className="eyebrow">So funktioniert es</p>
              <Reveal>
                <h2 id="flow-h" className="display text-h2">
                  Vom Anruf bis zur
                  <br />
                  Auszahlung.
                </h2>
              </Reveal>
              <Reveal delay={0.08}>
                <p className="lead">Wir übernehmen den technischen Teil – Sie behalten die Entscheidung.</p>
              </Reveal>
            </div>
          </>
        ) : (
          <h2 id="flow-h" className="sr-only">
            Ablauf der Schadenabwicklung
          </h2>
        )}

        <div ref={wrap} className="relative">
          <div className="absolute bottom-0 left-[19px] top-0 w-px bg-line lg:left-1/2" aria-hidden="true">
            <i
              ref={line}
              data-timeline-line
              className="absolute inset-0 block origin-top bg-[linear-gradient(180deg,#6ba8ff,#5ac8e8)]"
              style={{ transform: 'scaleY(1)' }}
            />
          </div>

          <ol className="grid gap-[clamp(2.5rem,7vh,5rem)]">
            {FLOW_STEPS.map((step, i) => (
              <li
                key={step.num}
                ref={(el) => {
                  steps.current[i] = el;
                }}
                data-timeline-step
                data-reached="true"
                className="group relative pl-[3.6rem] lg:grid lg:grid-cols-2 lg:items-center lg:gap-16 lg:pl-0"
              >
                <span
                  className="absolute left-0 top-[.2rem] z-[2] grid h-10 w-10 place-items-center rounded-full bg-ink-900 font-mono text-[.72rem] text-fg-mute transition-colors duration-500 group-data-[reached=true]:bg-signal group-data-[reached=true]:text-white lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2"
                  style={{ boxShadow: 'inset 0 0 0 1px rgb(var(--c-line))' }}
                >
                  {step.num}
                </span>

                <div className={`grid gap-[.6rem] ${i % 2 === 1 ? 'lg:col-start-2' : ''}`}>
                  <h3 className="font-display text-[clamp(1.3rem,3vw,2rem)] font-semibold tracking-[-.02em]">{step.title}</h3>
                  <p className="max-w-[44ch] text-[.98rem] text-fg-dim">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
