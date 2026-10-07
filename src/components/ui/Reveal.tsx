import type { CSSProperties, ElementType, ReactNode } from 'react';

export type RevealVariant = 'up' | 'left' | 'right' | 'blur' | 'scale' | 'clip' | 'clip-x' | 'fade' | 'mask' | 'mask-fast' | 'soft' | 'line';

/** Rückwärtskompatibel: frühere Richtungen werden auf Varianten abgebildet. */
const DIRECTION_MAP = { up: 'up', left: 'left', right: 'right', scale: 'scale' } as const;

/**
 * Scroll-Reveal. Server-Komponente: rendert nur ein Attribut, die Bewegung
 * steckt komplett in CSS (globals.css) und wird vom RevealObserver ausgelöst.
 * Ohne JavaScript und bei prefers-reduced-motion ist der Inhalt sofort sichtbar.
 */
export function Reveal({
  children,
  delay = 0,
  direction,
  variant,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  delay?: number;
  direction?: keyof typeof DIRECTION_MAP;
  variant?: RevealVariant;
  className?: string;
  as?: ElementType;
}) {
  const v: RevealVariant = variant ?? (direction ? DIRECTION_MAP[direction] : 'up');
  const style = delay ? ({ '--rv-delay': `${delay}s` } as CSSProperties) : undefined;
  return (
    <Tag data-reveal={v} className={className} style={style}>
      {children}
    </Tag>
  );
}
