'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { Faq as FaqItem } from '@/lib/content';

/** Accordion mit echter Höhenanimation über AnimatePresence. */
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
                className={`flex w-full cursor-pointer items-start gap-5 border-0 bg-transparent py-6 text-left font-display text-[clamp(1.02rem,2.2vw,1.3rem)] font-semibold tracking-[-.015em] transition-colors ${
                  isOpen ? 'text-signal' : 'text-fg hover:text-signal'
                }`}
              >
                <span className="flex-none pt-[.4em] font-mono text-[.68rem] text-fg-mute">
                  {String(startIndex + i).padStart(2, '0')}
                </span>
                <span>{item.q}</span>
                <span
                  className={`relative ml-auto h-[26px] w-[26px] flex-none transition-transform duration-500 ease-out ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                >
                  <span className="absolute left-1/2 top-1/2 h-[1.5px] w-[13px] -translate-x-1/2 -translate-y-1/2 bg-current" />
                  <span
                    className={`absolute left-1/2 top-1/2 h-[13px] w-[1.5px] -translate-x-1/2 -translate-y-1/2 bg-current transition-transform duration-500 ease-out ${
                      isOpen ? 'scale-y-0' : ''
                    }`}
                  />
                </span>
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={id}
                  role="region"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <p className="max-w-[66ch] pb-7 pl-[2.4rem] text-fg-dim">{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
