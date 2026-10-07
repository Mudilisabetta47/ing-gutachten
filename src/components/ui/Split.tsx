import type { CSSProperties, ElementType, ReactNode } from 'react';
import type { RevealVariant } from './Reveal';

/**
 * Zerlegt Text in Wörter bzw. redaktionell gesetzte Zeilen und animiert sie per
 * Maske. Der vollständige Text bleibt als normaler Text im DOM (kein
 * aria-hidden-Trick nötig, die Wörter sind echte Textknoten mit Leerzeichen).
 */
export function SplitWords({
  text,
  variant = 'mask',
  delay = 0,
  className,
  as: Tag = 'span',
}: {
  text: string;
  variant?: Extract<RevealVariant, 'mask' | 'mask-fast' | 'soft' | 'line'>;
  delay?: number;
  className?: string;
  as?: ElementType;
}) {
  const words = text.split(' ');
  const style = delay ? ({ '--rv-delay': `${delay}s` } as CSSProperties) : undefined;
  return (
    <Tag data-reveal={variant} className={className} style={style}>
      {words.map((w, i) => (
        <span key={i}>
          <span className="sp">
            <i style={{ '--i': i } as CSSProperties}>{w}</i>
          </span>
          {i < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </Tag>
  );
}

/** Redaktionell gesetzte Zeilen – jede Zeile fährt aus der Maske. */
export function Lines({
  lines,
  variant = 'mask',
  delay = 0,
  className,
  as: Tag = 'span',
  enter = false,
}: {
  lines: ReactNode[];
  variant?: Extract<RevealVariant, 'mask' | 'mask-fast' | 'soft' | 'line'>;
  delay?: number;
  className?: string;
  as?: ElementType;
  /** true = beim Laden animieren (Hero), statt beim Einscrollen. */
  enter?: boolean;
}) {
  const style = delay ? ({ '--rv-delay': `${delay}s` } as CSSProperties) : undefined;
  return (
    <Tag {...(enter ? {} : { 'data-reveal': variant })} className={className} style={style}>
      {lines.map((line, i) => (
        <span key={i} className="block">
          <span className={`sp ${enter ? 'enter-line' : ''}`}>
            <i style={{ '--i': i } as CSSProperties}>{line}</i>
          </span>
        </span>
      ))}
    </Tag>
  );
}
