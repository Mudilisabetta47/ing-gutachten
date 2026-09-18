import type { Metadata } from 'next';
import { BIZ } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Impressum',
  description: 'Impressum von Rose Café Bremen gemäß § 5 TMG.',
  path: '/impressum',
  noindex: true,
});

export default function ImpressumPage() {
  return (
    <section className="section bg-bone">
      <div className="shell prose-rose max-w-[70ch]">
        <p className="eyebrow mb-6">Rechtliches</p>
        <h1 className="display mb-8 text-h2">Impressum</h1>

        <h3>Angaben gemäß § 5 TMG</h3>
        <p>
          Rose Café Bremen
          <br />
          [Rechtsform / Inhaber:in eintragen]
          <br />
          {BIZ.street}
          <br />
          {BIZ.zip} {BIZ.city}
        </p>

        <h3>Kontakt</h3>
        <p>
          Telefon: {BIZ.phoneDisplay}
          <br />
          E-Mail: {BIZ.email}
        </p>

        <h3>Umsatzsteuer-ID</h3>
        <p>[USt-IdNr. gemäß § 27a Umsatzsteuergesetz eintragen, falls vorhanden]</p>

        <h3>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h3>
        <p>[Name und Anschrift eintragen]</p>

        <h3>EU-Streitschlichtung</h3>
        <p>
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
          <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noreferrer" className="text-rose-deep underline">
            https://ec.europa.eu/consumers/odr/
          </a>
          . Unsere E-Mail-Adresse finden Sie oben.
        </p>

        <h3>Verbraucherstreitbeilegung</h3>
        <p>
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>

        <p className="mt-8 text-[.85rem] text-fg-mute">
          Platzhaltertext — vor Veröffentlichung durch rechtsverbindliche Angaben ersetzen.
        </p>
      </div>
    </section>
  );
}
