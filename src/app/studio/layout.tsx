import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './studio.css';

export const metadata: Metadata = {
  title: 'ING Studio',
  description: 'Interner Arbeitsplatz',
  robots: { index: false, follow: false, nocache: true },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#07122b' };
export const dynamic = 'force-dynamic';

export default function StudioLayout({ children }: { children: ReactNode }) {
  return children;
}
