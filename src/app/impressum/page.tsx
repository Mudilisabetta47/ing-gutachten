import type { Metadata } from 'next';
import { PageHero } from '@/components/sections/PageHero';
import { BIZ } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Impressum',
  description: 'Impressum des Kfz-Sachverständigenbüros ING Gutachten, Hildesheimer Straße 229, 30519 Hannover.',
  path: '/impressum',
  noindex: true,
});

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Rechtliches"
        title="Impressum"
        lead="Angaben gemäß § 5 DDG."
        trail={[
          { name: 'Startseite', href: '/' },
          { name: 'Impressum', href: '/impressum' },
        ]}
      />
      <section className="section">
        <div className="shell prose-ing max-w-[70ch]">
          <p className="notice">
            <strong>Hinweis für die Redaktion:</strong> Dieser Text ist ein strukturierter Platzhalter. Bitte vor
            dem Livegang durch die geprüften Angaben Ihrer Steuer- bzw. Rechtsberatung ersetzen – insbesondere
            Umsatzsteuer-ID, Berufsbezeichnung, Kammer, Versicherung und Verantwortliche nach § 18 Abs. 2 MStV.
          </p>

          <h2 className="display mb-4 mt-10 text-[clamp(1.6rem,3.4vw,2.4rem)]">Angaben gemäß § 5 DDG</h2>
          <p>
            ING Gutachten – Kfz-Sachverständigenbüro
            <br />
            {BIZ.street}
            <br />
            {BIZ.zip} {BIZ.city}
          </p>

          <h3>Kontakt</h3>
          <p>
            Telefon: <a href={`tel:${BIZ.phoneLink}`}>{BIZ.phoneDisplay}</a>
            <br />
            Mobil: <a href={`tel:${BIZ.mobileLink}`}>{BIZ.mobileDisplay}</a>
            <br />
            E-Mail: <a href={`mailto:${BIZ.email}`}>{BIZ.email}</a>
          </p>

          <h3>Vertreten durch</h3>
          <p>[Name der Inhaberin / des Inhabers]</p>

          <h3>Umsatzsteuer-Identifikationsnummer</h3>
          <p>[USt-IdNr. gemäß § 27a UStG]</p>

          <h3>Berufsbezeichnung und berufsrechtliche Regelungen</h3>
          <p>
            Berufsbezeichnung: Kfz-Sachverständige/r · verliehen in der Bundesrepublik Deutschland. Zuständige
            Kammer bzw. Bestellungsstelle: [Angabe ergänzen]. Es gelten die berufsrechtlichen Regelungen der
            jeweiligen Bestellungskörperschaft, einsehbar unter [Link ergänzen].
          </p>

          <h3>Berufshaftpflichtversicherung</h3>
          <p>[Versicherer, Anschrift, räumlicher Geltungsbereich]</p>

          <h3>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h3>
          <p>[Name, Anschrift]</p>

          <h3>Streitschlichtung</h3>
          <p>
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung bereit. Wir sind nicht
            bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
            teilzunehmen.
          </p>

          <h3>Haftung für Inhalte und Links</h3>
          <p>
            Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen
            verantwortlich. Für Inhalte externer Links sind ausschließlich deren Betreiber verantwortlich. Zum
            Zeitpunkt der Verlinkung waren keine Rechtsverstöße erkennbar.
          </p>

          <h3>Urheberrecht</h3>
          <p>
            Die durch die Betreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen
            Urheberrecht. Beiträge Dritter sind als solche gekennzeichnet.
          </p>
        </div>
      </section>
    </>
  );
}
