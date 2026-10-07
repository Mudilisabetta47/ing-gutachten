import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Landing } from '@/components/layout/Landing';
import { TwoCol } from '@/components/sections/TwoCol';
import { BIZ, FAQS, REGION_PAGES, REGION_PROFILES } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

type Params = { stadt: string };

/** Alle Regionalseiten werden zur Buildzeit statisch erzeugt. */
export function generateStaticParams(): Params[] {
  return REGION_PAGES.map((r) => ({ stadt: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { stadt } = await params;
  const region = REGION_PAGES.find((r) => r.slug === stadt);
  const profile = REGION_PROFILES[stadt];
  if (!region || !profile) return {};
  return buildMetadata({
    title: `Kfz-Gutachter ${region.name} | Unfallgutachten`,
    description: `Kfz-Gutachter für ${profile.areas.slice(0, 3).join(', ')}: Besichtigung vor Ort, Unfall- und Schadengutachten. Schaden melden oder anrufen: ${BIZ.phoneDisplay}.`,
    path: `/kfz-gutachter/${region.slug}`,
  });
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { stadt } = await params;
  const region = REGION_PAGES.find((r) => r.slug === stadt);
  const profile = REGION_PROFILES[stadt];
  if (!region || !profile) notFound();

  const neighbours = profile.near
    .map((slug) => REGION_PAGES.find((r) => r.slug === slug))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  return (
    <Landing
      eyebrow={`Vor Ort · ${region.name}`}
      title={`Kfz-Gutachter ${region.name}`}
      lead={`Unabhängige Kfz-Gutachten für ${region.name}: Wir besichtigen das Fahrzeug dort, wo es steht.`}
      chips={profile.areas}
      trail={[
        { name: 'Kfz-Gutachter Hannover', href: '/kfz-gutachter-hannover' },
        { name: `Kfz-Gutachter ${region.name}`, href: `/kfz-gutachter/${region.slug}` },
      ]}
      faqs={[FAQS[0], FAQS[1], FAQS[2]]}
      related={[
        { title: 'Kfz-Gutachter Hannover', text: 'Unser Büro und das gesamte Einsatzgebiet.', href: '/kfz-gutachter-hannover' },
        ...neighbours.map((o) => ({ title: `Kfz-Gutachter ${o.name}`, text: o.note, href: `/kfz-gutachter/${o.slug}` })),
        { title: 'Unfallgutachten', text: 'Beweissichere Dokumentation nach dem Unfall.', href: '/unfallgutachten' },
      ]}
    >
      <TwoCol
        eyebrow={`Einsatzgebiet ${region.name}`}
        heading={`Gutachten in ${region.name}.`}
        asideTitle="Abgedeckte Gebiete"
        asideItems={profile.areas}
        icon="pin"
      >
        <p>
          {profile.where} {region.note}
        </p>
        <p>
          Besichtigt wird, wo das Fahrzeug steht: {profile.places}. Nach einem unverschuldeten Unfall wählen Sie den
          Sachverständigen selbst; mehr dazu in den{' '}
          <Link href="/faq" className="text-signal-bright underline underline-offset-4">
            häufigen Fragen
          </Link>
          .
        </p>
        <p>
          Unser Büro finden Sie in der {BIZ.street}, {BIZ.zip} {BIZ.city}. Alle Leistungen und den Ablauf erklären wir
          auf der Seite{' '}
          <Link href="/kfz-gutachter-hannover" className="text-signal-bright underline underline-offset-4">
            Kfz-Gutachter Hannover
          </Link>
          .
        </p>
      </TwoCol>
    </Landing>
  );
}
