import Link from 'next/link';
import type { Metadata } from 'next';
import { Landing } from '@/components/layout/Landing';
import { TwoCol } from '@/components/sections/TwoCol';
import { Stats } from '@/components/sections/Stats';
import { StructureScene } from '@/components/sections/TechScenes';
import { VehicleSelector } from '@/components/sections/ServiceScenes';
import { Tilt } from '@/components/ui/Tilt';
import { Icon, Arrow } from '@/components/ui/Icon';
import { Slug } from '@/components/ui/Slug';
import { Reveal } from '@/components/ui/Reveal';
import { ASSESSMENT_PAGES, FAQS } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

const DESCRIPTION =
  'Schadensgutachten vom unabhängigen Kfz-Sachverständigen in Hannover: Schadenaufnahme, technische Bewertung, Unfallanalyse und Dokumentation für Versicherung und Anwalt.';

export const metadata: Metadata = buildMetadata({
  title: 'Schadensgutachten Hannover | Kfz-Sachverständiger & Gutachter',
  description: DESCRIPTION,
  path: '/schadensgutachten',
});

export default function Page() {
  return (
    <Landing
      eyebrow="Gutachter · Schadensgutachten"
      title="Schäden werden bewertet, nicht geschätzt."
      lead="Nach einem Unfall entscheidet die technische Aufnahme darüber, was ersetzt wird. Wir dokumentieren den Schaden vollständig, messen nach und bewerten nachvollziehbar."
      chips={['Schadenaufnahme', 'Technische Bewertung', 'Unfallanalyse', 'Dokumentation']}
      trail={[{ name: 'Schadensgutachten', href: '/schadensgutachten' }]}
      service={{ name: 'Schadensgutachten', description: DESCRIPTION, path: '/schadensgutachten' }}
      faqs={[FAQS[0], FAQS[1], FAQS[5], FAQS[2]]}
      related={[
        { title: 'Ablauf', text: 'Von der Anfrage bis zur Regulierung in fünf Schritten.', href: '/ablauf' },
        { title: 'Einsatzgebiet', text: 'Vor-Ort-Service in Hannover und Umgebung.', href: '/einsatzgebiet' },
        { title: 'Kontakt & Termin', text: 'Unfall melden oder Gutachten anfordern.', href: '/kontakt' },
      ]}
    >
      <section className="section">
        <div className="shell">
          <Slug left="Leistungsbereiche" right="05 Themen" />
          <div className="mb-[clamp(2rem,5vw,3.5rem)] grid max-w-3xl gap-4">
            <p className="eyebrow">Was zum Schadensgutachten gehört</p>
            <Reveal>
              <h2 className="display text-[clamp(1.8rem,4vw,3rem)]">
                Ein Schaden, mehrere
                <br />
                technische Fragen.
              </h2>
            </Reveal>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {ASSESSMENT_PAGES.map((a) => (
              <Tilt key={a.href} max={4}>
                <Link href={a.href} className="card h-full">
                  <span className="text-signal-bright">
                    <Icon name={a.icon} />
                  </span>
                  <h3 className="font-display text-h3 font-semibold">{a.title}</h3>
                  <p className="text-fg-mute">{a.teaser}</p>
                  <span className="tlink text-signal-bright">
                    Ansehen <Arrow />
                  </span>
                </Link>
              </Tilt>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell grid gap-[clamp(2rem,5vw,4rem)] lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <StructureScene />
          <div className="grid content-start gap-5">
            <p className="eyebrow">Unter der Außenhaut</p>
            <Reveal>
              <h2 className="display text-[clamp(1.6rem,3.6vw,2.6rem)]">Strukturschäden sieht man nicht.</h2>
            </Reveal>
            <p className="text-fg-dim">
              Ob die tragende Struktur betroffen ist, entscheidet über Reparaturweg, Restwert und Wertminderung.
              Deshalb gleichen wir Karosseriemaße gegen Herstellersollwerte ab, statt uns auf den Blick auf das
              Blech zu verlassen.
            </p>
            <ul className="prose-ing">
              <li>Längsträger, Bodengruppe und Heckstruktur</li>
              <li>Achsgeometrie nach Bordsteinkontakt oder Kollision</li>
              <li>Spaltmaße als Hinweis auf Verzug</li>
            </ul>
          </div>
        </div>
      </section>

      <VehicleSelector />
      <Stats />

      <TwoCol
        eyebrow="Ergebnis"
        heading="Was Sie am Ende in der Hand halten."
        asideTitle="Im Gutachten enthalten"
        asideItems={[
          'Schadenumfang und Reparaturweg',
          'Kalkulierte Reparaturkosten',
          'Wiederbeschaffungs- und Restwert',
          'Merkantile Wertminderung',
          'Nutzungsausfalldauer bzw. Mietwagenklasse',
          'Vollständige Fotodokumentation',
        ]}
        icon="doc"
      >
        <p>
          Ein Gutachten ist erst dann brauchbar, wenn die Gegenseite es nicht auseinandernehmen kann. Jede
          Position bekommt deshalb einen Beleg: Fotos, Messwerte und eine Kalkulation nach herstellerspezifischen
          Arbeitswerten und regionalen Stundenverrechnungssätzen.
        </p>
        <p>
          Sie erhalten das Gutachten digital. Auf Wunsch geht es direkt an die regulierende Versicherung und an
          Ihren Anwalt, damit die Bearbeitung ohne Zwischenschritte startet.
        </p>
      </TwoCol>
    </Landing>
  );
}
