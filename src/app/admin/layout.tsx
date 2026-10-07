import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import './admin.css';

export const metadata: Metadata = {
  title: { default: 'ING Operating System', template: '%s · ING OS' },
  description: 'Interner Bereich',
  robots: { index: false, follow: false, nocache: true },
};

// Alles im Admin ist personen- und sitzungsbezogen: nie statisch, nie gecacht.
export const dynamic = 'force-dynamic';

export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  // Darstellung (Dunkel/Hell/System) kommt aus einem Cookie nur für /admin → der Server rendert sofort richtig, kein Aufblitzen.
  const pref = (await cookies()).get('ing_theme')?.value;
  const theme = pref === 'light' || pref === 'system' ? pref : 'dark';
  return (
    <div className="adm-root" data-theme={theme} style={{ minHeight: '100svh' }}>
      {children}
    </div>
  );
}
