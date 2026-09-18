import Link from 'next/link';
import type { ReactNode } from 'react';
import { BIZ, NAV } from '@/lib/content';
import { Brand } from './Brand';
import { CookieSettingsButton } from './CookieNotice';

export function Footer() {
  return (
    <footer className="border-t border-line bg-night pb-24 pt-[clamp(3rem,6vw,4.5rem)] sm:pb-0">
      <div className="shell">
        <div className="grid gap-10 md:grid-cols-3 xl:grid-cols-[1.6fr_1fr_1fr]">
          <div>
            <div className="mb-5">
              <Brand night />
            </div>
            <address className="text-[.93rem] not-italic leading-[1.8] text-bone/60">
              {BIZ.street}
              <br />
              {BIZ.zip} {BIZ.city}
              <br />
              <br />
              Telefon:{' '}
              <a href={`tel:${BIZ.phoneLink}`} className="cursor-none transition-colors hover:text-rose-pale" data-cursor="cta">
                {BIZ.phoneDisplay}
              </a>
              <br />
              E-Mail:{' '}
              <a href={`mailto:${BIZ.email}`} className="cursor-none transition-colors hover:text-rose-pale" data-cursor="cta">
                {BIZ.email}
              </a>
            </address>
          </div>

          <FooterCol title="Navigation">
            {NAV.map((n) => (
              <FooterLink key={n.href} href={n.href}>
                {n.label}
              </FooterLink>
            ))}
          </FooterCol>

          <FooterCol title="Öffnungszeiten">
            {BIZ.hours.map((h) => (
              <li key={h.d} className="flex justify-between gap-4 text-[.93rem] text-bone/60">
                <span>{h.d}</span>
                <span className="text-bone/85">{h.t}</span>
              </li>
            ))}
          </FooterCol>
        </div>

        <div className="mt-[clamp(2.5rem,5vw,4rem)] flex flex-wrap items-center gap-x-6 gap-y-[.6rem] border-t border-line-night py-[1.4rem] text-[.8rem] text-bone/50">
          <span>© {new Date().getFullYear()} Rose Café · Bremen-Schwachhausen</span>
          <nav className="ml-auto flex flex-wrap gap-5" aria-label="Rechtliches">
            <Link href="/impressum" className="cursor-none transition-colors hover:text-rose-pale">
              Impressum
            </Link>
            <Link href="/datenschutz" className="cursor-none transition-colors hover:text-rose-pale">
              Datenschutz
            </Link>
            <CookieSettingsButton />
          </nav>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-[1.1rem] font-mono text-[.66rem] font-normal uppercase tracking-[.2em] text-bone/50">{title}</h2>
      <ul className="grid gap-[.6rem]">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link href={href} className="cursor-none text-[.93rem] text-bone/70 transition-colors hover:text-rose-pale">
        {children}
      </Link>
    </li>
  );
}
