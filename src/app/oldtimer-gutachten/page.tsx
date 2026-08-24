import type { Metadata } from 'next';
import { Landing } from '@/components/layout/Landing';
import { TwoCol } from '@/components/sections/TwoCol';
import { FAQS } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

const DESCRIPTION =
  'Oldtimer-Gutachten in Hannover: Wertgutachten, Zustandsnote und Dokumentation für Klassiker und Youngtimer – als Grundlage für Versicherung, Verkauf oder H-Kennzeichen.';

export const metadata: Metadata = buildMetadata({
  title: 'Oldtimer-Gutachten Hannover | Wertgutachten für Klassiker',
  description: DESCRIPTION,
  path: '/oldtimer-gutachten',
});

export default function Page() {
  return (
    <Landing
      eyebrow="Oldtimer & Youngtimer"
      title="Ein Klassiker braucht mehr als eine Zahl."
      lead="Zustandsnote, Originalität, Restaurierungsqualität und Historie bestimmen den Wert – und gehören dokumentiert, bevor etwas passiert."
      chips={['Zustandsnote', 'Marktwert', 'Versicherungswert', 'Fotodokumentation']}
      trail={[
        { name: 'Leistungen', href: '/leistungen' },
        { name: 'Oldtimer', href: '/oldtimer-gutachten' },
      ]}
      service={{ name: 'Oldtimer-Wertgutachten', description: DESCRIPTION, path: '/oldtimer-gutachten' }}
      faqs={[FAQS[8], FAQS[2], FAQS[6]]}
      related={[
        { title: 'Wertgutachten', text: 'Bewertung für Alltagsfahrzeuge.', href: '/wertgutachten' },
        { title: 'Über uns', text: 'Erfahrung, Arbeitsweise und Anspruch.', href: '/ueber-uns' },
        { title: 'Kontakt & Termin', text: 'Begutachtung in der Garage oder Halle.', href: '/kontakt' },
      ]}
    >
      <TwoCol
        eyebrow="Bewertung"
        heading="Wie ein Klassiker bewertet wird."
        asideTitle="Bewertungskriterien"
        asideItems={[
          'Zustandsnote nach Kategorien',
          'Originalität und Vollständigkeit',
          'Restaurierungsqualität und -umfang',
          'Historie, Belege und Vorbesitzer',
          'Markt- und Wiederbeschaffungswert',
          'Umfassende Fotodokumentation',
        ]}
        icon="classic"
      >
        <p>
          Wir nehmen den Zustand in den üblichen Kategorien auf – Karosserie, Lack, Interieur, Technik,
          Unterboden – und ordnen das Fahrzeug einer Zustandsnote zu. Dazu kommen Originalität,
          Nachfertigungsteile, Restaurierungsstand und Belege zur Historie.
        </p>
        <p>
          Das Ergebnis nennt Wiederbeschaffungs- und Marktwert und liefert die Fotodokumentation, die Ihre
          Versicherung für eine korrekte Deckungssumme verlangt. Für die Einstufung als historisches Fahrzeug ist
          der dokumentierte Erhaltungszustand ebenfalls entscheidend.
        </p>
      </TwoCol>
    </Landing>
  );
}
