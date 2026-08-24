import type { Metadata } from 'next';
import { Landing } from '@/components/layout/Landing';
import { TwoCol } from '@/components/sections/TwoCol';
import { FAQS } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

const DESCRIPTION =
  'Gutachten für LKW, Transporter und Anhänger in Hannover: Schadengutachten, Wertermittlung und Ausfallschaden für Nutzfahrzeuge und Flotten. Vor-Ort-Termin auf dem Betriebsgelände.';

export const metadata: Metadata = buildMetadata({
  title: 'LKW-Gutachten Hannover | Nutzfahrzeuge & Transporter',
  description: DESCRIPTION,
  path: '/lkw-gutachten',
});

export default function Page() {
  return (
    <Landing
      eyebrow="LKW & Nutzfahrzeuge"
      title="Stillstand ist der teuerste Teil des Schadens."
      lead="Bei Nutzfahrzeugen zählt Tempo: Wir begutachten auf dem Betriebsgelände, beziffern den Ausfall und sorgen dafür, dass die Regulierung nicht am Papier hängt."
      chips={['Transporter', 'LKW', 'Anhänger & Auflieger', 'Flotten']}
      trail={[
        { name: 'Leistungen', href: '/leistungen' },
        { name: 'LKW & Nutzfahrzeuge', href: '/lkw-gutachten' },
      ]}
      service={{ name: 'LKW-Gutachten', description: DESCRIPTION, path: '/lkw-gutachten' }}
      faqs={[FAQS[2], FAQS[3], FAQS[6]]}
      related={[
        { title: 'Unfallgutachten', text: 'Grundlagen und Rechte nach dem Unfall.', href: '/unfallgutachten' },
        { title: 'Einsatzgebiet', text: 'Vor-Ort-Service in Hannover und Umgebung.', href: '/einsatzgebiet' },
        { title: 'Kontakt & Termin', text: 'Kurzfristigen Termin abstimmen.', href: '/kontakt' },
      ]}
    >
      <TwoCol
        eyebrow="Nutzfahrzeuge"
        heading="Was bei gewerblichen Fahrzeugen dazukommt."
        asideTitle="Zusätzlich im Blick"
        asideItems={[
          'Ausfallschaden und Vorhaltekosten',
          'Aufbauten, Kühl- und Ladetechnik',
          'Anhänger, Auflieger und Kupplungen',
          'Ladungssicherungssysteme',
          'Termine auf dem Betriebsgelände',
          'Sammelbegutachtung für Flotten',
        ]}
        icon="truck"
      >
        <p>
          Neben dem Sachschaden entsteht bei Nutzfahrzeugen ein Ausfallschaden, der belegt werden muss – über
          Vorhaltekosten oder konkret entgangenen Gewinn. Auch Aufbauten, Ladungssicherung, Kühltechnik und
          Sonderausstattung gehören vollständig erfasst.
        </p>
        <p>
          Wir stimmen Besichtigungstermine so ab, dass der Betrieb möglichst weiterläuft, und begutachten auf
          Wunsch mehrere Fahrzeuge einer Flotte in einem Durchgang.
        </p>
      </TwoCol>
    </Landing>
  );
}
