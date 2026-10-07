import { BIZ } from '@/lib/content';
import { Reveal } from '@/components/ui/Reveal';

/** Kompakter Vertrauensstreifen – ausschließlich belegte Fakten. */
const FACTS = [
  { big: '15+', small: 'Jahre Erfahrung' },
  { big: 'Vor Ort', small: 'Hannover & Umgebung' },
  { big: 'Messtechnik', small: 'Achs- & Karosserievermessung' },
  { big: 'Hannover', small: `${BIZ.street}` },
];

export function FactStrip() {
  return (
    <section className="theme-dark relative border-y border-line" aria-label="Auf einen Blick">
      <div className="shell">
        <dl className="grid grid-cols-2 lg:grid-cols-4">
          {FACTS.map((f, i) => (
            <Reveal key={f.big} variant="clip" delay={i * 0.08} className="border-line px-0 py-7 odd:pr-4 even:border-l even:pl-5 sm:py-9 lg:border-l lg:px-7 lg:first:border-l-0 lg:first:pl-0">
              <dd className="display text-[clamp(1.5rem,1rem+2.2vw,2.7rem)] leading-none tracking-[-.03em]">{f.big}</dd>
              <dt className="mono-label mt-3 text-fg-mute">{f.small}</dt>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
