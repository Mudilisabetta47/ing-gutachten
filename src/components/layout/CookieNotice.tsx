'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';

const KEY = 'ing_cookie_ok';

/** Hinweis statt Consent-Banner: die Seite setzt keine Tracking-Cookies. */
export function CookieNotice() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(KEY);
    } catch {
      stored = null;
    }
    if (!stored) {
      const t = window.setTimeout(() => setOpen(true), 1200);
      return () => window.clearTimeout(t);
    }
  }, []);

  const openAgain = useCallback(() => setOpen(true), []);

  useEffect(() => {
    const handler = () => openAgain();
    document.addEventListener('ing:cookie-settings', handler);
    return () => document.removeEventListener('ing:cookie-settings', handler);
  }, [openAgain]);

  const accept = () => {
    try {
      window.localStorage.setItem(KEY, 'ok');
    } catch {
      /* Privater Modus: dann erscheint der Hinweis eben erneut. */
    }
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-label="Cookie-Hinweis"
          className="fixed bottom-[4.6rem] z-[95] grid max-w-[520px] gap-[.9rem] rounded-[14px] border border-line p-5 sm:bottom-4"
          style={{
            left: 'var(--pad)',
            right: 'var(--pad)',
            background: 'rgba(14,17,22,.96)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            boxShadow: '0 24px 60px -20px rgba(0,0,0,.8)',
          }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-[.85rem] text-fg-dim">
            <strong>Nur das Nötigste.</strong> Diese Website nutzt ausschließlich technisch notwendige
            Speicherung. Es werden keine Tracking- oder Marketing-Cookies gesetzt. Details in der{' '}
            <Link href="/datenschutz" className="text-signal-bright underline underline-offset-2">
              Datenschutzerklärung
            </Link>
            .
          </p>
          <div className="flex flex-wrap gap-[.6rem]">
            <button type="button" onClick={accept} className="btn btn-sm">
              Verstanden
            </button>
            <Link href="/datenschutz" className="btn btn-sm btn-ghost">
              Mehr erfahren
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Footer-Button, der den Hinweis erneut öffnet. */
export function CookieSettingsButton() {
  return (
    <button
      type="button"
      className="transition-colors hover:text-signal-bright"
      onClick={() => document.dispatchEvent(new CustomEvent('ing:cookie-settings'))}
    >
      Cookie-Einstellungen
    </button>
  );
}
