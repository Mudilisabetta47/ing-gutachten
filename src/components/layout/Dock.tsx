'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BIZ } from '@/lib/content';

/** Mobiler Sticky-CTA. Erscheint erst, wenn der Hero verlassen wurde. */
export function Dock() {
  const pathname = usePathname();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight * 0.6);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-[80] grid grid-cols-2 gap-2 border-t border-line-soft transition-transform duration-500 ease-out sm:hidden ${
        shown ? 'translate-y-0' : 'translate-y-[130%]'
      }`}
      style={{
        background: 'rgba(10,12,15,.86)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        paddingInline: 'var(--pad)',
        paddingTop: '.55rem',
        paddingBottom: 'calc(.55rem + env(safe-area-inset-bottom))',
      }}
    >
      <a href={`tel:${BIZ.phoneLink}`} className="btn btn-ghost btn-sm justify-center py-[.85rem]">
        Anrufen
      </a>
      <Link
        href={pathname === '/' ? '#anfrage' : '/kontakt#anfrage'}
        className="btn btn-sm justify-center py-[.85rem]"
      >
        Gutachten anfordern
      </Link>
    </div>
  );
}
