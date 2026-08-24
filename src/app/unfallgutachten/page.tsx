import type { Metadata } from 'next';
import { Landing } from '@/components/layout/Landing';
import { TwoCol } from '@/components/sections/TwoCol';
import { FlowTimeline } from '@/components/sections/FlowTimeline';
import { PhotoBand } from '@/components/sections/PhotoBand';
import { FAQS } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

const DESCRIPTION =
  'Unfallgutachten in Hannover vom unabhängigen Kfz-Sachverständigen: beweissichere Schadendokumentation, Wertminderung, Nutzungsausfall und Restwert. Kosten trägt bei Haftpflichtschäden die gegnerische Versicherung.';

export const metadata: Metadata = buildMetadata({
  title: 'Unfallgutachten Hannover | Unfallgutachter & Schadengutachten',
  description: DESCRIPTION,
  path: '/unfallgutachten',
});

export default function Page() {
  return (
    <Landing
      eyebrow="Unfall- & Schadengutachten"
      title="Nach dem Unfall zählt, was dokumentiert ist."
      lead="Wir nehmen den Schaden vollständig auf, beziffern jede Position und übergeben ein Gutachten, mit dem die gegnerische Versicherung arbeiten muss – nicht verhandeln kann."
      chips={['Haftpflichtschaden', 'Kaskoschaden', 'Wertminderung', 'Nutzungsausfall', 'Restwert']}
      trail={[
        { name: 'Leistungen', href: '/leistungen' },
        { name: 'Unfallgutachten', href: '/unfallgutachten' },
      ]}
      service={{ name: 'Unfallgutachten', description: DESCRIPTION, path: '/unfallgutachten' }}
      faqs={[FAQS[0], FAQS[1], FAQS[4], FAQS[5], FAQS[8], FAQS[9]]}
      related={[
        { title: 'Bagatellschäden', text: 'Kleiner Schaden? Dann reicht oft ein Kostenvoranschlag.', href: '/bagatellschaeden' },
        { title: 'Wertgutachten', text: 'Wenn es um den Fahrzeugwert statt um einen Schaden geht.', href: '/wertgutachten' },
        { title: 'Kontakt & Termin', text: 'Kurzfristige Terminvergabe, Vor-Ort-Service in Hannover.', href: '/kontakt' },
      ]}
    >
      <TwoCol
        eyebrow="Ihre Rechte"
        heading="Sie wählen den Sachverständigen. Nicht die Versicherung."
        asideTitle="Direkt nach dem Unfall"
        asideItems={[
          'Unfallstelle sichern, Personen versorgen',
          'Bei Personenschaden oder unklarer Schuld: Polizei rufen',
          'Fotos aus mehreren Abständen, auch vom Gegner-Kennzeichen',
          'Daten und Versicherung des Gegners notieren',
          'Keine Erklärung zur Schuldfrage unterschreiben',
          'Sachverständigen einschalten – vor der Reparatur',
        ]}
        icon="shield"
      >
        <p>
          Bei einem unverschuldeten Unfall haben Sie Anspruch auf ein eigenes, unabhängiges Gutachten. Die Kosten
          gehören zum Schaden und werden von der Haftpflichtversicherung des Unfallgegners getragen. Sie müssen
          keinen Prüfer akzeptieren, den die Gegenseite schickt.
        </p>
        <p>
          Wichtig ist die Reihenfolge: erst begutachten, dann reparieren. Ist das Fahrzeug bereits instandgesetzt,
          lässt sich der Zustand vor der Reparatur nur noch eingeschränkt belegen – und genau daran scheitern
          viele Ansprüche.
        </p>
        <p>
          Bei Kaskoschäden beauftragt in der Regel Ihr eigener Versicherer. Auch dann prüfen wir gern zusätzlich,
          ob die Kalkulation vollständig ist.
        </p>
      </TwoCol>

      <PhotoBand
        src="/assets/img/begutachtung-protokoll.webp"
        alt="Kfz-Sachverständiger nimmt einen Frontschaden auf und hält ihn im Prüfprotokoll fest"
        eyebrow="Beweissicherung"
        title={<>Erst dokumentieren.<br />Dann reparieren.</>}
        text="Ist das Fahrzeug einmal instandgesetzt, lässt sich der Zustand davor kaum noch belegen. Deshalb steht die Aufnahme am Anfang — nicht am Ende."
        caption="Schadenaufnahme · Hannover"
        height="clamp(340px, 55vh, 560px)"
      />

      <FlowTimeline />

      <TwoCol
        eyebrow="Positionen"
        heading="Die Posten, die am häufigsten fehlen."
        asideTitle="Häufig gekürzt – zu Unrecht"
        asideItems={[
          'Merkantile Wertminderung',
          'Verbringungs- und Probefahrtkosten',
          'Kalibrierung der Assistenzsysteme',
          'UPE-Aufschläge auf Ersatzteile',
          'Nutzungsausfall bzw. Mietwagenklasse',
          'Reinigungs- und Beilackierungskosten',
        ]}
        icon="scale"
      >
        <p>
          Reparaturkosten sind nur ein Teil Ihres Schadens. Regelmäßig übersehen oder gekürzt werden: die
          merkantile Wertminderung, die Verbringungskosten zur Lackiererei, die Kalibrierung von
          Fahrerassistenzsystemen nach Arbeiten an Front oder Scheibe, Ersatzteilpreisaufschläge sowie die
          korrekte Nutzungsausfallklasse.
        </p>
        <p>
          Wir setzen diese Positionen an, wo sie berechtigt sind, und begründen sie so, dass eine Kürzung nicht
          ohne fachliche Antwort bleibt.
        </p>
      </TwoCol>
    </Landing>
  );
}
