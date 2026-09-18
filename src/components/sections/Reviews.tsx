import { REVIEWS } from '@/lib/content';
import { Reveal } from '@/components/ui/Reveal';
import { Slug } from '@/components/ui/Slug';

function Stars({ n }: { n: number }) {
  return (
    <div aria-hidden="true" className="flex gap-1 text-rose-deep">
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 20 20" fill={i < n ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1">
          <path d="M10 1.5l2.6 5.4 5.9.7-4.3 4.1 1 5.9L10 14.9l-5.2 2.7 1-5.9L1.5 7.6l5.9-.7z" />
        </svg>
      ))}
    </div>
  );
}

/**
 * BEWERTUNGEN als bewegte Story — horizontal snap statt drei starrer Cards.
 * Sterne, Zitat und Name werden mit Mask-Reveal eingeblendet.
 */
export function Reviews() {
  return (
    <section id="reviews" className="section bg-cream" aria-labelledby="reviews-h">
      <div className="shell">
        <Slug left="Bewertungen" right="Platzhalter — echte Bewertungen ergänzen" />
        <h2 id="reviews-h" className="display mb-10 text-h2" style={{ maxWidth: '18ch' }}>
          Was Gäste sagen.
        </h2>

        <div className="no-scrollbar -mx-[var(--pad)] flex snap-x gap-6 overflow-x-auto px-[var(--pad)] pb-4">
          {REVIEWS.map((r, i) => (
            <Reveal key={i} mode="mask" delay={i * 90} className="w-[82vw] flex-none snap-center sm:w-[420px]">
              <div className="card h-full justify-between gap-6 p-[clamp(1.6rem,3vw,2.4rem)]">
                <Stars n={r.rating} />
                <p className="font-display text-[1.15rem] leading-snug text-ink">„{r.text}“</p>
                <p className="font-mono text-[.72rem] uppercase tracking-[.16em] text-fg-mute">— {r.name}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
