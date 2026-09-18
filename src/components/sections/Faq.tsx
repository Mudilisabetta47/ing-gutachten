'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { FAQS } from '@/lib/content';
import { Reveal } from '@/components/ui/Reveal';
import { Slug } from '@/components/ui/Slug';

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="section-tight bg-cream" aria-labelledby="faq-h" id="faq">
      <div className="shell grid gap-10 lg:grid-cols-[.8fr_1.2fr]">
        <div>
          <Slug left="FAQ" right="Gut zu wissen" />
          <h2 id="faq-h" className="display text-h2" style={{ maxWidth: '12ch' }}>
            Fragen &amp; Antworten.
          </h2>
        </div>

        <ul className="grid gap-3">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={f.q} as="li" mode="up" delay={i * 60}>
                <div className="overflow-hidden rounded-[16px] border border-line">
                  <button
                    type="button"
                    className="flex w-full cursor-none items-center justify-between gap-4 px-5 py-4 text-left font-display font-medium"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    data-cursor="cta"
                  >
                    {f.q}
                    <span className={`text-xl transition-transform duration-300 ease-cinematic ${isOpen ? 'rotate-45' : ''}`}>+</span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        className="overflow-hidden text-fg-dim"
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <div className="px-5 pb-4">{f.a}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
