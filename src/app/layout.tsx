import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Fraunces, JetBrains_Mono, Manrope } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { CookieNotice } from '@/components/layout/CookieNotice';
import { SmoothScroll } from '@/components/core/SmoothScroll';
import { CustomCursor } from '@/components/core/CustomCursor';
import { ScrollProgress } from '@/components/core/ScrollProgress';
import { Loader } from '@/components/core/Loader';
import { JsonLd } from '@/components/ui/JsonLd';
import { localBusinessSchema } from '@/lib/seo';
import { SITE_URL } from '@/lib/content';

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
});
const manrope = Manrope({ subsets: ['latin'], weight: ['300', '400', '500', '600'], variable: '--font-manrope', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Rose Café Bremen | Café in Bremen-Schwachhausen',
    template: '%s | Rose Café Bremen',
  },
  description:
    'Rose Café in Bremen-Schwachhausen: Frühstück, Kaffee, hausgemachte Kuchen und Desserts in warmer, editorialer Atmosphäre.',
  authors: [{ name: 'Rose Café Bremen' }],
  icons: { icon: '/assets/img/favicon.svg', apple: '/assets/img/favicon.svg' },
  other: { 'geo.region': 'DE-HB', 'geo.placename': 'Bremen' },
};

export const viewport: Viewport = {
  themeColor: '#140f0d',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" className={`${fraunces.variable} ${manrope.variable} ${mono.variable}`}>
      <body>
        <JsonLd data={localBusinessSchema()} />
        <a
          href="#main"
          className="sr-only sr-only-focusable absolute left-0 top-0 z-[200] bg-rose-deep px-5 py-3 text-bone"
        >
          Zum Inhalt springen
        </a>
        <Loader />
        <ScrollProgress />
        <SmoothScroll />
        <CustomCursor />
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <CookieNotice />
      </body>
    </html>
  );
}
