import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import './admin.css';
import { readTheme } from '@/server/admin/theme';

export const metadata: Metadata = {
  title: { default: 'ING Operating System', template: '%s · ING OS' },
  description: 'Interner Bereich',
  robots: { index: false, follow: false, nocache: true },
};

// Alles im Admin ist personen- und sitzungsbezogen: nie statisch, nie gecacht.
export const dynamic = 'force-dynamic';

export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  // Darstellung (Hell = Standard, Dunkel, System) kommt aus einem Cookie nur für /admin → der Server rendert sofort richtig, kein Aufblitzen.
  const theme = readTheme(await cookies());
  return (
    <div className="adm-root" data-theme={theme} style={{ minHeight: '100svh' }}>
      {children}
    </div>
  );
}
