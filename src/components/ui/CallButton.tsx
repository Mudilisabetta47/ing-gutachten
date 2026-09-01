'use client';

import { BIZ } from '@/lib/content';

/**
 * Anrufen-Button.
 *
 * Drei Ausprägungen, ein Verhalten: immer ein echter tel:-Link, damit er
 * auf dem Telefon direkt wählt und auf dem Desktop an die Telefonie-App
 * übergibt. Der Hover-Effekt ist reine Zugabe — nichts an der Funktion
 * hängt davon ab, weil Touchgeräte kein Hover kennen.
 */
export function CallButton({
  variant = 'nav',
  className = '',
}: {
  variant?: 'nav' | 'block' | 'solid';
  className?: string;
}) {
  const label = variant === 'nav' ? BIZ.phoneDisplay : `Anrufen · ${BIZ.phoneDisplay}`;

  const base =
    'group relative isolate inline-flex items-center gap-[.6rem] overflow-hidden rounded-full ' +
    'font-display font-semibold transition-[transform,box-shadow,background-color,color] duration-300 ease-out ' +
    'active:scale-[.97]';

  const styles: Record<string, string> = {
    /* In der Kopfzeile: dezent, tritt hinter den Haupt-CTA zurück. */
    nav: 'hidden 2xl:inline-flex px-[1.15rem] py-[.66rem] text-[.82rem] text-fg-dim hover:text-fg',
    /* Im Vollbildmenü und auf Mobilseiten: volle Breite, klare Fläche. */
    block: 'w-full justify-center px-[1.7rem] py-[1rem] text-[.95rem] text-fg',
    /* Auf Kontaktflächen: gefüllt. */
    solid: 'px-[1.7rem] py-[1.02rem] text-[.95rem] bg-signal text-white hover:text-ink-900',
  };

  const ring =
    variant === 'solid' ? '' : 'shadow-[inset_0_0_0_1px_#232b33] hover:shadow-[inset_0_0_0_1px_rgba(107,168,255,.55)]';

  return (
    <a
      href={`tel:${BIZ.phoneLink}`}
      className={`${base} ${styles[variant]} ${ring} ${className}`}
      aria-label={`Anrufen: ${BIZ.phoneDisplay}`}
    >
      {/* Fläche wächst beim Hover von unten herein – dieselbe Geste wie beim Haupt-CTA. */}
      <span
        aria-hidden="true"
        className={`absolute inset-0 -z-10 translate-y-full rounded-full transition-transform duration-500 ease-out group-hover:translate-y-0 ${
          variant === 'solid' ? 'bg-white' : 'bg-signal-bright/[.14]'
        }`}
      />

      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="flex-none transition-transform duration-500 ease-out group-hover:-rotate-12 group-hover:scale-110"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>

      <span className="whitespace-nowrap tabular">{label}</span>
    </a>
  );
}
