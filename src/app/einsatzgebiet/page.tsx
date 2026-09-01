import Link from 'next/link';
import type { Metadata } from 'next';
import { Landing } from '@/components/layout/Landing';
import { ServiceMap } from '@/components/sections/ServiceMap';
import { Tilt } from '@/components/ui/Tilt';
import { Arrow } from '@/components/ui/Icon';
import { Slug } from '@/components/ui/Slug';
import { REGION_PAGES } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Einsatzgebiet | Kfz-Gutachter Hannover & Umgebung',
  description:
    'Vor-Ort-Service als Kfz-Gutachter in Hannover und Umgebung: Laatzen, Langenhagen, Garbsen, Seelze, Wunstorf, Pattensen, Linden, Döhren, Misburg und mehr. Besichtigung dort, wo das Fahrzeug steht.',
  path: '/einsatzgebiet',
});

export default function Page() {
  return (
    <Landing
      eyebrow="Vor-Ort-Service"
      title="Hannover und Umgebung."
      lead="Wir begutachten dort, wo das Fahrzeug steht – zu Hause, in der Werkstatt, auf dem Betriebsgelände oder am Unfallort. Die Anfahrt im Einsatzgebiet berechnen wir nicht extra."
      chips={['Hannover', 'Region Hannover', 'Vor-Ort-Termine', 'ohne Anfahrtskosten']}
      trail={[{ name: 'Einsatzgebiet', href: '/einsatzgebiet' }]}
      related={[
        { title: 'Kontakt & Termin', text: 'Termin vor Ort vereinbaren.', href: '/kontakt' },
        { title: 'Ablauf', text: 'Was beim Vor-Ort-Termin passiert.', href: '/ablauf' },
        { title: 'Leistungen', text: 'Alle Gutachtenarten im Überblick.', href: '/leistungen' },
      ]}
    >
      <ServiceMap />

      <section className="section-tight">
        <div className="shell">
          <Slug left="Standorte" right="Regionalseiten" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {REGION_PAGES.map((r) => (
              <Tilt key={r.slug} max={4}>
                <Link href={`/kfz-gutachter/${r.slug}`} className="card h-full">
                  <h2 className="font-display text-h3 font-semibold">Kfz-Gutachter {r.name}</h2>
                  <p className="text-fg-mute">{r.note}</p>
                  <span className="tlink text-signal-bright">
                    Zur Region <Arrow />
                  </span>
                </Link>
              </Tilt>
            ))}
          </div>
        </div>
      </section>
    </Landing>
  );
}
