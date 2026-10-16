import type { Metadata } from 'next';
import { Landing } from '@/components/layout/Landing';
import { TwoCol } from '@/components/sections/TwoCol';
import { DataPanel } from '@/components/sections/AnalysisScenes';
import { StructureScene } from '@/components/sections/TechScenes';
import { Reveal } from '@/components/ui/Reveal';
import { Slug } from '@/components/ui/Slug';
import { FAQS } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

const DESCRIPTION =
  'Unfallanalyse in Hannover: technische Auswertung von Schadenbild, Fahrzeugzustand und — je nach Fahrzeug und verfügbaren Daten — fahrzeugseitigen Informationen zum Unfallhergang.';

export const metadata: Metadata = buildMetadata({
  title: 'Unfallanalyse Hannover | Technische Auswertung nach dem Unfall',
  description: DESCRIPTION,
  path: '/unfallanalyse',
});

export default function Page() {
  return (
    <Landing
      eyebrow="Unfallanalyse"
      title="Was das Fahrzeug über den Unfall verrät."
      lead="Schadenbild, Spurenlage und Fahrzeugzustand ergeben zusammen ein technisches Bild des Hergangs. Je nach Fahrzeug, seinen Systemen und den verfügbaren Daten lassen sich zusätzlich fahrzeug- und unfallbezogene Informationen auswerten."
      chips={['Schadenbild', 'Fahrzeugzustand', 'Technische Auswertung', 'Plausibilität']}
      trail={[
        { name: 'Schadensgutachten', href: '/schadensgutachten' },
        { name: 'Unfallanalyse', href: '/unfallanalyse' },
      ]}
      service={{ name: 'Unfallanalyse', description: DESCRIPTION, path: '/unfallanalyse' }}
      faqs={[FAQS[0], FAQS[9], FAQS[5]]}
      related={[
        { title: 'EDR-Systeme', text: 'Ereignisbezogene Fahrzeugdaten und ihre Grenzen.', href: '/edr-systeme' },
        { title: 'Unfallrekonstruktion', text: 'Rekonstruktion des Ablaufs aus Positionen und Vektoren.', href: '/unfallrekonstruktion' },
        { title: 'Unfallgutachten', text: 'Die beweissichere Dokumentation nach dem Unfall.', href: '/unfallgutachten' },
      ]}
    >
      <TwoCol
        eyebrow="Grundlage"
        heading="Technik statt Erinnerung."
        asideTitle="Ausgewertet werden"
        asideItems={[
          'Schadenbild und Deformationsrichtung',
          'Spurenlage am Fahrzeug',
          'Fahrzeugzustand und Vorschäden',
          'Kompatibilität der beteiligten Schäden',
          'Fahrzeugseitige Daten, soweit verfügbar',
          'Angaben aus Unfallmitteilung und Akte',
        ]}
        icon="ruler"
      >
        <p>
          Nach einem Unfall widersprechen sich Schilderungen regelmäßig — nicht aus bösem Willen, sondern weil
          niemand einen Ablauf von wenigen Zehntelsekunden zuverlässig erinnert. Die technische Analyse arbeitet
          deshalb mit dem, was messbar geblieben ist.
        </p>
        <p>
          Zentrale Frage ist oft die Plausibilität: Passen die Schäden beider Fahrzeuge in Höhe, Richtung und
          Intensität zusammen? Lässt sich der geschilderte Hergang mit dem Schadenbild vereinbaren? Diese Fragen
          stellt auch die Versicherung — es ist besser, sie vorher beantwortet zu haben.
        </p>
        <p>
          Welche fahrzeugseitigen Informationen zusätzlich zur Verfügung stehen, hängt vom Fahrzeug, seinen
          Systemen und den vorhandenen Zugriffsmöglichkeiten ab. Eine pauschale Aussage lässt sich dazu nicht
          treffen.
        </p>
      </TwoCol>

      <section className="section">
        <div className="shell">
          <Slug left="Datenpanel" right="Beispielhafte Kennwerte" />
          <div className="grid gap-[clamp(2rem,5vw,4rem)] lg:grid-cols-[.9fr_1.1fr] lg:items-center">
            <div className="grid content-start gap-5">
              <p className="eyebrow">Fahrzeug- und Unfalldaten</p>
              <Reveal>
                <h2 className="display text-[clamp(1.6rem,3.6vw,2.6rem)]">
                  Werte, die ein Schadenbild
                  <br />
                  ergänzen können.
                </h2>
              </Reveal>
              <p className="text-fg-dim">
                Je nach Fahrzeug, seinen Systemen und den verfügbaren Daten lassen sich unfallbezogene
                Fahrzeuginformationen auslesen oder auswerten. Sie ersetzen die technische Begutachtung nicht,
                können sie aber stützen oder einer Schilderung widersprechen.
              </p>
              <p className="text-fg-mute">
                Die nebenstehenden Werte dienen ausschließlich der Veranschaulichung.
              </p>
            </div>
            <DataPanel />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell grid gap-[clamp(2rem,5vw,4rem)] lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <StructureScene />
          <div className="grid content-start gap-5">
            <p className="eyebrow">Deformation</p>
            <Reveal>
              <h2 className="display text-[clamp(1.6rem,3.6vw,2.6rem)]">Kraft nimmt einen Weg.</h2>
            </Reveal>
            <p className="text-fg-dim">
              Karosserien sind so konstruiert, dass Energie über definierte Bereiche abgebaut wird. Wie weit die
              Verformung reicht und welche Bauteile betroffen sind, lässt Rückschlüsse auf die eingeleitete Kraft
              zu — und damit auf die Intensität der Kollision.
            </p>
            <p className="text-fg-mute">
              Der Abgleich der Karosseriemaße gegen Herstellersollwerte zeigt außerdem, ob der Verzug über den
              sichtbaren Bereich hinausgeht.
            </p>
          </div>
        </div>
      </section>
    </Landing>
  );
}
