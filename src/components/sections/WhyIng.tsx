import Image from 'next/image';
import { WHY_ITEMS } from '@/lib/content';
import { Reveal } from '@/components/ui/Reveal';
import { SplitWords } from '@/components/ui/Split';

/** „Warum ING" als große Fact-Rows plus ein echtes Foto – nur belegte Aussagen. */
export function WhyIng() {
  return (
    <section className="theme-light section relative" id="warum-ing" aria-labelledby="why-h">
      <div className="shell grid gap-[clamp(2rem,5vw,6rem)] lg:grid-cols-[1.15fr_.85fr]">
        <div>
          <p className="eyebrow mb-4">Warum ING</p>
          <h2 id="why-h" className="display mb-[clamp(2rem,5vw,4rem)] text-h2">
            <SplitWords text="Gemessen. Belegt. Unabhängig." />
          </h2>

          <dl className="border-t border-line">
            {WHY_ITEMS.map((w, i) => (
              <Reveal key={w.title} variant="clip" delay={i * 0.06} className="grid grid-cols-[3.2rem_1fr] items-baseline gap-x-4 gap-y-1 border-b border-line py-[clamp(1.1rem,2.4vw,1.8rem)] sm:grid-cols-[4.5rem_1fr_1.1fr]">
                <span className="mono-label text-signal-bright">{String(i + 1).padStart(2, '0')}</span>
                <dt className="display text-[clamp(1.5rem,1rem+2vw,2.6rem)] leading-none tracking-[-.03em]">
                  {w.stat ? <span className="text-signal-bright">{w.stat} </span> : null}
                  {w.title}
                </dt>
                <dd className="col-start-2 text-fg-dim sm:col-start-3">{w.text}</dd>
              </Reveal>
            ))}
          </dl>
        </div>

        <Reveal variant="clip" className="relative min-h-[320px] overflow-hidden rounded-[26px] lg:min-h-[560px]">
          <Image
            src="/assets/img/pruefstand-halle.webp"
            alt="Kfz-Sachverständiger vermisst ein Fahrzeug in der Prüfhalle"
            fill
            sizes="(min-width:1024px) 38vw, 92vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(5,9,26,.85))]" />
          <p className="mono-label absolute bottom-5 left-5 text-white/85">Aus der Prüfhalle · Hannover</p>
        </Reveal>
      </div>
    </section>
  );
}
