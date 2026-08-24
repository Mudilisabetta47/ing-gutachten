import Link from 'next/link';
import type { Metadata } from 'next';
import { Hero } from '@/components/sections/Hero';
import { Ticker } from '@/components/sections/Ticker';
import { Stats } from '@/components/sections/Stats';
import { Position } from '@/components/sections/Position';
import { CrashSequence } from '@/components/sections/CrashSequence';
import { DamageConfigurator } from '@/components/sections/DamageConfigurator';
import { Services } from '@/components/sections/Services';
import { FlowTimeline } from '@/components/sections/FlowTimeline';
import { WhyGrid } from '@/components/sections/WhyGrid';
import { ServiceMap } from '@/components/sections/ServiceMap';
import { PhotoBand } from '@/components/sections/PhotoBand';
import { RequestSection } from '@/components/sections/RequestSection';
import { FaqList } from '@/components/sections/Faq';
import { CtaBand } from '@/components/sections/CtaBand';
import { Reveal } from '@/components/ui/Reveal';
import { Slug } from '@/components/ui/Slug';
import { Arrow } from '@/components/ui/Icon';
import { JsonLd } from '@/components/ui/JsonLd';
import { FAQS } from '@/lib/content';
import { buildMetadata, faqSchema, websiteSchema } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Kfz-Gutachter Hannover | ING Gutachten – Unfallgutachten & Kfz-Sachverständiger',
  description:
    'Unabhängiger Kfz-Gutachter in Hannover: Unfallgutachten, Schadengutachten, Wertgutachten für PKW, LKW, E-Fahrzeuge, Motorrad und Oldtimer. Vor-Ort-Service, Termin in 24–48 h. ☎ 0511 543 00 976',
  path: '/',
});

export default function HomePage() {
  return (
    <>
      <JsonLd data={[websiteSchema(), faqSchema(FAQS.slice(0, 6))]} />
      <Hero />
      <Ticker />
      <Stats />
      <Position />
      <CrashSequence />
      <DamageConfigurator />
      <Services />
      <FlowTimeline />
      <WhyGrid />

      <PhotoBand
        src="/assets/img/pruefstand-halle.webp"
        alt="Kfz-Sachverständiger vermisst ein Fahrzeug in der Prüfhalle"
        eyebrow="Aus der Prüfhalle"
        title={
          <>
            Gemessen wird,
            <br />
            was gemessen werden kann.
          </>
        }
        text="Achsvermessung, Karosseriemaße, Schichtdicke: Jede Zahl im Gutachten hat eine Quelle, die wir belegen können — kein Schätzwert, keine Pauschale."
        caption="ING Gutachten · Hannover"
      />

      <ServiceMap />
      <RequestSection />

      <section className="section" id="faq" aria-labelledby="home-faq-h">
        <div className="shell">
          <Slug left="FAQ" right="Häufige Fragen" />
          <div className="grid gap-[clamp(2rem,5vw,5rem)] lg:grid-cols-[.85fr_1.15fr]">
            <div className="grid content-start gap-6">
              <p className="eyebrow">Gut zu wissen</p>
              <Reveal>
                <h2 id="home-faq-h" className="display text-[clamp(1.9rem,4.4vw,3.4rem)]">
                  Die Fragen,
                  <br />
                  die alle stellen.
                </h2>
              </Reveal>
              <Link href="/faq" className="tlink">
                Alle Fragen ansehen <Arrow />
              </Link>
            </div>
            <FaqList items={FAQS.slice(0, 6)} />
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
