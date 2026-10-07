'use client';

import { useState } from 'react';
import type { Faq as FaqItem } from '@/lib/content';

/**
 * Accordion. Die Antworten stehen IMMER im DOM (nur visuell eingeklappt über
 * grid-template-rows) – Suchmaschinen und Screenreader sehen den vollen Text,
 * er passt zum FAQPage-Markup.
 */
export function FaqList({ items, startIndex = 1 }: { items: FaqItem[]; startIndex?: number }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="grid border-t border-line">
      {items.map((item, i) => {
        const isOpen = open === i;
        const id = `faq-panel-${startIndex + i}`;
        return (
          <div key={item.q} className="border-b border-line">
            <h3>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                aria-controls={id}
                data-cursor="link"
                data-cursor-label={isOpen ? 'SCHLIESSEN' : 'ÖFFNEN'}
                className={`flex w-full cursor-pointer items-start gap-5 border-0 bg-transparent py-6 text-left font-display text-[clamp(1.1rem,2.4vw,1.6rem)] font-semibold tracking-[-.02em] transition-colors ${
                  isOpen ? 'text-signal-bright' : 'text-fg hover:text-signal-bright'
                }`}
              >
                <span className="flex-none pt-[.5em] font-mono text-[.68rem] text-fg-mute">{String(startIndex + i).padStart(2, '0')}</span>
                <span>{item.q}</span>
                <span className={`relative ml-auto h-[26px] w-[26px] flex-none transition-transform duration-500 ease-out ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true">
                  <span className="absolute left-1/2 top-1/2 h-[1.5px] w-[13px] -translate-x-1/2 -translate-y-1/2 bg-current" />
                  <span className={`absolute left-1/2 top-1/2 h-[13px] w-[1.5px] -translate-x-1/2 -translate-y-1/2 bg-current transition-transform duration-500 ease-out ${isOpen ? 'scale-y-0' : ''}`} />
                </span>
              </button>
            </h3>
            <div
              id={id}
              role="region"
              aria-labelledby={undefined}
              className="grid transition-[grid-template-rows,opacity] duration-500 ease-out"
              style={{ gridTemplateRows: isOpen ? '1fr' : '0fr', opacity: isOpen ? 1 : 0, visibility: isOpen ? 'visible' : 'hidden' }}
            >
              <div className="overflow-hidden">
                <p className="max-w-[66ch] pb-7 pl-[2.4rem] text-fg-dim">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
