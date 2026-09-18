'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useInViewClass } from '@/hooks/useInViewClass';

/**
 * Text Reveal Engine — echtes Text-Splitting statt opacity:0→1.
 * Stagger läuft ausschließlich über die CSS Custom Property --i (Index),
 * es entsteht keine eigene JS-Animation pro Zeichen/Wort/Zeile.
 */

/** Zeilenweise: jede Zeile fährt aus einer Maske nach oben. Erwartet fertig
 * umbrochene Zeilen — redaktionell gesetzt statt gemessen. */
export function SplitLines({
  lines,
  className,
  delay = 0,
  stagger = 90,
}: {
  lines: ReactNode[];
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const { ref, inView } = useInViewClass<HTMLSpanElement>();
  return (
    <span ref={ref} className={className}>
      {lines.map((line, i) => (
        <span
          key={i}
          className={`split-line ${inView ? 'is-in' : ''}`}
          style={{ '--i': i, '--d': `${delay}ms` } as CSSProperties}
        >
          <span style={{ transitionDelay: `${delay + i * stagger}ms` }}>{line}</span>
        </span>
      ))}
    </span>
  );
}

/** Wortweise: jedes Wort blendet leicht versetzt ein. */
export function SplitWords({
  text,
  className,
  delay = 0,
  stagger = 55,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const { ref, inView } = useInViewClass<HTMLSpanElement>();
  const words = text.split(' ');
  return (
    <span ref={ref} className={className}>
      {words.map((w, i) => (
        <span key={i} className={`split-word ${inView ? 'is-in' : ''}`}>
          <span style={{ transitionDelay: `${delay + i * stagger}ms` }}>{w}</span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  );
}

/** Zeichenweise: Buchstaben kommen leicht versetzt und mit Blur herein. */
export function SplitChars({
  text,
  className,
  delay = 0,
  stagger = 26,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const { ref, inView } = useInViewClass<HTMLSpanElement>();
  const chars = Array.from(text);
  return (
    <span ref={ref} className={className} aria-label={text}>
      {chars.map((c, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`split-char ${inView ? 'is-in' : ''}`}
          style={{ transitionDelay: `${delay + i * stagger}ms` }}
        >
          {c === ' ' ? ' ' : c}
        </span>
      ))}
    </span>
  );
}
