import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Seite nicht gefunden',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <section className="relative flex min-h-[70vh] items-center overflow-hidden bg-bone py-32">
      <div className="shell">
        <p className="eyebrow">Fehler 404</p>
        <h1 className="display my-6 text-h1">
          Diese Seite
          <br />
          gibt es nicht.
        </h1>
        <p className="lead">Vielleicht hat sich die Adresse geändert. Hier geht es weiter:</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="btn">
            Zur Startseite <span aria-hidden="true" className="arw">→</span>
          </Link>
          <Link href="/#food" className="btn btn-ghost">
            Speisekarte
          </Link>
          <Link href="/#visit" className="btn btn-ghost">
            Kontakt
          </Link>
        </div>
      </div>
    </section>
  );
}
