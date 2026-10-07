import type { ReactNode } from 'react';
import { Nav } from '@/components/layout/Nav';
import { Footer } from '@/components/layout/Footer';
import { Dock } from '@/components/layout/Dock';
import { CookieNotice } from '@/components/layout/CookieNotice';
import { SmoothScroll } from '@/components/layout/SmoothScroll';
import { CustomCursor } from '@/components/layout/CustomCursor';
import { RevealObserver } from '@/components/layout/RevealObserver';
import { ScrollProgress } from '@/components/layout/ScrollProgress';
import { JsonLd } from '@/components/ui/JsonLd';
import { localBusinessSchema } from '@/lib/seo';

/**
 * Rahmen der öffentlichen Website (Navigation, Footer, Cursor, Smooth Scroll …).
 * Der Admin-Bereich nutzt ihn bewusst nicht – er hat ein eigenes Layout.
 * Wird vom (site)-Layout und von der 404-Seite verwendet.
 */
export function SiteChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <JsonLd data={localBusinessSchema()} />
      <a href="#main" className="sr-only sr-only-focusable absolute left-0 top-0 z-[200] bg-signal px-5 py-3 text-white">
        Zum Inhalt springen
      </a>
      <SmoothScroll />
      <RevealObserver />
      <ScrollProgress />
      <CustomCursor />
      <Nav />
      <main id="main">{children}</main>
      <Footer />
      <Dock />
      <CookieNotice />
    </>
  );
}
