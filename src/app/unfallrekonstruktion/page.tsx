import type { Metadata } from 'next';
import { Landing } from '@/components/layout/Landing';
import { TwoCol } from '@/components/sections/TwoCol';
import { ReconstructionScene } from '@/components/sections/AnalysisScenes';
import { Reveal } from '@/components/ui/Reveal';
import { Slug } from '@/components/ui/Slug';
import { FAQS } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

const DESCRIPTION =
  'Unfallrekonstruktion in Hannover: Rekonstruktion des Unfallhergangs aus Fahrzeugpositionen, Bewegungsrichtungen, Kollisionspunkt und Schadenbild.';

export const metadata: Metadata = buildMetadata({
  title: 'Unfallrekonstruktion Hannover | Rekonstruktion des Unfallhergangs',
  description: DESCRIPTION,
  path: '/unfallrekonstruktion',
});

export default function Page() {
  return (
    <Landing
      eyebrow="Unfallrekonstruktion"
      title="Den Hergang technisch nachvollziehen."
      lead="Aus Fahrzeugpositionen, Bewegungsrichtungen, Kollisionspunkt und Schadenbild lässt sich der Ablauf eines Unfalls technisch nachzeichnen — unabhängig davon, wer sich woran erinnert."
      chips={['Fahrzeugpositionen', 'Kollisionspunkt', 'Bewegungsrichtung', 'Schadenbild']}
      trail={[
        { name: 'Schadensgutachten', href: '/schadensgutachten' },
        { name: 'Unfallrekonstruktion', href: '/unfallrekonstruktion' },
      ]}
      service={{ name: 'Unfallrekonstruktion', description: DESCRIPTION, path: '/unfallrekonstruktion' }}
      faqs={[FAQS[9], FAQS[0], FAQS[2]]}
      related={[
        { title: 'Unfallanalyse', text: 'Technische Auswertung von Schadenbild und Fahrzeugzustand.', href: '/unfallanalyse' },
        { title: 'EDR-Systeme', text: 'Ereignisbezogene Fahrzeugdaten und ihre Grenzen.', href: '/edr-systeme' },
        { title: 'Kontakt & Termin', text: 'Fall schildern und Vorgehen abstimmen.', href: '/kontakt' },
      ]}
    >
      <section className="section">
        <div className="shell">
          <Slug left="Rekonstruktion" right="Schematische Darstellung" />
          <div className="mb-[clamp(2rem,5vw,3.5rem)] grid max-w-3xl gap-4">
            <p className="eyebrow">Positionen, Richtungen, Kräfte</p>
            <Reveal>
              <h2 className="display text-[clamp(1.8rem,4vw,3rem)]">
                Der Ablauf wird
                <br />
                zur Zeichnung.
              </h2>
            </Reveal>
          </div>
          <ReconstructionScene />
        </div>
      </section>

      <TwoCol
        eyebrow="In Vorbereitung"
        heading="Ausführliche Informationen folgen."
        asideTitle="Bereits möglich"
        asideItems={[
          'Aufnahme und Dokumentation der Schäden',
          'Beurteilung der Deformationsrichtung',
          'Plausibilitätsprüfung des geschilderten Hergangs',
          'Abgleich der Schäden beider Fahrzeuge',
          'Auswertung verfügbarer Fahrzeugdaten',
        ]}
        icon="scale"
      >
        <p className="notice">
          Ausführliche Informationen zur Unfallrekonstruktion werden in Kürze ergänzt.
        </p>
        <p>
          Wenn in Ihrem Fall der Hergang strittig ist — etwa weil die Schilderungen auseinandergehen oder die
          Versicherung die Kompatibilität der Schäden bezweifelt —, sprechen Sie uns an. Wir sagen Ihnen, welche
          Grundlagen im konkreten Fall vorhanden sind und welches Vorgehen sinnvoll ist.
        </p>
      </TwoCol>
    </Landing>
  );
}
