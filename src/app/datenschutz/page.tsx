import type { Metadata } from 'next';
import { BIZ } from '@/lib/content';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Datenschutz',
  description: 'Datenschutzerklärung von Rose Café Bremen.',
  path: '/datenschutz',
  noindex: true,
});

export default function DatenschutzPage() {
  return (
    <section className="section bg-bone">
      <div className="shell prose-rose max-w-[70ch]">
        <p className="eyebrow mb-6">Rechtliches</p>
        <h1 className="display mb-8 text-h2">Datenschutzerklärung</h1>

        <h3>Verantwortlicher</h3>
        <p>
          Rose Café Bremen
          <br />
          {BIZ.street}, {BIZ.zip} {BIZ.city}
          <br />
          E-Mail: {BIZ.email}
        </p>

        <h3>Reservierungsformular</h3>
        <p>
          Wenn Sie das Reservierungsformular nutzen, öffnet sich Ihr E-Mail-Programm mit den eingegebenen Daten.
          Diese Daten werden ausschließlich zur Bearbeitung Ihrer Reservierungsanfrage verwendet und nicht an
          Dritte weitergegeben.
        </p>

        <h3>Cookies</h3>
        <p>
          Diese Website nutzt ausschließlich technisch notwendige Speicherung (z. B. um Ihre Einwilligung zum
          Cookie-Hinweis zu merken). Es werden keine Tracking- oder Marketing-Cookies gesetzt.
        </p>

        <h3>Ihre Rechte</h3>
        <p>
          Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
          Datenübertragbarkeit sowie Widerspruch gegen die Verarbeitung Ihrer personenbezogenen Daten. Wenden Sie
          sich dazu an die oben genannte E-Mail-Adresse.
        </p>

        <p className="mt-8 text-[.85rem] text-fg-mute">
          Platzhaltertext — vor Veröffentlichung durch eine rechtsverbindliche, individuell geprüfte
          Datenschutzerklärung ersetzen.
        </p>
      </div>
    </section>
  );
}
