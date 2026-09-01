import type { Metadata } from 'next';
import { Landing } from '@/components/layout/Landing';
import { TwoCol } from '@/components/sections/TwoCol';
import { DamageConfigurator } from '@/components/sections/DamageConfigurator';
import { SensorScene } from '@/components/sections/TechScenes';
import { Reveal } from '@/components/ui/Reveal';
import { Icon } from '@/components/ui/Icon';
import { Slug } from '@/components/ui/Slug';
import { FAQS } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

const DESCRIPTION =
  'PKW-Gutachten in Hannover: Schadenaufnahme, technische Bewertung, Reparaturkalkulation und Fahrzeugwert für Pkw und Transporter. Unabhängig, mit Vor-Ort-Service.';

export const metadata: Metadata = buildMetadata({
  title: 'PKW-Gutachten Hannover | Schadengutachten für Pkw & Transporter',
  description: DESCRIPTION,
  path: '/pkw-gutachten',
});

const DELIVERABLES = [
  { icon: 'dent' as const, title: 'Fahrzeugschaden', text: 'Vollständige Aufnahme aller beschädigten Bauteile mit Fotodokumentation.' },
  { icon: 'ruler' as const, title: 'Strukturschaden', text: 'Karosserie- und Achsvermessung gegen Herstellersollwerte.' },
  { icon: 'doc' as const, title: 'Reparaturkosten', text: 'Kalkulation nach Herstellerarbeitswerten und regionalen Sätzen.' },
  { icon: 'scale' as const, title: 'Fahrzeugwert', text: 'Wiederbeschaffungswert, Restwert und merkantile Wertminderung.' },
  { icon: 'shield' as const, title: 'Technische Bewertung', text: 'Einordnung von Vorschäden, Reparaturwürdigkeit und Totalschaden.' },
  { icon: 'clock' as const, title: 'Dokumentation', text: 'Digitales Gutachten, auf Wunsch direkt an Versicherung und Anwalt.' },
];

export default function Page() {
  return (
    <Landing
      eyebrow="PKW-Gutachten"
      title="Für Pkw und Transporter."
      lead="Vom Parkrempler bis zum wirtschaftlichen Totalschaden: Wir nehmen auf, messen nach, kalkulieren und bewerten — nachvollziehbar für jeden, der das Gutachten später prüft."
      chips={['Schadenaufnahme', 'Kalkulation', 'Wertminderung', 'Assistenzsysteme']}
      trail={[
        { name: 'Schadensgutachten', href: '/schadensgutachten' },
        { name: 'PKW-Gutachten', href: '/pkw-gutachten' },
      ]}
      service={{ name: 'PKW-Gutachten', description: DESCRIPTION, path: '/pkw-gutachten' }}
      faqs={[FAQS[5], FAQS[1], FAQS[4], FAQS[8]]}
      related={[
        { title: 'Unfallgutachten', text: 'Rechte, Fristen und Positionen nach dem Unfall.', href: '/unfallgutachten' },
        { title: 'Unfallanalyse', text: 'Technische Auswertung von Schadenbild und Fahrzeugdaten.', href: '/unfallanalyse' },
        { title: 'Wertgutachten', text: 'Wenn es um den Fahrzeugwert statt um einen Schaden geht.', href: '/wertgutachten' },
      ]}
    >
      <section className="section">
        <div className="shell">
          <Slug left="Umfang" right="06 Bestandteile" />
          <div className="mb-[clamp(2rem,5vw,3.5rem)] grid max-w-3xl gap-4">
            <p className="eyebrow">Was Sie bekommen</p>
            <Reveal>
              <h2 className="display text-[clamp(1.8rem,4vw,3rem)]">Sechs Antworten,
                <br />
                die Ihre Versicherung braucht.</h2>
            </Reveal>
          </div>

          <div className="grid gap-px overflow-hidden rounded-[22px] border border-line bg-line sm:grid-cols-2 xl:grid-cols-3">
            {DELIVERABLES.map((d, i) => (
              <Reveal
                key={d.title}
                delay={i * 0.06}
                className="grid content-start gap-3 bg-ink-900 p-[clamp(1.5rem,3vw,2.2rem)] transition-colors duration-500 hover:bg-ink-800"
              >
                <span className="text-signal-bright">
                  <Icon name={d.icon} />
                </span>
                <h3 className="font-display text-[1.15rem] font-semibold">{d.title}</h3>
                <p className="text-[.92rem] text-fg-mute">{d.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <DamageConfigurator />

      <section className="section">
        <div className="shell grid gap-[clamp(2rem,5vw,4rem)] lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <SensorScene />
          <div className="grid content-start gap-5">
            <p className="eyebrow">Assistenzsysteme &amp; Sensorik</p>
            <Reveal>
              <h2 className="display text-[clamp(1.6rem,3.6vw,2.6rem)]">Moderne Fahrzeuge sehen mit.</h2>
            </Reveal>
            <p className="text-fg-dim">
              Radar, Kameras und Ultraschallsensoren sitzen genau dort, wo bei einem Unfall zuerst etwas kaputtgeht:
              in Stoßfängern, Scheiben und Außenspiegeln. Nach Arbeiten an diesen Bauteilen ist häufig eine
              Kalibrierung nach Herstellervorgabe erforderlich.
            </p>
            <p className="text-fg-mute">
              Diese Kosten werden bei pauschalen Kalkulationen regelmäßig übersehen. Wir setzen sie an, wo sie
              anfallen, und begründen sie. Welche Systeme verbaut sind, hängt vom jeweiligen Fahrzeug ab.
            </p>
          </div>
        </div>
      </section>

      <TwoCol
        eyebrow="Ablauf"
        heading="Was am Fahrzeug tatsächlich passiert."
        asideTitle="Am Termin"
        asideItems={[
          'Fahrzeug- und Ausstattungsaufnahme',
          'Systematische Fotodokumentation',
          'Schichtdickenmessung zur Lackprüfung',
          'Achs- und Karosseriemessung bei Bedarf',
          'Prüfung auf Vor- und Altschäden',
          'Abstimmung des weiteren Vorgehens',
        ]}
        icon="car"
      >
        <p>
          Die Besichtigung dauert je nach Schaden 45 bis 90 Minuten. Das Fahrzeug muss nicht gewaschen sein,
          sollte aber zugänglich stehen. Ist es nicht fahrbereit, kommen wir zum Abstellort.
        </p>
        <p>
          Wichtig ist die Reihenfolge: erst begutachten, dann reparieren. Nach der Instandsetzung lässt sich der
          Zustand davor kaum noch belegen — und genau daran scheitern Ansprüche.
        </p>
      </TwoCol>
    </Landing>
  );
}
