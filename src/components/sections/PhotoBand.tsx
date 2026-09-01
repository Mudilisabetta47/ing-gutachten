import type { ReactNode } from 'react';
import { Reveal } from '@/components/ui/Reveal';

/**
 * Full-Bleed-Fotoband mit Messmarken-Overlay. Die Aufnahmen sind farblich
 * ins Graphit der Seite gegradet, das Overlay hält sie in der
 * Prüfprotokoll-Bildsprache.
 */
export function PhotoBand({
  src,
  alt,
  eyebrow,
  title,
  text,
  caption,
  height = 'clamp(380px, 62vh, 680px)',
}: {
  src: string;
  alt: string;
  eyebrow: string;
  title: ReactNode;
  text: string;
  caption: string;
  height?: string;
}) {
  return (
    <section className="relative overflow-hidden border-y border-line">
      <div className="relative w-full" style={{ height }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />

        <div
          className="absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(90deg, rgba(8,9,11,.94) 0%, rgba(8,9,11,.72) 42%, rgba(8,9,11,.35) 100%), radial-gradient(90% 70% at 70% 40%, rgba(107,168,255,.08), transparent 70%)',
          }}
        />

        {/* Messmarken */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 600" preserveAspectRatio="none" aria-hidden="true">
          <g stroke="#5ac8e8" strokeOpacity=".22" strokeWidth="1">
            <path d="M0 90 H1200 M0 510 H1200" strokeDasharray="2 10" />
            <path d="M60 60 V120 M1140 480 V540" />
          </g>
          <g stroke="#6ba8ff" strokeOpacity=".5" strokeWidth="1.5" fill="none">
            <path d="M840 170 h-26 v26 M980 170 h26 v26 M840 400 h-26 v-26 M980 400 h26 v-26" />
          </g>
        </svg>

        <div className="absolute inset-0 flex items-end sm:items-center">
          <div className="shell w-full pb-10 sm:pb-0">
            <Reveal className="max-w-[46ch]">
              <p className="eyebrow mb-4">{eyebrow}</p>
              <h2 className="display mb-4 text-[clamp(1.7rem,4vw,3.2rem)]">{title}</h2>
              <p className="text-[.98rem] text-fg-dim">{text}</p>
            </Reveal>
          </div>
        </div>

        <figcaption className="absolute bottom-4 right-[var(--pad)] hidden font-mono text-[.6rem] uppercase tracking-[.2em] text-fg-mute sm:block">
          {caption}
        </figcaption>
      </div>
    </section>
  );
}
