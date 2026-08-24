import type { Metadata } from 'next';
import { Landing } from '@/components/layout/Landing';
import { TwoCol } from '@/components/sections/TwoCol';
import { Stats } from '@/components/sections/Stats';
import { Figure } from '@/components/sections/Figure';
import { PhotoBand } from '@/components/sections/PhotoBand';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Über uns | Kfz-Sachverständigenbüro ING Gutachten Hannover',
  description:
    'ING Gutachten ist ein unabhängiges Kfz-Sachverständigenbüro in Hannover mit über 15 Jahren Erfahrung. Vor-Ort-Service, kurzfristige Termine, klare Gutachten für Geschädigte, Anwälte und Versicherungen.',
  path: '/ueber-uns',
});

export default function Page() {
  return (
    <Landing
      eyebrow="Über das Büro"
      title="Unabhängig. Erreichbar. Genau."
      lead="Über 15 Jahre Erfahrung in der Schadenbewertung – und die Überzeugung, dass ein Gutachten nur so gut ist wie seine Nachvollziehbarkeit."
      chips={['seit über 15 Jahren', 'Hildesheimer Straße 229', 'Vor-Ort-Service', 'unabhängig']}
      trail={[{ name: 'Über uns', href: '/ueber-uns' }]}
      related={[
        { title: 'Ablauf', text: 'Wie eine Beauftragung konkret läuft.', href: '/ablauf' },
        { title: 'Leistungen', text: 'Alle Gutachtenarten im Überblick.', href: '/leistungen' },
        { title: 'Kontakt & Termin', text: 'Direkt sprechen oder Anfrage senden.', href: '/kontakt' },
      ]}
    >
      <TwoCol
        eyebrow="Haltung"
        heading="Wofür wir stehen."
        asideTitle="Schwerpunkte"
        asideItems={[
          'Unfall- und Schadengutachten',
          'Wert- und Zustandsgutachten',
          'Achs- und Karosserievermessung',
          'Elektro- und Hybridfahrzeuge',
          'Nutzfahrzeuge und Flotten',
          'Oldtimer und Youngtimer',
        ]}
        icon="shield"
      >
        <p>
          ING Gutachten ist ein unabhängiges Kfz-Sachverständigenbüro mit Sitz in der Hildesheimer Straße in
          Hannover. Wir arbeiten für Fahrzeughalter, Anwälte, Werkstätten und Unternehmen – aber nicht im Auftrag
          von Versicherern, deren Interesse an einer niedrigen Schadensumme systembedingt ist.
        </p>
        <p>
          Unsere Arbeitsweise ist unspektakulär und darauf ausgelegt, dass Sie nicht nachfragen müssen: erreichbar
          bleiben, kurzfristig kommen, sauber messen, verständlich schreiben. Ein Gutachten, das eine
          Regulierungsstelle ohne Rückfragen bearbeiten kann, ist für alle Beteiligten der schnellste Weg.
        </p>
        <p>
          Wenn wir zum Ergebnis kommen, dass ein Kostenvoranschlag genügt, sagen wir das – auch wenn das für uns
          der kleinere Auftrag ist.
        </p>
      </TwoCol>

      <PhotoBand
        src="/assets/img/team-begutachtung.webp"
        alt="Team von ING Gutachten bei der gemeinsamen Schadenaufnahme an einem Fahrzeug"
        eyebrow="Im Einsatz"
        title={<>Vier Augen sehen mehr.</>}
        text="Bei größeren Schäden nehmen wir gemeinsam auf: einer dokumentiert, einer misst. Das reduziert Rückfragen der Versicherung — und Fehler."
        caption="Schadenaufnahme · Lackierkabine"
        height="clamp(340px, 55vh, 560px)"
      />

      <Stats />

      <section className="section-tight">
        <div className="shell grid gap-[clamp(2rem,5vw,4rem)] lg:grid-cols-[1.15fr_.85fr] lg:items-center">
          <Figure
            src="/assets/img/begutachtung-protokoll.webp"
            alt="Sachverständiger dokumentiert einen Frontschaden mit Prüfprotokoll"
            caption="Befundaufnahme mit Prüfprotokoll"
            ratio="3 / 2"
          />
          <div className="grid content-start gap-5">
            <p className="eyebrow">Arbeitsweise</p>
            <h2 className="display text-[clamp(1.6rem,3.4vw,2.4rem)]">Jede Position bekommt einen Beleg.</h2>
            <p className="text-fg-dim">
              Fotodokumentation, Messwerte, Kalkulationsgrundlage: Wir arbeiten so, dass eine Regulierungsstelle
              das Gutachten ohne Rückfrage bearbeiten kann. Das ist der schnellste Weg zu Ihrem Geld.
            </p>
          </div>
        </div>
      </section>

      <TwoCol
        eyebrow="Technik"
        heading="Messen statt schätzen."
        asideTitle="Im Einsatz"
        asideItems={[
          'Achsvermessung mit Protokoll',
          'Karosserievermessung',
          'Lackschichtdickenmessung',
          'Diagnose- und Fehlerspeicherauslesung nach Bedarf',
          'Kalkulation nach Herstellerarbeitswerten',
          'Digitale Fotodokumentation',
        ]}
        icon="ruler"
      >
        <p>
          Achsvermessung, Karosserievermessung gegen Herstellersollwerte, Schichtdickenmessung zur Lackprüfung,
          systematische Fotodokumentation: Was messbar ist, wird gemessen. Das macht Gutachten belastbar – gerade
          dann, wenn die Gegenseite Positionen bestreitet.
        </p>
        <p>
          Kalkuliert wird nach herstellerspezifischen Arbeitswerten und den regionalen Stundenverrechnungssätzen
          im Raum Hannover, nicht nach Pauschalen.
        </p>
      </TwoCol>
    </Landing>
  );
}
