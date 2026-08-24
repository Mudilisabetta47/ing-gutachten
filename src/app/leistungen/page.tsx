import Link from 'next/link';
import type { Metadata } from 'next';
import { Landing } from '@/components/layout/Landing';
import { TwoCol } from '@/components/sections/TwoCol';
import { Stats } from '@/components/sections/Stats';
import { Tilt } from '@/components/ui/Tilt';
import { Icon, Arrow } from '@/components/ui/Icon';
import { Slug } from '@/components/ui/Slug';
import { SERVICES } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Leistungen | Kfz-Gutachten Hannover – Unfall, Wert, Oldtimer',
  description:
    'Alle Gutachtenarten des Kfz-Sachverständigenbüros ING in Hannover: Unfallgutachten, Schadengutachten, Wertgutachten, Kostenvoranschläge, Achs- und Karosserievermessung für PKW, LKW, E-Auto, Motorrad und Oldtimer.',
  path: '/leistungen',
});

const EXTRA = [
  {
    href: '/wertgutachten',
    icon: 'scale' as const,
    title: 'Wertgutachten',
    teaser: 'Marktwert, Wiederbeschaffungswert und Restwert – für Verkauf, Erbfall, Scheidung, Leasingrückgabe oder Versicherung.',
  },
  {
    href: '/ablauf',
    icon: 'ruler' as const,
    title: 'Achs- & Karosserievermessung',
    teaser: 'Messtechnische Prüfung von Achsgeometrie und Karosserie gegen Herstellersollwerte – als Teil des Gutachtens oder separat.',
  },
];

export default function Page() {
  return (
    <Landing
      eyebrow="Leistungsübersicht"
      title="Alle Gutachten aus einer Hand."
      lead="Ob Unfallschaden, Wertermittlung oder Kostenvoranschlag: Wir begutachten jedes Fahrzeug nach derselben Systematik – vollständig dokumentiert, unabhängig kalkuliert und kurzfristig verfügbar."
      chips={['PKW & Transporter', 'LKW & Nutzfahrzeuge', 'Elektro & Hybrid', 'Motorrad', 'Oldtimer', 'Bagatellschäden']}
      trail={[{ name: 'Leistungen', href: '/leistungen' }]}
      related={[
        { title: 'Unfallgutachten', text: 'Nach dem unverschuldeten Unfall: beweissichere Dokumentation für die gegnerische Versicherung.', href: '/unfallgutachten' },
        { title: 'Wertgutachten', text: 'Marktwert und Wiederbeschaffungswert belastbar ermittelt.', href: '/wertgutachten' },
        { title: 'Ablauf', text: 'Fünf Schritte von der Anfrage bis zur Regulierung.', href: '/ablauf' },
      ]}
    >
      <section className="section">
        <div className="shell">
          <Slug left="Leistungen" right="08 Bereiche" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[...SERVICES, ...EXTRA].map((s) => (
              <Tilt key={s.href} max={4}>
                <Link href={s.href} className="card h-full">
                  <span className="text-signal">
                    <Icon name={s.icon} />
                  </span>
                  <h2 className="font-display text-h3 font-semibold">{s.title}</h2>
                  <p className="text-fg-mute">{s.teaser}</p>
                  <span className="tlink text-signal">
                    Details <Arrow />
                  </span>
                </Link>
              </Tilt>
            ))}
          </div>
        </div>
      </section>

      <TwoCol
        eyebrow="Immer enthalten"
        heading="Was in jedem Gutachten steht."
        asideTitle="Inhalte des Gutachtens"
        asideItems={[
          'Schadenumfang und Reparaturweg',
          'Kalkulierte Reparaturkosten',
          'Wiederbeschaffungs- und Restwert',
          'Merkantile Wertminderung',
          'Nutzungsausfalldauer bzw. Mietwagenklasse',
          'Vorschäden und Altschäden',
          'Vollständige Fotodokumentation',
          'Achs- und Karosseriemesswerte bei Bedarf',
        ]}
        icon="doc"
      >
        <p>
          Ein Schadengutachten ist erst dann brauchbar, wenn die Gegenseite es nicht auseinandernehmen kann.
          Deshalb belegen wir jede Position – mit Fotos, Messwerten und einer Kalkulation nach
          herstellerspezifischen Arbeitswerten und regionalen Stundenverrechnungssätzen.
        </p>
        <p>
          Sie erhalten das Gutachten digital als PDF, auf Wunsch zusätzlich gedruckt. Versicherung und Anwalt
          bekommen es direkt von uns, damit die Regulierung ohne Zwischenschritte startet.
        </p>
      </TwoCol>

      <Stats />
    </Landing>
  );
}
