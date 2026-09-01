import type { Metadata } from 'next';
import { Landing } from '@/components/layout/Landing';
import { TwoCol } from '@/components/sections/TwoCol';
import { DataFlowScene, DataPanel } from '@/components/sections/AnalysisScenes';
import { Reveal } from '@/components/ui/Reveal';
import { Slug } from '@/components/ui/Slug';
import { FAQS } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

const DESCRIPTION =
  'EDR-Systeme im Fahrzeug: Bestimmte moderne Fahrzeuge können ereignisbezogene Informationen speichern, die je nach Fahrzeug und System eine technische Unfallanalyse unterstützen können.';

export const metadata: Metadata = buildMetadata({
  title: 'EDR-Systeme | Ereignisbezogene Fahrzeugdaten nach einem Unfall',
  description: DESCRIPTION,
  path: '/edr-systeme',
});

export default function Page() {
  return (
    <Landing
      eyebrow="EDR-Systeme"
      title="Ereignisdaten aus dem Fahrzeug."
      lead="Bestimmte moderne Fahrzeuge können ereignisbezogene Informationen speichern. Ob und in welchem Umfang solche Daten vorliegen, hängt vom Fahrzeug, dem verbauten System und den rechtlichen wie technischen Zugriffsmöglichkeiten ab."
      chips={['Event Data Recorder', 'Ereignisfenster', 'Auswertung', 'fahrzeugabhängig']}
      trail={[
        { name: 'Schadensgutachten', href: '/schadensgutachten' },
        { name: 'EDR-Systeme', href: '/edr-systeme' },
      ]}
      service={{ name: 'Auswertung ereignisbezogener Fahrzeugdaten', description: DESCRIPTION, path: '/edr-systeme' }}
      faqs={[FAQS[7], FAQS[0], FAQS[5]]}
      related={[
        { title: 'Unfallanalyse', text: 'Technische Auswertung von Schadenbild und Fahrzeugzustand.', href: '/unfallanalyse' },
        { title: 'Unfallrekonstruktion', text: 'Rekonstruktion des Ablaufs aus Positionen und Vektoren.', href: '/unfallrekonstruktion' },
        { title: 'Kontakt & Termin', text: 'Fall schildern und Vorgehen abstimmen.', href: '/kontakt' },
      ]}
    >
      <section className="section">
        <div className="shell">
          <Slug left="Datenfluss" right="04 Stationen" />
          <div className="mb-[clamp(2rem,5vw,3.5rem)] grid max-w-3xl gap-4">
            <p className="eyebrow">Vom Steuergerät zur Auswertung</p>
            <Reveal>
              <h2 className="display text-[clamp(1.8rem,4vw,3rem)]">
                Ein kurzes Zeitfenster
                <br />
                rund um das Ereignis.
              </h2>
            </Reveal>
          </div>
          <DataFlowScene />
        </div>
      </section>

      <TwoCol
        eyebrow="Einordnung"
        heading="Was ein EDR ist — und was nicht."
        asideTitle="Wichtig zu wissen"
        asideItems={[
          'Nicht jedes Fahrzeug verfügt über ein solches System',
          'Umfang und Art der Daten unterscheiden sich je nach Hersteller',
          'Gespeichert wird typischerweise nur ein kurzes Zeitfenster',
          'Der Zugriff setzt technische und rechtliche Voraussetzungen voraus',
          'Die Daten ersetzen keine Begutachtung, sondern ergänzen sie',
          'Die Auswertung erfolgt im Abgleich mit dem Schadenbild',
        ]}
        icon="bolt"
      >
        <p>
          Ein Event Data Recorder ist kein Fahrtenschreiber und keine Dauerüberwachung. Gespeichert werden
          typischerweise Zustandsgrößen aus einem kurzen Zeitraum rund um ein auslösendes Ereignis — etwa das
          Ansprechen von Rückhaltesystemen.
        </p>
        <p>
          Ob ein Fahrzeug solche Daten vorhält, in welchem Umfang und in welcher Form, unterscheidet sich
          erheblich. Pauschale Aussagen wie „jedes moderne Auto speichert den Unfall" sind schlicht falsch.
        </p>
        <p>
          Kommt eine Auswertung in Betracht, klären wir zunächst die Voraussetzungen: Fahrzeug, System,
          Zugriffsmöglichkeit und Berechtigung. Erst danach lässt sich sagen, ob dieser Weg im konkreten Fall
          überhaupt weiterführt.
        </p>
      </TwoCol>

      <section className="section">
        <div className="shell grid gap-[clamp(2rem,5vw,4rem)] lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <div className="grid content-start gap-5">
            <p className="eyebrow">Beispielhafte Werte</p>
            <Reveal>
              <h2 className="display text-[clamp(1.6rem,3.6vw,2.6rem)]">Zahlen brauchen Kontext.</h2>
            </Reveal>
            <p className="text-fg-dim">
              Ausgelesene Werte sind für sich genommen wenig wert. Erst der Abgleich mit Schadenbild, Spurenlage
              und Fahrzeugzustand ergibt ein belastbares Bild — und zeigt, ob die Angaben zueinander passen.
            </p>
            <p className="text-fg-mute">
              Die dargestellten Kennwerte sind Beispiele und stammen nicht aus einem konkreten Fall.
            </p>
          </div>
          <DataPanel />
        </div>
      </section>
    </Landing>
  );
}
