'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

type Direction = 'up' | 'left' | 'right' | 'scale';

const OFFSETS: Record<Direction, { x?: number; y?: number; scale?: number }> = {
  up: { y: 26 },
  left: { x: -34 },
  right: { x: 34 },
  scale: { scale: 0.94 },
};

/**
 * Scroll-Reveal mit Blur-to-sharp. Respektiert prefers-reduced-motion:
 * dann wird der Inhalt sofort und unbewegt gezeigt.
 */
export function Reveal({
  children,
  delay = 0,
  direction = 'up',
  className,
}: {
  children: ReactNode;
  delay?: number;
  direction?: Direction;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const from = OFFSETS[direction];

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, filter: 'blur(6px)', ...from }}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.85, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
