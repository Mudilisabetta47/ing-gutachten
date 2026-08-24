import type { Metadata } from 'next';
import { Landing } from '@/components/layout/Landing';
import { TwoCol } from '@/components/sections/TwoCol';
import { FlowTimeline } from '@/components/sections/FlowTimeline';
import { FAQS } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Ablauf der Schadenabwicklung | Kfz-Gutachten Hannover',
  description:
    'So läuft die Schadenabwicklung mit ING Gutachten in Hannover: Kontakt, Vor-Ort-Besichtigung, Gutachtenerstellung, Übermittlung an Versicherung und Anwalt, Regulierung. Fünf Schritte, klar erklärt.',
  path: '/ablauf',
});

export default function Page() {
  return (
    <Landing
      eyebrow="Ablauf"
      title="Fünf Schritte. Kein Papierkrieg."
      lead="Von der ersten Nachricht bis zur Auszahlung: Hier steht, was wann passiert, wie lange es dauert und was Sie dafür tun müssen – nämlich sehr wenig."
      chips={['Termin in 24–48 h', 'Gutachten in 1–2 Werktagen', 'Vor-Ort-Service']}
      trail={[{ name: 'Ablauf', href: '/ablauf' }]}
      faqs={[FAQS[2], FAQS[3], FAQS[9]]}
      related={[
        { title: 'Unfallgutachten', text: 'Rechte, Fristen und Positionen im Detail.', href: '/unfallgutachten' },
        { title: 'FAQ', text: 'Antworten auf die häufigsten Fragen.', href: '/faq' },
        { title: 'Kontakt & Termin', text: 'Anfrage in vier Schritten stellen.', href: '/kontakt' },
      ]}
    >
      <FlowTimeline withHeading={false} />

      <TwoCol
        eyebrow="Vorbereitung"
        heading="Was Sie zum Termin bereithalten sollten."
        asideTitle="Bitte bereithalten"
        asideItems={[
          'Fahrzeugschein (Zulassungsbescheinigung I)',
          'Daten des Unfallgegners und Versicherung',
          'Aktenzeichen der Polizei, falls aufgenommen',
          'Belege zu Vorschäden und Reparaturen',
          'Serviceheft bei Wertgutachten',
          'Nachweise über Sonderausstattung',
        ]}
        icon="doc"
      >
        <p>
          Viel ist es nicht: Fahrzeugschein, Ihre Kontaktdaten und – falls vorhanden – die Unfallmitteilung mit
          den Daten des Gegners und dem Aktenzeichen der Polizei. Reparaturrechnungen früherer Schäden helfen,
          Vorschäden sauber abzugrenzen.
        </p>
        <p>
          Das Fahrzeug muss nicht gewaschen sein, sollte aber zugänglich stehen. Bei nicht fahrbereiten Fahrzeugen
          kommen wir zum Abstellort oder zum Abschleppdienst.
        </p>
      </TwoCol>

      <TwoCol
        eyebrow="Danach"
        heading="Was mit dem Gutachten passiert."
        asideTitle="Ihre Optionen danach"
        asideItems={[
          'Reparatur in der Werkstatt Ihrer Wahl',
          'Abrechnung auf Gutachtenbasis',
          'Ersatzbeschaffung bei wirtschaftlichem Totalschaden',
          'Nutzungsausfall oder Mietwagen',
          'Stellungnahme bei Kürzungen',
        ]}
        icon="scale"
      >
        <p>
          Sie erhalten das fertige Gutachten digital. Auf Ihren Wunsch versenden wir es direkt an die gegnerische
          Versicherung und an Ihren Anwalt. Damit beginnt die Regulierungsfrist, und Sie können entscheiden:
          reparieren lassen, ein Ersatzfahrzeug beschaffen oder auf Gutachtenbasis abrechnen.
        </p>
        <p>
          Kürzt die Versicherung Positionen, nehmen wir dazu fachlich Stellung. Das ist Teil des Auftrags und
          kostet Sie nichts extra.
        </p>
      </TwoCol>
    </Landing>
  );
}
