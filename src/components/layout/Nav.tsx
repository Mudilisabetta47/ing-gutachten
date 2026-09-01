'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { BIZ, NAV, type NavItem } from '@/lib/content';
import { Magnetic } from '@/components/ui/Magnetic';
import { Arrow } from '@/components/ui/Icon';
import { CallButton } from '@/components/ui/CallButton';

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
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const closeTimer = useRef<number | null>(null);
  const [section, setSection] = useState<string | null>(null);

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
        setHidden(!open && !openMenu && y > 420 && y > last + 4);
        last = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [open, openMenu]);

  /* Scroll sperren und Esc abfangen, solange das Menü offen ist. */
  useEffect(() => {
    document.body.classList.toggle('is-locked', open);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      setOpenMenu(null);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('is-locked');
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
    setOpenMenu(null);
  }, [pathname]);

  /* Vollbildmenue oeffnet direkt im passenden Bereich. */
  useEffect(() => {
    if (!open) return;
    setSection(NAV.find((n) => n.children?.some((c) => c.href === pathname))?.href ?? null);
  }, [open, pathname]);

  /* Kurze Verzoegerung: sonst klappt das Panel zu, waehrend der Zeiger
     die Luecke darunter ueberquert. */
  const scheduleClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpenMenu(null), 160);
  };
  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
  };

  const isActive = (item: NavItem) =>
    pathname === item.href || Boolean(item.children?.some((c) => c.href === pathname));

  return (
    <>
      <header
        className={[
          'fixed inset-x-0 top-0 z-[90] border-b transition-[background-color,backdrop-filter,border-color,transform] duration-500 ease-out',
          stuck || openMenu ? 'glass border-line-soft' : 'border-transparent',
          hidden ? '-translate-y-full' : 'translate-y-0',
        ].join(' ')}
        onMouseLeave={scheduleClose}
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
              const active = isActive(item);
              const hasChildren = Boolean(item.children?.length);
              const expanded = openMenu === item.href;

              return (
                <div
                  key={item.href}
                  className="relative"
                  onMouseEnter={() => {
                    cancelClose();
                    setOpenMenu(hasChildren ? item.href : null);
                  }}
                >
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    aria-expanded={hasChildren ? expanded : undefined}
                    onFocus={() => setOpenMenu(hasChildren ? item.href : null)}
                    className={`group relative flex items-center gap-[.35rem] whitespace-nowrap px-[.62rem] py-2 text-[.86rem] transition-colors ${
                      active ? 'text-fg' : 'text-fg-dim hover:text-fg'
                    }`}
                  >
                    {item.label}
                    {hasChildren && (
                      <svg
                        width="9"
                        height="6"
                        viewBox="0 0 9 6"
                        fill="none"
                        aria-hidden="true"
                        className={`transition-transform duration-300 ease-out ${expanded ? 'rotate-180' : ''}`}
                      >
                        <path d="M1 1l3.5 3.5L8 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                    )}
                    <span
                      className={`absolute inset-x-[.62rem] bottom-[.28rem] h-px origin-right scale-x-0 bg-signal-bright transition-transform duration-500 ease-out group-hover:origin-left group-hover:scale-x-100 ${
                        active ? 'origin-left scale-x-100' : ''
                      }`}
                    />
                  </Link>

                  <AnimatePresence>
                    {hasChildren && expanded && (
                      <motion.div
                        className="absolute left-0 top-full pt-3"
                        initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
                        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                        onMouseEnter={cancelClose}
                      >
                        <ul
                          className="grid w-[280px] gap-[.1rem] rounded-[16px] border border-line p-2"
                          style={{
                            background: 'rgba(12,15,20,.94)',
                            backdropFilter: 'blur(18px)',
                            WebkitBackdropFilter: 'blur(18px)',
                            boxShadow: '0 30px 70px -30px rgba(0,0,0,.9)',
                          }}
                        >
                          {item.children!.map((child, i) => (
                            <motion.li
                              key={child.href}
                              initial={reduced ? false : { opacity: 0, y: -6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, delay: 0.03 + i * 0.035, ease: [0.16, 1, 0.3, 1] }}
                            >
                              <Link
                                href={child.href}
                                className={`group/item flex items-center justify-between gap-3 rounded-[10px] px-3 py-[.6rem] text-[.88rem] transition-colors ${
                                  pathname === child.href
                                    ? 'bg-white/[.05] text-fg'
                                    : 'text-fg-dim hover:bg-white/[.04] hover:text-fg'
                                }`}
                              >
                                {child.label}
                                <span className="translate-x-[-4px] text-signal-bright opacity-0 transition-all duration-300 ease-out group-hover/item:translate-x-0 group-hover/item:opacity-100">
                                  →
                                </span>
                              </Link>
                            </motion.li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-[.6rem] xl:ml-0">
<CallButton variant="nav" />
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
                {NAV.map((item, i) => {
                  const hasChildren = Boolean(item.children?.length);
                  const expanded = section === item.href;

                  return (
                    <li key={item.href}>
                      <motion.div
                        initial={reduced ? false : { opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                        className="flex items-baseline gap-3"
                      >
                        <Link
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className="flex flex-1 items-baseline gap-4 py-[.3rem] font-display font-bold leading-[1.06] tracking-[-.035em] transition-colors hover:text-signal-bright"
                          style={{ fontSize: 'clamp(1.75rem,8vw,2.8rem)' }}
                        >
                          <em className="font-mono text-[.6rem] not-italic tracking-[.18em] text-fg-mute">
                            {String(i + 1).padStart(2, '0')}
                          </em>
                          {item.label}
                        </Link>

                        {hasChildren && (
                          <button
                            type="button"
                            onClick={() => setSection(expanded ? null : item.href)}
                            aria-expanded={expanded}
                            aria-label={expanded ? `${item.label} zuklappen` : `${item.label} aufklappen`}
                            className="grid h-11 w-11 flex-none place-items-center rounded-full text-fg-dim transition-colors hover:text-fg"
                            style={{ boxShadow: 'inset 0 0 0 1px #232b33' }}
                          >
                            <span
                              className={`block text-xl leading-none transition-transform duration-300 ease-out ${
                                expanded ? 'rotate-45' : ''
                              }`}
                            >
                              +
                            </span>
                          </button>
                        )}
                      </motion.div>

                      <AnimatePresence initial={false}>
                        {hasChildren && expanded && (
                          <motion.ul
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden pl-[2.4rem]"
                          >
                            {item.children!.map((child) => (
                              <li key={child.href} className="border-l border-line pl-4">
                                <Link
                                  href={child.href}
                                  onClick={() => setOpen(false)}
                                  className={`block py-[.55rem] text-[1.05rem] transition-colors ${
                                    pathname === child.href ? 'text-signal-bright' : 'text-fg-dim hover:text-fg'
                                  }`}
                                >
                                  {child.label}
                                </Link>
                              </li>
                            ))}
                          </motion.ul>
                        )}
                      </AnimatePresence>
                    </li>
                  );
                })}
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
              <CallButton variant="block" />
              <div className="flex flex-wrap gap-x-6 gap-y-[.4rem] font-mono text-[.78rem] text-fg-mute">
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
