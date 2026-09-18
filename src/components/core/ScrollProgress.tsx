'use client';

import { motion, useScroll, useSpring } from 'framer-motion';

/** Scroll Progress Indicator — ein Reibungsstreifen über der gesamten Seite. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 260, damping: 40, mass: 0.2 });

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[110] h-[2px] origin-left bg-rose-deep"
      style={{ scaleX }}
    />
  );
}
