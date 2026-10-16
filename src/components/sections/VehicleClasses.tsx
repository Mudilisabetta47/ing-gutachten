'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { Reveal } from '@/components/ui/Reveal';
import { Slug } from '@/components/ui/Slug';
import { Arrow } from '@/components/ui/Icon';

const classes = [
  { title: 'PKW', href: '/pkw-gutachten', text: 'Karosserie, Fahrwerk und Assistenzsysteme.', shape: 'car' },
  { title: 'Elektrofahrzeuge', href: '/e-auto-hybrid-gutachten', text: 'Hochvoltsystem, Batteriegehäuse und Fahrzeugstruktur.', shape: 'electric' },
  { title: 'Hybridfahrzeuge', href: '/e-auto-hybrid-gutachten', text: 'Zwei Antriebssysteme und Hochvoltkomponenten.', shape: 'hybrid' },
  { title: 'Motorräder', href: '/motorrad-gutachten', text: 'Rahmen, Gabel, Räder und Anbauteile.', shape: 'bike' },
  { title: 'Transporter', href: '/pkw-gutachten', text: 'Leichte Nutzfahrzeuge mit Aufbau und Ausfallzeit.', shape: 'van' },
  { title: 'Oldtimer & Youngtimer', href: '/oldtimer-gutachten', text: 'Originalzustand, Substanz und Wertermittlung.', shape: 'classic' },
  { title: 'LKW & Nutzfahrzeuge', href: '/lkw-gutachten', text: 'Aufbauten, Technik und Ausfallzeit.', shape: 'truck' },
  { title: 'Anhänger & Auflieger', href: '/lkw-gutachten', text: 'Achsen, Aufbau und Verbindungseinrichtung.', shape: 'trailer' },
  { title: 'Firmen- & Fuhrparkfahrzeuge', href: '/lkw-gutachten', text: 'Mehrere Fahrzeuge, einheitlich dokumentiert.', shape: 'fleet' },
];

function Silhouette({ kind }: { kind: string }) {
  const car = <><path pathLength={1} d="M12 52V42l12-4 12-16h33l20 16 17 5v9H12Z M29 38h53M53 23v15" /><circle pathLength={1} cx="30" cy="53" r="8" /><circle pathLength={1} cx="87" cy="53" r="8" /></>;
  return <svg className="vc-draw" viewBox="0 0 120 80" width="120" height="80" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {['car', 'electric', 'hybrid'].includes(kind) && car}
    {kind === 'electric' && <path pathLength={1} d="m65 3-7 10h7l-5 9" />}
    {kind === 'hybrid' && <path pathLength={1} d="M44 10h25m-5-4 5 4-5 4M44 6v8" />}
    {kind === 'bike' && <><circle pathLength={1} cx="26" cy="54" r="14"/><circle pathLength={1} cx="94" cy="54" r="14"/><circle pathLength={1} cx="26" cy="54" r="3"/><circle pathLength={1} cx="94" cy="54" r="3"/><path pathLength={1} d="M94 54 L80 24 M73 21 H87"/><path pathLength={1} d="M78 28 H58 q-6 0-10 6 h-24"/><path pathLength={1} d="M48 34 L52 52 H68 L78 36"/><path pathLength={1} d="M26 54 L52 52"/><path pathLength={1} d="M54 40 h14 v12 h-14z"/><path pathLength={1} d="M52 58 H32"/><path pathLength={1} d="M84 32 l6 1"/></>}
    {kind === 'van' && <><path pathLength={1} d="M12 51V20h57l22 18h15v13M70 21v18h20M21 27h18v12H21zM47 27h15v12H47zM39 52h41" /><circle pathLength={1} cx="29" cy="53" r="8" /><circle pathLength={1} cx="89" cy="53" r="8" /></>}
    {kind === 'classic' && <><path pathLength={1} d="M8 56 h6 M104 56 h8"/><path pathLength={1} d="M14 54 V44 q0-3 4-4 l14-3 q8-16 22-16 h14 q12 0 18 14 l6 8 h8 q8 1 10 6 v9"/><path pathLength={1} d="M36 36 h50 M60 21 v15"/><path pathLength={1} d="M14 54 a15 15 0 0 1 30 0 M76 54 a15 15 0 0 1 30 0"/><circle pathLength={1} cx="29" cy="56" r="9"/><circle pathLength={1} cx="91" cy="56" r="9"/><circle pathLength={1} cx="29" cy="56" r="3"/><circle pathLength={1} cx="91" cy="56" r="3"/><path pathLength={1} d="M44 58 h32"/><circle pathLength={1} cx="110" cy="41" r="3.5"/><path pathLength={1} d="M112 47 v8"/></>}
    {kind === 'truck' && <><path pathLength={1} d="M8 50V15h62v35M70 28h21l18 16v6H8M80 32v12h23" /><circle pathLength={1} cx="27" cy="53" r="8" /><circle pathLength={1} cx="90" cy="53" r="8" /></>}
    {kind === 'trailer' && <><path pathLength={1} d="M13 48V22h72v26H13m72 0h20l7-8M20 28h58" /><circle pathLength={1} cx="39" cy="53" r="8" /><circle pathLength={1} cx="63" cy="53" r="8" /></>}
    {kind === 'fleet' && <><g transform="translate(17 -9) scale(.78)">{car}</g><g transform="translate(-5 20) scale(.78)">{car}</g></>}
  </svg>;
}

