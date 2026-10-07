import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: { default: 'ING Operating System', template: '%s · ING OS' },
  description: 'Interner Bereich',
  robots: { index: false, follow: false, nocache: true },
};

// Alles im Admin ist personen- und sitzungsbezogen: nie statisch, nie gecacht.
export const dynamic = 'force-dynamic';

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <div className="theme-dark min-h-[100svh] bg-ink-900 text-fg">{children}</div>;
}
