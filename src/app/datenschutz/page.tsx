import type { Metadata } from 'next';
import { PageHero } from '@/components/sections/PageHero';
import { BIZ } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Datenschutzerklärung',
  description: 'Datenschutzerklärung des Kfz-Sachverständigenbüros ING Gutachten in Hannover.',
  path: '/datenschutz',
  noindex: true,
});

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Rechtliches"
        title="Datenschutz"
        lead="Welche Daten wir verarbeiten – und welche nicht."
        trail={[
          { name: 'Startseite', href: '/' },
          { name: 'Datenschutz', href: '/datenschutz' },
        ]}
      />
      <section className="section">
        <div className="shell prose-ing max-w-[70ch]">
          <p className="notice">
            <strong>Hinweis für die Redaktion:</strong> Dieser Entwurf deckt den technischen Stand dieser Website
            ab. Bitte vor dem Livegang rechtlich prüfen lassen und um Hosting, Formulardienst und eventuelle
            Kartendienste ergänzen.
          </p>

          <h2 className="display mb-4 mt-10 text-[clamp(1.6rem,3.4vw,2.4rem)]">Datenschutz auf einen Blick</h2>
          <p>
            Diese Website ist bewusst datensparsam gebaut: Es werden keine Tracking-Dienste, keine
            Analyse-Cookies und keine Werbenetzwerke eingesetzt. Gespeichert wird lediglich Ihre Entscheidung zum
            Cookie-Hinweis – lokal in Ihrem Browser.
          </p>

          <h3>Verantwortlicher</h3>
          <p>
            ING Gutachten – Kfz-Sachverständigenbüro
            <br />
            {BIZ.street}, {BIZ.zip} {BIZ.city}
            <br />
            Telefon <a href={`tel:${BIZ.phoneLink}`}>{BIZ.phoneDisplay}</a> · E-Mail{' '}
            <a href={`mailto:${BIZ.email}`}>{BIZ.email}</a>
          </p>

          <h3>Kontakt- und Anfrageformular</h3>
          <p>
            Wenn Sie uns über das Anfrageformular kontaktieren, verarbeiten wir die von Ihnen angegebenen Daten
            (Name, Telefonnummer, E-Mail-Adresse, Angaben zum Schaden sowie optional hochgeladene Fotos)
            ausschließlich zur Bearbeitung Ihrer Anfrage. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO
            (vorvertragliche Maßnahmen) beziehungsweise Art. 6 Abs. 1 lit. f DSGVO.
          </p>

          <h3>Speicherdauer</h3>
          <p>
            Anfragedaten werden gelöscht, sobald sie für den Zweck der Verarbeitung nicht mehr erforderlich sind,
            spätestens nach Ablauf der gesetzlichen Aufbewahrungsfristen.
          </p>

          <h3>Hosting und Server-Logfiles</h3>
          <p>
            Der Hostinganbieter erhebt in Server-Logfiles technisch notwendige Daten (IP-Adresse, Zeitpunkt,
            abgerufene Datei, Browsertyp). Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. [Hostinganbieter und
            Auftragsverarbeitungsvertrag ergänzen.]
          </p>

          <h3>Schriftarten</h3>
          <p>
            Die Schriftarten werden über <code>next/font</code> zur Buildzeit heruntergeladen und vom eigenen
            Server ausgeliefert. Beim Besuch der Website entsteht dadurch keine Verbindung zu Google-Servern.
          </p>

          <h3>Ihre Rechte</h3>
          <ul>
            <li>Auskunft über die zu Ihrer Person gespeicherten Daten (Art. 15 DSGVO)</li>
            <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
            <li>Löschung (Art. 17 DSGVO) und Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
            <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
            <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
            <li>Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO)</li>
          </ul>
          <p>Zuständige Aufsichtsbehörde ist die Landesbeauftragte für den Datenschutz Niedersachsen.</p>
        </div>
      </section>
    </>
  );
}