/**
 * Fahrzeugklassen als 3×3-Raster (ersetzt die horizontale Leistungs-Karten-Sektion).
 * Die Linien der Silhouetten zeichnen sich beim Einblenden; ohne JavaScript oder bei
 * reduzierter Bewegung sind sie sofort vollständig sichtbar.
 */
export function VehicleClasses() {
  const grid = useRef<HTMLUListElement>(null);
  const inView = useInView(grid, { once: true, margin: '0px 0px -12% 0px' });
  const reduced = useReducedMotion();
  const [armed, setArmed] = useState(false);
  useEffect(() => setArmed(!reduced), [reduced]);

  return (
    <section className="section border-y border-line" id="leistungen" aria-labelledby="vehicles-h">
      <div className="shell">
        <Slug left="Fahrzeugklassen" right="9 Klassen" />
        <div className="mb-[clamp(2.5rem,6vw,4.5rem)] grid max-w-4xl gap-[1.1rem]">
          <p className="eyebrow">Vom Parkrempler bis zum Oldtimer</p>
          <Reveal>
            <h2 id="vehicles-h" className="display text-h2">
              Unsere Expertise kennt
              <br />
              viele Fahrzeugklassen.
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="lead">
              Jedes Fahrzeug hat seine Besonderheiten. Wir betrachten die Technik, den Einsatz und den Zustand im Zusammenhang.
            </p>
          </Reveal>
        </div>

        <ul
          ref={grid}
          className={`vc-grid grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3 ${armed ? 'vc-armed' : ''} ${inView ? 'is-in' : ''}`}
        >
          {classes.map((c, i) => (
            <li key={c.title} className="bg-ink-900" style={{ ['--rv-delay' as string]: `${(i % 3) * 0.1}s` }}>
              <Reveal delay={(i % 3) * 0.1} className="h-full">
                <Link
                  href={c.href}
                  className="vehicle-card group flex h-full items-center gap-5 p-6 transition-colors duration-300 hover:bg-ink-800 focus-visible:bg-ink-800 sm:flex-col sm:items-start sm:p-8"
                >
                  <span className="shrink-0 text-signal-bright">
                    <Silhouette kind={c.shape} />
                  </span>
                  <div>
                    <h3 className="display mb-2 text-xl">{c.title}</h3>
                    <p className="text-sm text-fg-dim">{c.text}</p>
                  </div>
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>

        <div className="mt-7 flex justify-end">
          <Link href="/leistungen" className="tlink">
            Alle Leistungen <Arrow />
          </Link>
        </div>
      </div>
    </section>
  );
}
