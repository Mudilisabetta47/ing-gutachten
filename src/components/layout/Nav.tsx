'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { BIZ, NAV } from '@/lib/content';
import { Magnetic } from '@/components/ui/Magnetic';
import { Arrow } from '@/components/ui/Icon';

/* =====================================================================
   Logo-Konfiguration — die einzigen zwei Stellen, die du anfassen musst.

   LOGO_SRC   Pfad ab dem public-Ordner. Datei muss unter
              public/assets/img/logo.svg liegen.

   LOGO_HAS_WORDMARK
              true  = im Logo steht "ING GUTACHTEN" bereits drin.
                      Der getippte Schriftzug daneben entfällt.
              false = das Logo ist nur ein Zeichen/Signet.
                      Der Schriftzug bleibt daneben stehen.

   Brand() wird von Navigation, Fullscreen-Menü und Footer gemeinsam
   benutzt — eine Änderung hier wirkt überall.
   ===================================================================== */
const LOGO_SRC = '/assets/img/logo.svg';
const LOGO_HAS_WORDMARK = true;

export function Nav() {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const [stuck, setStuck] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);

  const ctaHref = pathname === '/' ? '#anfrage' : '/kontakt#anfrage';

  /* Kompakter werden, beim Runterscrollen verschwinden, beim Hoch wieder da sein. */
  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setStuck(y > 24);
        setHidden(!open && y > 420 && y > last + 4);
        last = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [open]);

  /* Scroll sperren und Esc abfangen, solange das Menü offen ist. */
  useEffect(() => {
    document.body.classList.toggle('is-locked', open);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('is-locked');
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <header
        className={[
          'fixed inset-x-0 top-0 z-[90] border-b transition-[background-color,backdrop-filter,border-color,transform] duration-500 ease-out',
          stuck ? 'glass border-line-soft' : 'border-transparent',
          hidden ? '-translate-y-full' : 'translate-y-0',
        ].join(' ')}
      >
        <div
          className={`mx-auto flex max-w-shell items-center gap-6 transition-[padding] duration-500 ease-out ${
            stuck ? 'py-3' : 'py-[clamp(.9rem,2vw,1.5rem)]'
          }`}
          style={{ paddingInline: 'var(--pad)' }}
        >
          {/* Beim Scrollen schrumpft das Logo leicht mit der Leiste. */}
          <Brand compact={stuck} />

          <nav className="ml-auto hidden gap-[.15rem] xl:flex" aria-label="Hauptnavigation">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`group relative whitespace-nowrap px-[.62rem] py-2 text-[.86rem] transition-colors ${
                    active ? 'text-fg' : 'text-fg-dim hover:text-fg'
                  }`}
                >
                  {item.label}
                  <span
                    className={`absolute inset-x-[.62rem] bottom-[.28rem] h-px origin-right scale-x-0 bg-signal transition-transform duration-500 ease-out group-hover:origin-left group-hover:scale-x-100 ${
                      active ? 'origin-left scale-x-100' : ''
                    }`}
                  />
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-[.6rem] xl:ml-0">
            <a
              href={`tel:${BIZ.phoneLink}`}
              className="hidden font-mono text-[.78rem] text-fg-dim transition-colors hover:text-signal-bright 2xl:inline-flex"
            >
              {BIZ.phoneDisplay}
            </a>
            <Magnetic strength={0.22} className="hidden sm:inline-block">
              <Link href={ctaHref} className="btn btn-sm">
                Gutachten anfordern <Arrow />
              </Link>
            </Magnetic>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="fullscreen-menu"
              aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
              className="grid h-[46px] w-[46px] place-items-center rounded-full transition-shadow xl:hidden"
              style={{ boxShadow: 'inset 0 0 0 1px #232b33' }}
            >
              <span className="grid gap-[5px]">
                <span
                  className={`block h-[1.5px] w-[17px] rounded bg-fg transition-transform duration-500 ease-out ${
                    open ? 'translate-y-[3.25px] rotate-45' : ''
                  }`}
                />
                <span
                  className={`block h-[1.5px] w-[17px] rounded bg-fg transition-transform duration-500 ease-out ${
                    open ? '-translate-y-[3.25px] -rotate-45' : ''
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="fullscreen-menu"
            className="fixed inset-0 z-[89] flex flex-col overflow-y-auto bg-ink-850"
            style={{
              paddingInline: 'var(--pad)',
              paddingTop: 'calc(env(safe-area-inset-top) + 5.5rem)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)',
            }}
            initial={reduced ? { opacity: 0 } : { clipPath: 'inset(0 0 100% 0)' }}
            animate={reduced ? { opacity: 1 } : { clipPath: 'inset(0 0 0% 0)' }}
            exit={reduced ? { opacity: 0 } : { clipPath: 'inset(0 0 100% 0)' }}
            transition={{ duration: 0.8, ease: [0.65, 0, 0.35, 1] }}
          >
            <nav aria-label="Vollbildnavigation" className="mt-auto">
              <ul className="grid gap-[.1rem]">
                {NAV.map((item, i) => (
                  <li key={item.href} className="overflow-hidden">
                    <motion.div
                      initial={reduced ? false : { y: '110%' }}
                      animate={{ y: 0 }}
                      transition={{ duration: 0.7, delay: 0.1 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="flex items-baseline gap-4 py-[.35rem] font-display font-bold leading-[1.06] tracking-[-.035em] transition-colors hover:text-signal-bright"
                        style={{ fontSize: 'clamp(2.1rem,11vw,3.4rem)' }}
                      >
                        <em className="font-mono text-[.62rem] not-italic tracking-[.18em] text-fg-mute">
                          {String(i + 1).padStart(2, '0')}
                        </em>
                        {item.label}
                      </Link>
                    </motion.div>
                  </li>
                ))}
              </ul>
            </nav>

            <motion.div
              className="mt-auto grid gap-4 pt-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Link href={ctaHref} onClick={() => setOpen(false)} className="btn justify-center">
                Gutachten anfordern <Arrow />
              </Link>
              <div className="flex flex-wrap gap-x-6 gap-y-[.4rem] font-mono text-[.78rem] text-fg-mute">
                <a href={`tel:${BIZ.phoneLink}`} className="hover:text-signal-bright">
                  {BIZ.phoneDisplay}
                </a>
                <a href={`tel:${BIZ.mobileLink}`} className="hover:text-signal-bright">
                  {BIZ.mobileDisplay}
                </a>
                <a href={`mailto:${BIZ.email}`} className="hover:text-signal-bright">
                  {BIZ.email}
                </a>
                <span>
                  {BIZ.street}, {BIZ.zip} {BIZ.city}
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Wortmarke der Seite. Wird von Navigation und Footer gemeinsam genutzt.
 *
 * compact  – in der Navigation, sobald die Leiste beim Scrollen schrumpft
 * large    – im Footer, dort darf das Logo etwas größer stehen
 */
export function Brand({ compact = false, large = false }: { compact?: boolean; large?: boolean } = {}) {
  const height = large ? 'h-11' : compact ? 'h-7' : 'h-9';

  return (
    <Link
      href="/"
      className="flex flex-none items-center gap-[.7rem] font-display text-[1.02rem] font-bold tracking-[-.02em]"
      aria-label="ING Gutachten – zur Startseite"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_SRC}
        alt={LOGO_HAS_WORDMARK ? 'ING Gutachten – Kfz-Sachverständigenbüro Hannover' : ''}
        aria-hidden={LOGO_HAS_WORDMARK ? undefined : true}
        className={`${height} w-auto flex-none transition-[height] duration-500 ease-out`}
      />

      {/* Enthält das Logo den Schriftzug bereits, entfällt der getippte Text. */}
      {!LOGO_HAS_WORDMARK && (
        <span>
          ING GUTACHTEN
          <small className="mt-[2px] block font-mono text-[.55rem] font-normal uppercase tracking-[.24em] text-fg-mute">
            Kfz-Sachverständige Hannover
          </small>
        </span>
      )}
    </Link>
  );
}
