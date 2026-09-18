'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useInViewClass } from '@/hooks/useInViewClass';

export type RevealMode = 'fade' | 'up' | 'blur' | 'clip' | 'mask' | 'mask-fast' | 'soft' | 'scale';

/**
 * Zentrale Reveal Engine. Reine CSS-Transitionen, per IntersectionObserver
 * einmalig ausgelöst (`is-in`) — kein Tween pro Element in JS, keine Menge
 * an parallelen requestAnimationFrame-Läufen.
 */
export function Reveal({
  children,
  mode = 'up',
  delay = 0,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  mode?: RevealMode;
  delay?: number;
  className?: string;
  as?: 'div' | 'span' | 'li';
}) {
  const { ref, inView } = useInViewClass<HTMLDivElement>();
  const style = { '--d': `${delay}ms`, transitionDuration: mode === 'mask-fast' ? undefined : '.9s' } as CSSProperties;

  return (
    <Tag
      ref={ref as never}
      className={`rv rv-${mode} ${inView ? 'is-in' : ''} ${className ?? ''}`}
      style={style}
    >
      {children}
    </Tag>
  );
}
