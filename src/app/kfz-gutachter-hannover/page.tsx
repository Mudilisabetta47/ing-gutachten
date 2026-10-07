import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Landing } from '@/components/layout/Landing';
import { Reveal } from '@/components/ui/Reveal';
import { SplitWords } from '@/components/ui/Split';
import { Arrow } from '@/components/ui/Icon';
import { ServiceMap } from '@/components/sections/ServiceMap';
import { BIZ, FAQS, FLOW_STEPS, HOME_SERVICES, WHY_ITEMS } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

const DESCRIPTION =
  'Kfz-Gutachter und Sachverständiger in Hannover: Unfallgutachten, Schadengutachten und PKW-Gutachten mit Vor-Ort-Service. Büro Hildesheimer Straße 229. Jetzt Schaden melden.';

export const metadata: Metadata = buildMetadata({
  title: 'Kfz-Gutachter Hannover – Unfall- & Schadengutachten',
  description: DESCRIPTION,
  path: '/kfz-gutachter-hannover',
});

const WHEN = [
  { t: 'Nach einem Unfall', d: 'Der Schaden ist nicht von Ihnen verursacht – und größer als eine Kleinigkeit.' },
  { t: 'Bei Streit um die Höhe', d: 'Die Versicherung kürzt oder bestreitet einzelne Positionen.' },
  { t: 'Zur Bewertung', d: 'Fahrzeugwert, Wertminderung oder Vorschäden sollen belegt werden.' },
  { t: 'Bei Unsicherheit', d: 'Sie wissen nicht, ob Gutachten oder Kostenvoranschlag sinnvoll ist.' },
];

