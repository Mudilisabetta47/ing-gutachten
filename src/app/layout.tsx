import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';
import { Archivo, JetBrains_Mono, Manrope } from 'next/font/google';
import './globals.css';
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
    <html lang="de" className={`${archivo.variable} ${manrope.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        {/* Schaltet die CSS-Reveals erst ein, wenn JavaScript läuft – ohne JS bleibt alles sichtbar. */}
        <Script id="js-flag" strategy="beforeInteractive">{"document.documentElement.classList.add('js')"}</Script>
        {children}
      </body>
    </html>
  );
}
