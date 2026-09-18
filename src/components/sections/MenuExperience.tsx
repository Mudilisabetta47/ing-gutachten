'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { MENU_CATEGORIES, type MenuCategory } from '@/lib/content';
import { Reveal } from '@/components/ui/Reveal';
import { Slug } from '@/components/ui/Slug';

const TONE_COLORS: Record<MenuCategory['tone'], { a: string; b: string }> = {
  dawn: { a: '#e9c9c9', b: '#c9a463' },
  roast: { a: '#c9a463', b: '#7d2f3a' },
  sugar: { a: '#b8636f', b: '#e9c9c9' },
  signature: { a: '#b8636f', b: '#7d2f3a' },
  green: { a: '#9caf7c', b: '#5a6a45' },
  drink: { a: '#7fa6c0', b: '#c9a463' },
};

/**
 * INTERAKTIVE SPEISEKARTE — kein PDF-Abbild, sondern eine geführte
 * Auswahl: links die Kategorien, rechts eine große gemalte Illustration
 * mit Mask-Reveal-Texten. Beim Kategoriewechsel fährt das alte Bild
 * heraus, das neue kommt herein, Preise erscheinen leicht verzögert.
 *
 * Bewusst klickgesteuert statt scroll-gejackt: bei 12 Kategorien und
 * teils acht Gerichten pro Kategorie würde ein durchgehendes
 * Scroll-Timeline-Kapitel die Seite unbrauchbar lang machen. Die
 * Übergänge bleiben trotzdem animiert und cinematisch.
 */
export function MenuExperience() {
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  const cat = MENU_CATEGORIES[active];
  const tone = TONE_COLORS[cat.tone];

  return (
    <section id="food" className="section bg-night" aria-labelledby="menu-h">
      <div className="shell">
        <Slug left="Speisekarte" right="Rose Café · Bremen" />
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <p className="eyebrow eyebrow-night mb-4">Von Kaffee bis Brunch</p>
            <h2 id="menu-h" className="display text-h2 text-bone" style={{ maxWidth: '16ch' }}>
              Unsere Karte.
            </h2>
          </div>
        </div>

        <div className="grid gap-10 lg:grid-cols-[.9fr_1.4fr] lg:gap-14">
          {/* Kategorie-Navigation */}
          <nav aria-label="Menü-Kategorien" className="no-scrollbar -mx-[var(--pad)] flex gap-2 overflow-x-auto px-[var(--pad)] lg:mx-0 lg:block lg:gap-1 lg:overflow-visible lg:px-0">
            {MENU_CATEGORIES.map((c, i) => {
              const isActive = i === active;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setActive(i)}
                  data-cursor="cta"
                  className={`group flex w-full flex-none cursor-none items-center gap-4 whitespace-nowrap rounded-full px-5 py-3 text-left transition-colors duration-300 lg:rounded-none lg:whitespace-normal lg:border-b lg:border-line-night lg:px-0 lg:py-4 ${
                    isActive ? 'bg-white/[.06] lg:bg-transparent' : ''
                  }`}
                >
                  <em className={`font-mono text-[.66rem] not-italic tracking-[.2em] ${isActive ? 'text-rose-pale' : 'text-bone/40'}`}>
                    {c.num}
                  </em>
                  <span className={`font-display text-[1.02rem] font-medium transition-colors ${isActive ? 'text-bone' : 'text-bone/55 group-hover:text-bone/85'}`}>
                    {c.title}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Aktive Kategorie */}
          <div className="relative min-h-[420px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={cat.key}
                initial={reduced ? { opacity: 0 } : { opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, x: -28 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="mb-8 grid grid-cols-[auto_1fr] items-center gap-6">
                  <CategoryGlyph toneA={tone.a} toneB={tone.b} />
                  <div>
                    <p className="font-mono text-[.66rem] uppercase tracking-[.22em] text-bone/40">Kategorie {cat.num}</p>
                    <h3 className="display text-[clamp(1.6rem,3.2vw,2.4rem)] text-bone">{cat.title}</h3>
                  </div>
                </div>

                {cat.intro && <p className="mb-6 max-w-[58ch] text-lead text-bone/70">{cat.intro}</p>}

                {cat.items.length > 0 && (
                  <ul className="grid gap-x-8 gap-y-5 border-t border-line-night pt-6 sm:grid-cols-2">
                    {cat.items.map((item, i) => (
                      <motion.li
                        key={item.name}
                        initial={reduced ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.08 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                        className="flex flex-col gap-1"
                      >
                        <div className="flex items-baseline justify-between gap-4">
                          <p className="font-display font-medium text-bone">{item.name}</p>
                          {item.price && <span className="whitespace-nowrap font-mono text-[.88rem] text-rose-pale">{item.price}</span>}
                        </div>
                        {item.note && <p className="text-[.88rem] leading-relaxed text-bone/55">{item.note}</p>}
                      </motion.li>
                    ))}
                  </ul>
                )}

                {cat.footnote && <p className="mt-6 font-mono text-[.72rem] uppercase tracking-[.16em] text-bone/40">{cat.footnote}</p>}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Gemalte Kategorie-Illustration statt Foto — Platzhalter bis echtes Bildmaterial vorliegt. */
function CategoryGlyph({ toneA, toneB }: { toneA: string; toneB: string }) {
  return (
    <Reveal mode="scale" className="flex-none">
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id={`mg-${toneA}-${toneB}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={toneA} />
            <stop offset="1" stopColor={toneB} />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill={`url(#mg-${toneA}-${toneB})`} fillOpacity=".22" />
        <circle cx="32" cy="32" r="18" fill={`url(#mg-${toneA}-${toneB})`} fillOpacity=".55" />
        <circle cx="32" cy="32" r="6" fill={toneA} />
      </svg>
    </Reveal>
  );
}
