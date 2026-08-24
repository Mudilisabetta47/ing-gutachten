import type { Metadata } from 'next';
import { Landing } from '@/components/layout/Landing';
import { TwoCol } from '@/components/sections/TwoCol';
import { FAQS } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

const DESCRIPTION =
  'Wertgutachten und Fahrzeugbewertung in Hannover: Marktwert, Wiederbeschaffungswert und Restwert – für Verkauf, Erbfall, Scheidung, Leasingrückgabe, Finanzierung oder Versicherung.';

export const metadata: Metadata = buildMetadata({
  title: 'Wertgutachten Hannover | Fahrzeugbewertung & Marktwert',
  description: DESCRIPTION,
  path: '/wertgutachten',
});

export default function Page() {
  return (
    <Landing
      eyebrow="Wertgutachten & Bewertung"
      title="Was Ihr Fahrzeug wirklich wert ist."
      lead="Ein belastbares Wertgutachten ersetzt Verhandlungsgefühl durch Zahlen – dokumentiert, begründet und gegenüber Dritten verwendbar."
      chips={['Marktwert', 'Wiederbeschaffungswert', 'Restwert', 'Leasingrückgabe']}
      trail={[
        { name: 'Leistungen', href: '/leistungen' },
        { name: 'Wertgutachten', href: '/wertgutachten' },
      ]}
      service={{ name: 'Wertgutachten', description: DESCRIPTION, path: '/wertgutachten' }}
      faqs={[FAQS[8], FAQS[2], FAQS[3]]}
      related={[
        { title: 'Oldtimer-Gutachten', text: 'Zustandsnote und Marktwert für Klassiker.', href: '/oldtimer-gutachten' },
        { title: 'Unfallgutachten', text: 'Nach einem Schaden statt vor dem Verkauf.', href: '/unfallgutachten' },
        { title: 'Kontakt & Termin', text: 'Termin für die Bewertung vereinbaren.', href: '/kontakt' },
      ]}
    >
      <TwoCol
        eyebrow="Anlässe"
        heading="Wann sich ein Wertgutachten lohnt."
        asideTitle="Typische Anlässe"
        asideItems={[
          'Verkauf und Ankauf',
          'Erbauseinandersetzung',
          'Scheidung und Zugewinn',
          'Leasingrückgabe und Minderwertprüfung',
          'Versicherungswert und Deckungssumme',
          'Finanzierung und Beleihung',
        ]}
        icon="scale"
      >
        <p>
          Beim Verkauf schafft es Vertrauen und verhindert Preisdrückerei. Bei Erbfall oder Trennung liefert es
          eine neutrale Grundlage. Vor der Leasingrückgabe zeigt es, welche Schäden tatsächlich berechnet werden
          dürfen – und welche als übliche Gebrauchsspuren gelten.
        </p>
        <p>
          Für Versicherungen ist der Wert die Basis der Deckungssumme: gerade bei Fahrzeugen mit
          Sonderausstattung, Umbauten oder Klassikerstatus weicht der reale Marktwert deutlich von pauschalen
          Listenwerten ab.
        </p>
      </TwoCol>

      <TwoCol
        eyebrow="Methodik"
        heading="Wie wir den Wert ermitteln."
        asideTitle="Im Gutachten enthalten"
        asideItems={[
          'Fahrzeug- und Ausstattungsaufnahme',
          'Zustandsbewertung innen, außen, technisch',
          'Lack- und Schichtdickenmessung',
          'Vorschadenprüfung',
          'Markt- und Vergleichswertanalyse',
          'Wiederbeschaffungs- und Händlereinkaufswert',
        ]}
        icon="ruler"
      >
        <p>
          Grundlage sind Zustandsaufnahme, Ausstattungs- und Historienprüfung sowie eine Auswertung des aktuellen
          regionalen Marktes. Dazu kommen Schichtdickenmessung zur Lackprüfung, Kontrolle auf Unfall- und
          Vorschäden und die Bewertung von Wartungszustand und Dokumentation.
        </p>
        <p>
          Das Ergebnis ist kein einzelner Schätzwert, sondern eine nachvollziehbare Herleitung – inklusive
          Fotodokumentation und Angabe der herangezogenen Vergleichsdaten.
        </p>
      </TwoCol>
    </Landing>
  );
}
