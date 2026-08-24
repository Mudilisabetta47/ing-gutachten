import type { Metadata } from 'next';
import { Landing } from '@/components/layout/Landing';
import { TwoCol } from '@/components/sections/TwoCol';
import { FAQS } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

const DESCRIPTION =
  'Gutachten für Elektro- und Hybridfahrzeuge in Hannover: Hochvoltsystem, Batteriegehäuse, Ladetechnik und Assistenzsysteme werden gesondert bewertet. Unabhängiger Kfz-Sachverständiger, Termin in 24–48 h.';

export const metadata: Metadata = buildMetadata({
  title: 'E-Auto & Hybrid Gutachten Hannover | Kfz-Sachverständiger',
  description: DESCRIPTION,
  path: '/e-auto-hybrid-gutachten',
});

export default function Page() {
  return (
    <Landing
      eyebrow="Elektro & Hybrid"
      title="Ein E-Auto ist kein Verbrenner mit Akku."
      lead="Nach einem Schaden entscheidet die Frage, ob Hochvoltsystem und Batterie betroffen sind, über Reparaturweg, Restwert und Sicherheit. Genau das prüfen wir gesondert."
      chips={['Hochvoltsystem', 'Batteriegehäuse', 'Ladetechnik', 'Assistenzsysteme']}
      trail={[
        { name: 'Leistungen', href: '/leistungen' },
        { name: 'Elektro & Hybrid', href: '/e-auto-hybrid-gutachten' },
      ]}
      service={{ name: 'Gutachten für Elektro- und Hybridfahrzeuge', description: DESCRIPTION, path: '/e-auto-hybrid-gutachten' }}
      faqs={[FAQS[7], FAQS[2], FAQS[5]]}
      related={[
        { title: 'Unfallgutachten', text: 'Der allgemeine Ablauf nach einem Unfallschaden.', href: '/unfallgutachten' },
        { title: 'Leistungen', text: 'Alle Gutachtenarten im Überblick.', href: '/leistungen' },
        { title: 'Kontakt & Termin', text: 'Termin für die Begutachtung vereinbaren.', href: '/kontakt' },
      ]}
    >
      <TwoCol
        eyebrow="Prüfumfang"
        heading="Was bei E- und Hybridfahrzeugen zusätzlich zählt."
        asideTitle="Zusätzliche Prüfpunkte"
        asideItems={[
          'Sichtprüfung Batteriegehäuse und Unterboden',
          'Notwendigkeit einer HV-Diagnose',
          'Ladeanschluss, Ladeelektronik und Kabelbaum',
          'Thermomanagement und Kühlkreislauf',
          'Kalibrierung von Kamera-, Radar- und Ultraschallsensorik',
          'Vorgaben zu Quarantäne-Abstellplatz und Abschleppweg',
        ]}
        icon="bolt"
      >
        <p>
          Ein Unterbodenkontakt, der beim Verbrenner ein Kratzer wäre, kann beim Elektrofahrzeug das
          Batteriegehäuse betreffen – mit erheblichen Folgekosten. Umgekehrt kalkulieren Versicherer gelegentlich
          einen Batterietausch, wo eine Prüfung genügt hätte.
        </p>
        <p>
          Wir bewerten, ob eine Hochvolt-Diagnose oder Batterieprüfung nach Herstellervorgabe notwendig ist,
          dokumentieren Freischaltung und Prüfschritte und berücksichtigen die besonderen Vorgaben an Abstellort
          und Transport beschädigter Fahrzeuge.
        </p>
      </TwoCol>

      <TwoCol
        eyebrow="Werte"
        heading="Restwert und Wertminderung bei Elektrofahrzeugen."
        asideTitle="Häufige Streitpunkte"
        asideItems={[
          'Pauschaler Batterietausch statt Prüfung',
          'Nicht angesetzte Kalibrierkosten',
          'Restwertangebote ohne Batteriezustand',
          'Fehlende Nutzungsausfallklasse für E-Modelle',
        ]}
        icon="scale"
      >
        <p>
          Der Markt für gebrauchte Elektrofahrzeuge bewegt sich schneller als der klassische Gebrauchtwagenmarkt.
          Restwertangebote schwanken erheblich, und ein dokumentierter Batteriezustand beeinflusst den Preis
          spürbar.
        </p>
        <p>
          Wir berücksichtigen aktuelle Marktdaten und weisen aus, welche Annahmen dem Wert zugrunde liegen – damit
          die Zahl nachvollziehbar bleibt.
        </p>
      </TwoCol>
    </Landing>
  );
}
