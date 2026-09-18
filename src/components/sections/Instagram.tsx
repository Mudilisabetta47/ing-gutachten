import { BIZ } from '@/lib/content';
import { Reveal } from '@/components/ui/Reveal';

const TONES = ['#b8636f', '#c9a463', '#7d2f3a', '#8d7a6d', '#b8636f', '#c9a463'];

export function Instagram() {
  return (
    <section className="section-tight bg-night" aria-labelledby="ig-h">
      <div className="shell">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow eyebrow-night mb-4">Folgt uns</p>
            <h2 id="ig-h" className="display text-h3 text-bone">
              Rose Café auf Instagram
            </h2>
          </div>
          <a
            href={BIZ.instagramHref}
            target="_blank"
            rel="noreferrer"
            className="tlink text-rose-pale"
            data-cursor="cta"
          >
            {BIZ.instagram} <span aria-hidden="true" className="arw">→</span>
          </a>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {TONES.map((tone, i) => (
            <Reveal key={i} mode="scale" delay={i * 60}>
              <div
                className="aspect-square cursor-none overflow-hidden rounded-[14px]"
                data-cursor="media"
                data-cursor-label="VIEW"
                style={{ background: `linear-gradient(150deg, ${tone}44, ${tone}11)` }}
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
