'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { BIZ, NAV } from '@/lib/content';
import { Magnetic } from '@/components/ui/Magnetic';
import { Brand } from './Brand';

/**
 * Header — startet transparent, wird beim Scrollen zu Glas, dann solide.
 * Beim Runterscrollen verschwindet die Leiste elegant, beim Hochscrollen
 * kommt sie sofort zurück.
 */
export function Header() {
  const [stuck, setStuck] = useState(false);
  const [solid, setSolid] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setStuck(y > 10);
        setSolid(y > 560);
        setHidden(!open && y > 640 && y > last + 4);
        last = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [open]);

  useEffect(() => {
    document.body.classList.toggle('is-locked', open);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('is-locked');
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const night = !solid;

  return (
    <>
      <header
        className={[
          'fixed inset-x-0 top-0 z-[90] border-b transition-[background-color,backdrop-filter,border-color,transform] duration-500 ease-cinematic',
          solid ? 'glass border-line' : stuck ? 'glass-night border-transparent' : 'border-transparent',
          hidden ? '-translate-y-full' : 'translate-y-0',
        ].join(' ')}
      >
        <div
          className={`mx-auto flex max-w-shell items-center gap-6 transition-[padding] duration-500 ease-cinematic ${
            stuck ? 'py-3' : 'py-[clamp(1rem,2.4vw,1.7rem)]'
          }`}
          style={{ paddingInline: 'var(--pad)' }}
        >
          <Brand compact={stuck} night={night} />

          <nav className="ml-auto hidden gap-[.2rem] lg:flex" aria-label="Hauptnavigation">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                data-cursor="cta"
                className={`group relative cursor-none px-[.7rem] py-2 text-[.86rem] transition-colors ${
                  night ? 'text-bone/85 hover:text-bone' : 'text-fg-dim hover:text-ink'
                }`}
              >
                {item.label}
                <span
                  className={`absolute inset-x-[.7rem] bottom-[.3rem] h-px origin-right scale-x-0 transition-transform duration-500 ease-cinematic group-hover:origin-left group-hover:scale-x-100 ${
                    night ? 'bg-rose-pale' : 'bg-rose-deep'
                  }`}
                />
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-[.6rem] lg:ml-0">
            <Magnetic strength={0.3} className="hidden sm:inline-block">
              <Link href="#visit" className="btn btn-sm" data-cursor="cta" data-cursor-label="RESERVE">
                Reservieren
              </Link>
            </Magnetic>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="fullscreen-menu"
              aria-label={open ? 'Menü schließen' : 'Menü öffnen'}
              data-cursor="menu"
              className="grid h-[46px] w-[46px] flex-none cursor-none place-items-center rounded-full transition-shadow lg:hidden"
              style={{ boxShadow: `inset 0 0 0 1px ${night ? 'rgba(248,242,234,.4)' : 'rgba(36,26,22,.2)'}` }}
            >
              <span className="grid gap-[5px]">
                <span
                  className={`block h-[1.5px] w-[17px] rounded transition-transform duration-500 ease-cinematic ${
                    night ? 'bg-bone' : 'bg-ink'
                  } ${open ? 'translate-y-[3.25px] rotate-45' : ''}`}
                />
                <span
                  className={`block h-[1.5px] w-[17px] rounded transition-transform duration-500 ease-cinematic ${
                    night ? 'bg-bone' : 'bg-ink'
                  } ${open ? '-translate-y-[3.25px] -rotate-45' : ''}`}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>{open && <MobileMenu onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      id="fullscreen-menu"
      className="fixed inset-0 z-[89] flex flex-col overflow-y-auto bg-night"
      style={{
        paddingInline: 'var(--pad)',
        paddingTop: 'calc(env(safe-area-inset-top) + 5.5rem)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)',
      }}
      initial={{ clipPath: 'inset(0 0 100% 0)' }}
      animate={{ clipPath: 'inset(0 0 0% 0)' }}
      exit={{ clipPath: 'inset(0 0 100% 0)' }}
      transition={{ duration: 0.75, ease: [0.65, 0, 0.35, 1] }}
    >
      <nav aria-label="Vollbildnavigation" className="mt-auto">
        <ul className="grid gap-[.1rem]">
          {NAV.map((item, i) => (
            <li key={item.href}>
              <motion.div
                initial={{ opacity: 0, y: 22, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.6, delay: 0.08 + i * 0.055, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  href={item.href}
                  onClick={onClose}
                  className="flex items-baseline gap-4 py-[.3rem] font-display font-medium leading-[1.05] tracking-[-.01em] text-bone transition-colors hover:text-rose-pale"
                  style={{ fontSize: 'clamp(1.9rem,9vw,3rem)' }}
                >
                  <em className="font-mono text-[.58rem] not-italic tracking-[.2em] text-rose-pale/60">
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
        transition={{ delay: 0.45 }}
      >
        <Link href="#visit" onClick={onClose} className="btn justify-center">
          Reservieren
        </Link>
        <div className="flex flex-wrap gap-x-6 gap-y-[.4rem] font-mono text-[.78rem] text-bone/60">
          <a href={`tel:${BIZ.phoneLink}`} className="hover:text-rose-pale">
            {BIZ.phoneDisplay}
          </a>
          <a href={BIZ.instagramHref} className="hover:text-rose-pale">
            {BIZ.instagram}
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
}
