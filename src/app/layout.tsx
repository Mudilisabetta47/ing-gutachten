import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Archivo, JetBrains_Mono, Manrope } from 'next/font/google';
import './globals.css';
import { Nav } from '@/components/layout/Nav';
import { Footer } from '@/components/layout/Footer';
import { Dock } from '@/components/layout/Dock';
import { CookieNotice } from '@/components/layout/CookieNotice';
import { SmoothScroll } from '@/components/layout/SmoothScroll';
import { CustomCursor } from '@/components/layout/CustomCursor';
import { JsonLd } from '@/components/ui/JsonLd';
import { localBusinessSchema } from '@/lib/seo';
import { SITE_URL } from '@/lib/content';

const archivo = Archivo({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-archivo', display: 'swap' });
const manrope = Manrope({ subsets: ['latin'], weight: ['300', '400', '500', '600'], variable: '--font-manrope', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Kfz-Gutachter Hannover | ING Gutachten',
    template: '%s | ING Gutachten',
  },
  description:
    'Unabhängiger Kfz-Gutachter in Hannover: Unfallgutachten, Schadengutachten und Wertgutachten mit Vor-Ort-Service.',
  authors: [{ name: 'ING Gutachten – Kfz-Sachverständigenbüro Hannover' }],
  icons: { icon: '/assets/img/favicon.svg', apple: '/assets/img/favicon.svg' },
  other: { 'geo.region': 'DE-NI', 'geo.placename': 'Hannover' },
};

export const viewport: Viewport = {
  themeColor: '#08090b',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" className={`${archivo.variable} ${manrope.variable} ${mono.variable}`}>
      <body>
        <JsonLd data={localBusinessSchema()} />
        <a
          href="#main"
          className="sr-only sr-only-focusable absolute left-0 top-0 z-[200] bg-signal px-5 py-3 text-white"
        >
          Zum Inhalt springen
        </a>
        <SmoothScroll />
        <CustomCursor />
        <Nav />
        <main id="main">{children}</main>
        <Footer />
        <Dock />
        <CookieNotice />
      </body>
    </html>
  );
}
