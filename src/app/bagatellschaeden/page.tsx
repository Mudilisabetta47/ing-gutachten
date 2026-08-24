import type { Metadata } from 'next';
import { Landing } from '@/components/layout/Landing';
import { TwoCol } from '@/components/sections/TwoCol';
import { FAQS } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

const DESCRIPTION =
  'Kostenvoranschlag für Bagatellschäden in Hannover: Parkschaden, Kratzer, Delle. Schnell, günstig und mit klarer Aussage, ob ein vollständiges Gutachten sinnvoller wäre.';

export const metadata: Metadata = buildMetadata({
  title: 'Bagatellschaden & Kostenvoranschlag Hannover',
  description: DESCRIPTION,
  path: '/bagatellschaeden',
});

export default function Page() {
  return (
    <Landing
      eyebrow="Bagatellschäden"
      title="Kleiner Schaden, klare Zahl."
      lead="Nicht jeder Schaden braucht ein vollständiges Gutachten. Unter der Bagatellgrenze ist ein Kostenvoranschlag schneller, günstiger und völlig ausreichend."
      chips={['Parkschaden', 'Kratzer & Dellen', 'Kostenvoranschlag', 'kurzfristig']}
      trail={[
        { name: 'Leistungen', href: '/leistungen' },
        { name: 'Bagatellschäden', href: '/bagatellschaeden' },
      ]}
      service={{ name: 'Kostenvoranschlag Bagatellschaden', description: DESCRIPTION, path: '/bagatellschaeden' }}
      faqs={[FAQS[4], FAQS[1], FAQS[2]]}
      related={[
        { title: 'Unfallgutachten', text: 'Wenn der Schaden größer ist als gedacht.', href: '/unfallgutachten' },
        { title: 'FAQ', text: 'Bagatellgrenze, Kosten und Ablauf im Detail.', href: '/faq' },
        { title: 'Kontakt & Termin', text: 'Kurz anrufen – wir schätzen es vorab ein.', href: '/kontakt' },
      ]}
    >
      <TwoCol
        eyebrow="Abgrenzung"
        heading="Kostenvoranschlag oder Gutachten?"
        asideTitle="Wann ein Gutachten besser ist"
        asideItems={[
          'Sichtbarer Schaden an Trägern oder Fahrwerk',
          'Beteiligte Sensorik oder Assistenzsysteme',
          'Junges Fahrzeug mit möglicher Wertminderung',
          'Strittige Schuldfrage',
          'Vorschäden im selben Bereich',
          'Fahrzeug nicht mehr fahrbereit',
        ]}
        icon="dent"
      >
        <p>
          Als Faustregel gilt eine Bagatellgrenze im Bereich von etwa 750 bis 1.000 Euro. Darunter erkennt die
          gegnerische Versicherung die Kosten eines vollständigen Gutachtens in der Regel nicht als
          erstattungsfähig an – ein Kostenvoranschlag ist dann der richtige Weg.
        </p>
        <p>
          Der Haken: Ob ein Schaden wirklich darunter liegt, sieht man ihm nicht immer an. Hinter einem
          unscheinbaren Parkrempler steckt schnell ein beschädigter Sensor oder ein verzogener Träger. Wir sehen
          uns den Schaden an und sagen Ihnen ehrlich, was er braucht – auch wenn das der günstigere Weg ist.
        </p>
      </TwoCol>
    </Landing>
  );
}
