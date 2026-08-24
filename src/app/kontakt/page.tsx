import type { Metadata } from 'next';
import { Landing } from '@/components/layout/Landing';
import { ContactGrid } from '@/components/sections/ContactGrid';
import { RequestSection } from '@/components/sections/RequestSection';
import { Slug } from '@/components/ui/Slug';
import { Arrow } from '@/components/ui/Icon';
import { BIZ } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Kontakt & Termin | Kfz-Gutachter Hannover',
  description:
    'Kontakt zum Kfz-Sachverständigenbüro ING Gutachten in Hannover: Telefon 0511 543 00 976, mobil 0173 72 79 763, Hildesheimer Straße 229. Gutachten in vier Schritten online anfordern.',
  path: '/kontakt',
});

const MAPS_QUERY = encodeURIComponent(`${BIZ.street} ${BIZ.zip} ${BIZ.city}`);

export default function Page() {
  return (
    <Landing
      eyebrow="Kontakt & Termin"
      title="Ein Anruf reicht."
      lead="Rufen Sie an oder stellen Sie die Anfrage in vier Schritten – inklusive Fotoupload. Wir melden uns in der Regel innerhalb weniger Stunden mit einem Terminvorschlag."
      chips={[BIZ.phoneDisplay, BIZ.mobileDisplay, 'Vor-Ort-Service']}
      trail={[{ name: 'Kontakt', href: '/kontakt' }]}
      related={[
        { title: 'Ablauf', text: 'Was nach Ihrer Anfrage passiert.', href: '/ablauf' },
        { title: 'Einsatzgebiet', text: 'Wo wir vor Ort begutachten.', href: '/einsatzgebiet' },
        { title: 'FAQ', text: 'Kosten, Fristen und Rechte.', href: '/faq' },
      ]}
    >
      <section className="section-tight">
        <div className="shell">
          <ContactGrid />
        </div>
      </section>

      <RequestSection />

      <section className="section-tight">
        <div className="shell">
          <Slug left="Anfahrt" right={BIZ.street} />
          <div className="grid gap-[clamp(2rem,5vw,5rem)] lg:grid-cols-[.85fr_1.15fr]">
            <div className="grid content-start gap-6">
              <p className="eyebrow">So finden Sie uns</p>
              <p className="lead">
                Das Büro liegt an der Hildesheimer Straße in Hannover-Döhren – gut erreichbar über die B6 und mit
                der Stadtbahn. Parkmöglichkeiten sind vorhanden.
              </p>
              <p className="text-fg-mute">
                Für die Begutachtung selbst müssen Sie nicht zu uns kommen: In Hannover und Umgebung sind
                Vor-Ort-Termine der Normalfall.
              </p>
            </div>
            <div className="card">
              <p className="eyebrow eyebrow-plain">Adresse</p>
              <address className="text-[1.1rem] not-italic leading-[1.8]">
                ING Gutachten
                <br />
                {BIZ.street}
                <br />
                {BIZ.zip} {BIZ.city}
              </address>
              <a
                className="btn btn-ghost btn-sm justify-self-start"
                href={`https://www.google.com/maps/search/?api=1&query=${MAPS_QUERY}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                In Google Maps öffnen <Arrow />
              </a>
            </div>
          </div>
        </div>
      </section>
    </Landing>
  );
}
