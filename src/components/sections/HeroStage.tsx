'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRef, type ReactNode } from 'react';

/**
 * Parallax-Schicht des Heros. Drei Ebenen, drei Geschwindigkeiten – der
 * Tiefeneindruck entsteht aus der Differenz. Nur transform/opacity/filter,
 * kein Re-Render pro Scrollframe (framer schreibt MotionValues direkt).
 */
export function HeroStage({ background, visual, children }: { background: ReactNode; visual: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });

  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '20%']);
  const carY = useTransform(scrollYProgress, [0, 1], ['0%', '-9%']);
  const carScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const carX = useTransform(scrollYProgress, [0, 1], ['0%', '6%']);
  const contentY = useTransform(scrollYProgress, [0, 0.85], [0, 70]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const contentBlur = useTransform(scrollYProgress, [0, 0.8], ['blur(0px)', 'blur(8px)']);

  return (
    <section
      ref={ref}
      id="top"
      className="theme-dark relative isolate flex items-end overflow-hidden"
      style={{ minHeight: '100svh', paddingTop: '7.5rem', paddingBottom: 'clamp(2.2rem,7vh,4.5rem)' }}
    >
      <motion.div aria-hidden="true" className="absolute inset-x-0 -top-[8%] bottom-0 -z-20" style={{ y: reduced ? 0 : bgY }}>
        {background}
      </motion.div>

      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[16%] top-[5%] -z-10 w-[138%] opacity-[.5] sm:-right-[12%] sm:top-[11%] sm:w-[115%] lg:bottom-[10%] lg:right-[-6%] lg:top-auto lg:w-[min(64%,980px)] lg:opacity-100 xl:right-[-4%] xl:w-[min(78%,1080px)]"
        style={reduced ? undefined : { y: carY, scale: carScale, x: carX }}
      >
        {visual}
      </motion.div>

      <motion.div
        className="shell relative z-[2] w-full"
        style={reduced ? undefined : { y: contentY, opacity: contentOpacity, filter: contentBlur }}
      >
        {children}
      </motion.div>
    </section>
  );
}
