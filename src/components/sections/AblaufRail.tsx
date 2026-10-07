'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useMotionValueEvent, useScroll } from 'framer-motion';
import { FLOW_STEPS } from '@/lib/content';
import { applyRetreat, retreatT } from '@/components/motion/stage-retreat';

const STICKY_MQ = '(min-width: 1024px) and (prefers-reduced-motion: no-preference)';

/**
 * Ablauf als horizontale Schiene in einer Sticky-Bühne (Desktop, ohne
 * Reduced Motion): Scrollfortschritt 0..1 verschiebt die Schiene.
 * Das Layout (Sticky/Rail vs. vertikale Liste) entscheidet reines CSS
 * (.ablauf-*, globals.css) – eine Markup-Version, kein Layout-Sprung.
 */
export function AblaufRail() {
  const track = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLOListElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const maxShift = useRef(0);
  const active = useRef(false);

  const measure = useCallback(() => {
    active.current = window.matchMedia(STICKY_MQ).matches;
    if (rail.current && stage.current) {
      maxShift.current = Math.max(0, rail.current.scrollWidth - stage.current.clientWidth);
    }
    if (!active.current) {
      if (rail.current) rail.current.style.transform = '';
      applyRetreat(stage.current, 0);
    }
  }, []);

  const { scrollYProgress } = useScroll({ target: track, offset: ['start start', 'end end'] });

  const render = useCallback((p: number) => {
    if (!active.current) return;
    const move = Math.min(1, Math.max(0, (p - 0.04) / 0.86));
    if (rail.current) rail.current.style.transform = `translate3d(${(-maxShift.current * move).toFixed(1)}px,0,0)`;
    if (line.current) line.current.style.transform = `scaleX(${move.toFixed(4)})`;
    applyRetreat(stage.current, retreatT(p));
  }, []);

  useMotionValueEvent(scrollYProgress, 'change', render);

  useEffect(() => {
    measure();
    render(scrollYProgress.get());
    const ro = new ResizeObserver(() => {
      measure();
      render(scrollYProgress.get());
    });
    if (stage.current) ro.observe(stage.current);
    return () => ro.disconnect();
  }, [measure, render, scrollYProgress]);

  return (
    <section ref={track} id="ablauf" aria-labelledby="flow-h" className="theme-light ablauf-track relative">
      <div ref={stage} className="theme-dark stage-retreat ablauf-stage relative overflow-hidden">
        <div className="shell">
          <p className="eyebrow mb-4">Ablauf</p>
          <h2 id="flow-h" className="display mb-[clamp(2rem,5vw,4rem)] text-h2">
            Vier Schritte.
            <br />
            <span className="text-fg-mute">Kein Aktenberg.</span>
          </h2>
        </div>

        <div className="ablauf-viewport">
          <ol ref={rail} className="ablauf-rail">
            {FLOW_STEPS.map((s) => (
              <li key={s.num} className="ablauf-step">
                <span className="outline-text display block text-[clamp(4.5rem,2rem+9vw,11rem)] leading-[.8] tracking-[-.05em]" aria-hidden="true">
                  {s.num}
                </span>
                <h3 className="display mt-4 text-[clamp(1.8rem,1.2rem+2vw,3rem)] uppercase leading-none tracking-[-.03em]">
                  <span className="sr-only">{s.num}. </span>
                  {s.title}
                </h3>
                <p className="mt-3 max-w-[30ch] text-fg-dim">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="shell ablauf-progress" aria-hidden="true">
          <div className="h-px w-full bg-line">
            <span ref={line} className="block h-px w-full origin-left scale-x-0 bg-signal-bright" />
          </div>
        </div>
      </div>
    </section>
  );
}
