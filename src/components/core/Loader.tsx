'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { RoseCafeBadge } from '@/components/layout/Brand';

/**
 * Premium Intro Loader. Verschwindet erst, wenn das wichtigste Hero-Medium
 * (die Café-Szene) sein erstes Bild gezeichnet hat — signalisiert über das
 * Event `rose:hero-ready`. Eine Obergrenze verhindert, dass die Seite bei
 * einem verpassten Event hängen bleibt.
 */
export function Loader() {
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(false);

  const progressRef = useRef(0);
  const heroReadyRef = useRef(false);

  useEffect(() => {
    document.body.classList.add('is-locked');
    const minTime = reduced ? 250 : 1100;
    const start = performance.now();
    let raf = 0;

    const tick = () => {
      const cap = heroReadyRef.current ? 100 : 92;
      progressRef.current = Math.min(cap, progressRef.current + (cap - progressRef.current) * 0.06 + 0.4);
      setProgress(progressRef.current);
      if (progressRef.current < 100) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onHeroReady = () => {
      heroReadyRef.current = true;
      setReady(true);
    };
    document.addEventListener('rose:hero-ready', onHeroReady);
    const fallback = window.setTimeout(onHeroReady, 2400);

    const finish = () => {
      window.setTimeout(
        () => {
          progressRef.current = 100;
          setProgress(100);
          window.setTimeout(() => {
            setHidden(true);
            document.body.classList.remove('is-locked');
          }, 420);
        },
        Math.max(0, minTime - (performance.now() - start)),
      );
    };

    document.addEventListener('rose:hero-ready', finish, { once: true });
    const hardStop = window.setTimeout(finish, 2500);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(fallback);
      window.clearTimeout(hardStop);
      document.removeEventListener('rose:hero-ready', onHeroReady);
      document.removeEventListener('rose:hero-ready', finish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  void ready;

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          className="fixed inset-0 z-[200] grid place-items-center bg-night"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.65, 0, 0.35, 1] }}
          aria-hidden="true"
        >
          <div className="grid justify-items-center gap-6 px-6 text-center">
            <RoseCafeBadge size={104} tone="gold" />
            <div className="sr-only">ROSE CAFÉ — Bremen</div>
            <div className="mt-2 h-px w-[min(46vw,220px)] overflow-hidden bg-white/12">
              <motion.div
                className="h-full bg-rose-pale"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.25, ease: 'linear' }}
              />
            </div>
            <div className="font-mono text-[.6rem] tabular-nums tracking-[.2em] text-white/40">
              {Math.round(progress)}%
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
