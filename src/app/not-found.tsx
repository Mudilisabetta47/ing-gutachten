import Link from 'next/link';
import type { Metadata } from 'next';
import { Arrow } from '@/components/ui/Icon';

export const metadata: Metadata = {
  title: 'Seite nicht gefunden',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <section className="page-hero-bg relative flex min-h-[70vh] items-center overflow-hidden py-32">
      <div className="shell">
        <p className="eyebrow">Fehler 404</p>
        <h1 className="display my-6 text-h1">
          Diese Seite gibt es nicht.
          <br />
          Den Schaden regeln wir trotzdem.
        </h1>
        <p className="lead">Vielleicht hat sich die Adresse geändert. Hier geht es weiter:</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="btn">
            Zur Startseite <Arrow />
          </Link>
          <Link href="/leistungen" className="btn btn-ghost">
            Leistungen
          </Link>
          <Link href="/kontakt" className="btn btn-ghost">
            Kontakt
          </Link>
        </div>
      </div>
    </section>
  );
}
