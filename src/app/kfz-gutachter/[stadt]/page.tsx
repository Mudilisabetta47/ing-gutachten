import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Landing } from '@/components/layout/Landing';
import { TwoCol } from '@/components/sections/TwoCol';
import { Stats } from '@/components/sections/Stats';
import { FAQS, REGION_PAGES } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

type Params = { stadt: string };

/** Alle Regionalseiten werden zur Buildzeit statisch erzeugt. */
export function generateStaticParams(): Params[] {
  return REGION_PAGES.map((r) => ({ stadt: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { stadt } = await params;
  const region = REGION_PAGES.find((r) => r.slug === stadt);
  if (!region) return {};
  return buildMetadata({
    title: `Kfz-Gutachter ${region.name} | Unfallgutachten & Kfz-Sachverständiger`,
    description: `Kfz-Gutachter für ${region.name}: unabhängige Unfallgutachten, Schadengutachten und Wertgutachten mit Vor-Ort-Service. Termin in 24–48 Stunden. ☎ 0511 543 00 976`,
    path: `/kfz-gutachter/${region.slug}`,
  });
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { stadt } = await params;
  const region = REGION_PAGES.find((r) => r.slug === stadt);
  if (!region) notFound();

  const others = REGION_PAGES.filter((r) => r.slug !== region.slug).slice(0, 3);

  return (
    <Landing
      eyebrow={`Standort · ${region.name}`}
      title={`Kfz-Gutachter ${region.name}`}
      lead={`Unabhängige Kfz-Gutachten in ${region.name} und der Region Hannover – mit Vor-Ort-Besichtigung und kurzfristiger Terminvergabe.`}
      chips={['Unfallgutachten', 'Wertgutachten', 'Vor-Ort-Service', '24–48 h Termin']}
      trail={[
        { name: 'Einsatzgebiet', href: '/einsatzgebiet' },
        { name: `Kfz-Gutachter ${region.name}`, href: `/kfz-gutachter/${region.slug}` },
      ]}
      faqs={[FAQS[0], FAQS[1], FAQS[2], FAQS[6]]}
      related={others.map((o) => ({
        title: `Kfz-Gutachter ${o.name}`,
        text: o.note,
        href: `/kfz-gutachter/${o.slug}`,
      }))}
    >
      <TwoCol
        eyebrow={`Vor Ort in ${region.name}`}
        heading={`Kfz-Gutachten in ${region.name} – ohne Umwege.`}
        asideTitle={`Leistungen in ${region.name}`}
        asideItems={[
          'Unfall- und Schadengutachten',
          'Wertgutachten und Fahrzeugbewertung',
          'Kostenvoranschlag bei Bagatellschäden',
          'Elektro-, Hybrid- und Nutzfahrzeuge',
          'Motorrad und Oldtimer',
          'Achs- und Karosserievermessung',
        ]}
        icon="pin"
      >
        <p>
          Als unabhängiges Kfz-Sachverständigenbüro aus Hannover sind wir regelmäßig in {region.name} im Einsatz.{' '}
          {region.note} Wir kommen zum Fahrzeug: nach Hause, in die Werkstatt, auf den Betriebshof oder an den
          Unfallort – die Anfahrt innerhalb des Einsatzgebiets berechnen wir nicht extra.
        </p>
        <p>
          Nach einem unverschuldeten Unfall wählen Sie den Sachverständigen selbst. Die Kosten des Gutachtens
          trägt bei Haftpflichtschäden die gegnerische Versicherung. Wir dokumentieren den Schaden beweissicher,
          beziffern Wertminderung und Nutzungsausfall und übermitteln das Gutachten auf Wunsch direkt an
          Versicherung und Anwalt.
        </p>
        <p>
          Für kleinere Schäden in {region.name} erstellen wir einen Kostenvoranschlag – schneller und günstiger
          als ein vollständiges Gutachten. Was in Ihrem Fall sinnvoll ist, klären wir vorab am Telefon.
        </p>
      </TwoCol>

      <Stats />
    </Landing>
  );
}