export default function Page() {
  return (
    <Landing
      eyebrow="Kfz-Sachverständigenbüro · Hannover"
      title="Kfz-Gutachter in Hannover."
      lead="Unabhängige Unfall- und Schadengutachten – wir kommen zu Ihrem Fahrzeug."
      chips={['Unfallgutachten', 'Schadengutachten', 'PKW-Gutachten', 'Vor-Ort-Service']}
      trail={[{ name: 'Kfz-Gutachter Hannover', href: '/kfz-gutachter-hannover' }]}
      service={{ name: 'Kfz-Gutachter Hannover', description: DESCRIPTION, path: '/kfz-gutachter-hannover' }}
      faqs={[FAQS[0], FAQS[1], FAQS[2], FAQS[3], FAQS[6]]}
      related={[
        { title: 'Unfallgutachten', text: 'Beweissichere Dokumentation nach dem Unfall.', href: '/unfallgutachten' },
        { title: 'Schadengutachten', text: 'Schaden, Kosten und Wertminderung.', href: '/schadensgutachten' },
        { title: 'Unfallanalyse', text: 'Technische Auswertung des Unfallgeschehens.', href: '/unfallanalyse' },
      ]}
    >
      {/* Leistung */}
      <section className="theme-light section" aria-labelledby="hh-leistung">
        <div className="shell grid gap-[clamp(2rem,5vw,6rem)] lg:grid-cols-[.9fr_1.1fr]">
          <div className="grid content-start gap-5">
            <p className="eyebrow">Leistung</p>
            <h2 id="hh-leistung" className="display text-h2">
              <SplitWords text="Was Sie von uns bekommen." />
            </h2>
            <Reveal delay={0.1}>
              <p className="lead">
                Ein Kfz-Gutachten von ING Gutachten dokumentiert den Schaden, beziffert Reparaturkosten, Wert und
                Wertminderung und belegt jede Position – mit Messwerten statt Schätzungen.
              </p>
            </Reveal>
          </div>
          <ul className="border-t border-line">
            {HOME_SERVICES.map((s, i) => (
              <Reveal as="li" key={s.num} variant="clip" delay={i * 0.05} className="border-b border-line">
                <Link href={s.href} className="group grid grid-cols-[3rem_1fr_auto] items-baseline gap-4 py-5" data-cursor="link" data-cursor-label="ÖFFNEN">
                  <span className="mono-label text-signal-bright">{s.num}</span>
                  <span className="display text-[clamp(1.4rem,1rem+1.8vw,2.4rem)] uppercase leading-none tracking-[-.03em] transition-transform duration-500 ease-out group-hover:translate-x-2">
                    {s.title}
                  </span>
                  <Arrow />
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* Wann */}
      <section className="theme-dark section" aria-labelledby="hh-wann">
        <div className="shell">
          <p className="eyebrow mb-4">Wann Gutachter</p>
          <h2 id="hh-wann" className="display mb-[clamp(2rem,5vw,4rem)] text-h2">
            <SplitWords text="Wann ein Gutachter sinnvoll ist." />
          </h2>
          <dl className="grid border-t border-line md:grid-cols-2">
            {WHEN.map((w, i) => (
              <Reveal key={w.t} variant="clip" delay={i * 0.06} className="border-b border-line py-7 md:odd:border-r md:odd:pr-8 md:even:pl-8">
                <dt className="display text-[clamp(1.4rem,1rem+1.6vw,2.2rem)] leading-none tracking-[-.025em]">{w.t}</dt>
                <dd className="mt-3 max-w-[38ch] text-fg-dim">{w.d}</dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      {/* Ablauf */}
      <section className="theme-light section" aria-labelledby="hh-ablauf">
        <div className="shell">
          <p className="eyebrow mb-4">Ablauf</p>
          <h2 id="hh-ablauf" className="display mb-[clamp(2rem,5vw,4rem)] text-h2">
            <SplitWords text="In vier Schritten zum Gutachten." />
          </h2>
          <ol className="grid gap-px overflow-hidden rounded-[24px] border border-line bg-line md:grid-cols-4">
            {FLOW_STEPS.map((s, i) => (
              <Reveal as="li" key={s.num} variant="up" delay={i * 0.07} className="grid content-start gap-3 bg-ink-900 p-6">
                <span className="outline-text display text-[4.5rem] leading-none">{s.num}</span>
                <h3 className="display text-[1.4rem] uppercase tracking-[-.02em]">{s.title}</h3>
                <p className="text-fg-dim">{s.text}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Vorteile */}
      <section className="theme-dark section" aria-labelledby="hh-vorteile">
        <div className="shell grid gap-[clamp(2rem,5vw,6rem)] lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="eyebrow mb-4">Warum ING</p>
            <h2 id="hh-vorteile" className="display mb-10 text-h2">
              <SplitWords text="Gemessen. Belegt. Unabhängig." />
            </h2>
            <dl className="border-t border-line">
              {WHY_ITEMS.map((w, i) => (
                <Reveal key={w.title} variant="clip" delay={i * 0.05} className="grid grid-cols-[3rem_1fr] gap-x-4 border-b border-line py-5 sm:grid-cols-[3rem_1fr_1.1fr]">
                  <span className="mono-label text-signal-bright">{String(i + 1).padStart(2, '0')}</span>
                  <dt className="display text-[clamp(1.3rem,1rem+1.4vw,2rem)] leading-none tracking-[-.025em]">
                    {w.stat ? <span className="text-signal-bright">{w.stat} </span> : null}
                    {w.title}
                  </dt>
                  <dd className="col-start-2 mt-1 text-fg-dim sm:col-start-3 sm:mt-0">{w.text}</dd>
                </Reveal>
              ))}
            </dl>
          </div>
          <Reveal variant="clip" className="relative min-h-[300px] overflow-hidden rounded-[26px]">
            <Image src="/assets/img/team-begutachtung.webp" alt="Begutachtung eines Fahrzeugs durch das Team von ING Gutachten" fill sizes="(min-width:1024px) 38vw, 92vw" className="object-cover" />
          </Reveal>
        </div>
      </section>

      {/* Vor-Ort-Service */}
      <ServiceMap headingId="hh-map" title="Vor-Ort-Service in Hannover." />

      {/* Kontakt */}
      <section className="theme-dark section-tight border-t border-line">
        <div className="shell flex flex-wrap items-center justify-between gap-8">
          <div className="grid gap-2">
            <p className="mono-label text-fg-mute">Büro Hannover</p>
            <address className="display text-[clamp(1.4rem,1rem+1.6vw,2.2rem)] not-italic leading-tight tracking-[-.02em]">
              {BIZ.street}, {BIZ.zip} {BIZ.city}
            </address>
            <a href={`tel:${BIZ.phoneLink}`} className="text-fg-dim transition-colors hover:text-signal-bright">
              {BIZ.phoneDisplay} · Mobil {BIZ.mobileDisplay}
            </a>
          </div>
          <Link href="/kontakt#anfrage" className="btn" data-cursor="link" data-cursor-label="ANFRAGEN">
            Schaden melden <Arrow />
          </Link>
        </div>
      </section>
    </Landing>
  );
}
