import Link from 'next/link';
import type { ReactNode } from 'react';
import { BIZ, REGION_PAGES, SERVICES } from '@/lib/content';
import { Brand } from './Nav';
import { CookieSettingsButton } from './CookieNotice';

export function Footer() {
  return (
    <footer className="border-t border-line bg-ink-900 pb-24 pt-[clamp(3rem,6vw,4.5rem)] sm:pb-0">
      <div className="shell">
        <div className="grid gap-10 md:grid-cols-3 xl:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <div className="mb-5">
              <Brand />
            </div>
            <address className="text-[.93rem] not-italic leading-[1.8] text-fg-dim">
              {BIZ.street}
              <br />
              {BIZ.zip} {BIZ.city}
              <br />
              <br />
              Telefon:{' '}
              <a href={`tel:${BIZ.phoneLink}`} className="transition-colors hover:text-signal">
                {BIZ.phoneDisplay}
              </a>
              <br />
              Mobil:{' '}
              <a href={`tel:${BIZ.mobileLink}`} className="transition-colors hover:text-signal">
                {BIZ.mobileDisplay}
              </a>
              <br />
              E-Mail:{' '}
              <a href={`mailto:${BIZ.email}`} className="transition-colors hover:text-signal">
                {BIZ.email}
              </a>
              <br />
              <br />
              <span className="text-fg-mute">{BIZ.hours}</span>
            </address>
          </div>

          <FooterCol title="Leistungen">
            {SERVICES.map((s) => (
              <FooterLink key={s.href} href={s.href}>
                {s.title}
              </FooterLink>
            ))}
            <FooterLink href="/wertgutachten">Wertgutachten</FooterLink>
          </FooterCol>

          <FooterCol title="Region">
            {REGION_PAGES.map((r) => (
              <FooterLink key={r.slug} href={`/kfz-gutachter/${r.slug}`}>
                Kfz-Gutachter {r.name}
              </FooterLink>
            ))}
            <FooterLink href="/einsatzgebiet">Alle Einsatzgebiete</FooterLink>
          </FooterCol>

          <FooterCol title="Büro & Service">
            <FooterLink href="/ablauf">Ablauf der Schadenabwicklung</FooterLink>
            <FooterLink href="/ueber-uns">Über uns</FooterLink>
            <FooterLink href="/faq">Häufige Fragen</FooterLink>
            <FooterLink href="/kontakt">Kontakt &amp; Termin</FooterLink>
          </FooterCol>
        </div>

        <div className="mt-[clamp(2.5rem,5vw,4rem)] flex flex-wrap items-center gap-x-6 gap-y-[.6rem] border-t border-line py-[1.4rem] text-[.8rem] text-fg-mute">
          <span>© {new Date().getFullYear()} ING Gutachten · Kfz-Sachverständigenbüro Hannover</span>
          <nav className="ml-auto flex flex-wrap gap-5" aria-label="Rechtliches">
            <Link href="/impressum" className="transition-colors hover:text-signal">
              Impressum
            </Link>
            <Link href="/datenschutz" className="transition-colors hover:text-signal">
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
      <h2 className="mb-[1.1rem] font-mono text-[.66rem] font-normal uppercase tracking-[.2em] text-fg-mute">
        {title}
      </h2>
      <ul className="grid gap-[.6rem]">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-[.93rem] text-fg-dim transition-colors hover:text-signal">
        {children}
      </Link>
    </li>
  );
}
