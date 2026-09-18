'use client';

import { GALLERY, type GalleryItem } from '@/lib/content';
import { Reveal } from '@/components/ui/Reveal';
import { Slug } from '@/components/ui/Slug';

const TONE_COLORS: Record<GalleryItem['tone'], string> = {
  interior: '#7d2f3a',
  window: '#c9a463',
  cup: '#b8636f',
  pastry: '#c9a463',
  flowers: '#b8636f',
  people: '#8d7a6d',
  counter: '#5a4a41',
  exterior: '#7d2f3a',
};

const SIZE_CLS: Record<GalleryItem['size'], string> = {
  sm: 'md:col-span-3 aspect-[4/5]',
  md: 'md:col-span-4 aspect-[3/4]',
  lg: 'md:col-span-5 aspect-[4/3]',
};

const MODE_BY_FROM: Record<GalleryItem['from'], 'mask' | 'up' | 'mask-fast'> = {
  left: 'mask',
  right: 'mask-fast',
  up: 'up',
};

/**
 * INTERAKTIVE GALERIE — asymmetrisches Editorial-Grid statt Standard-Grid.
 * Unterschiedliche Größen, Mask-Reveals von unterschiedlichen Seiten,
 * Custom-Cursor-Label VIEW, Hover-Zoom.
 */
export function Gallery() {
  return (
    <section id="atmosphere" className="section bg-bone" aria-labelledby="gallery-h">
      <div className="shell">
        <Slug left="Atmosphäre" right="Rose Café · Bremen" />
        <p className="eyebrow mb-6">Ein Blick hinein</p>
        <h2 id="gallery-h" className="display mb-12 text-h2" style={{ maxWidth: '16ch' }}>
          Licht, Ruhe, Rosen.
        </h2>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
          {GALLERY.map((item) => (
            <Reveal key={item.key} mode={MODE_BY_FROM[item.from]} className={SIZE_CLS[item.size]}>
              <figure
                className="group relative h-full w-full cursor-none overflow-hidden rounded-[20px]"
                data-cursor="media"
                data-cursor-label="VIEW"
              >
                <div
                  className="absolute inset-0 transition-transform duration-700 ease-cinematic group-hover:scale-[1.06]"
                  style={{ background: `linear-gradient(150deg, ${TONE_COLORS[item.tone]}3d, ${TONE_COLORS[item.tone]}0f 70%)` }}
                >
                  <PlaceholderMotif tone={TONE_COLORS[item.tone]} />
                </div>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <figcaption className="pointer-events-none absolute inset-x-4 bottom-4 translate-y-2 font-mono text-[.68rem] uppercase tracking-[.16em] text-white opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                  {item.caption}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlaceholderMotif({ tone }: { tone: string }) {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden="true">
      <circle cx="60" cy="70" r="70" fill={tone} fillOpacity=".22" />
      <circle cx="150" cy="140" r="50" fill={tone} fillOpacity=".2" />
    </svg>
  );
}
