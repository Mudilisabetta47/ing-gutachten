import Link from 'next/link';
import { Reveal } from '@/components/ui/Reveal';
import { SplitWords } from '@/components/ui/Split';

const classes = [
  { title: 'Pkw', href: '/pkw-gutachten', text: 'Alltag, Reise und alles dazwischen.', shape: 'car' },
  { title: 'Elektrofahrzeuge', href: '/e-auto-hybrid-gutachten', text: 'Antrieb, Batterie und Fahrzeugstruktur.', shape: 'electric' },
  { title: 'Hybridfahrzeuge', href: '/e-auto-hybrid-gutachten', text: 'Zwei Antriebe. Ein genauer Blick.', shape: 'hybrid' },
  { title: 'Motorräder', href: '/motorrad-gutachten', text: 'Krafträder, Roller und Anbauteile.', shape: 'bike' },
  { title: 'Transporter', href: '/pkw-gutachten', text: 'Für Fahrzeuge, die täglich leisten.', shape: 'van' },
  { title: 'Oldtimer & Youngtimer', href: '/oldtimer-gutachten', text: 'Substanz, Originalität und Geschichte.', shape: 'classic' },
  { title: 'Nutzfahrzeuge', href: '/lkw-gutachten', text: 'Aufbauten und Technik mitgedacht.', shape: 'truck' },
  { title: 'Anhänger', href: '/lkw-gutachten', text: 'Auch hinter dem Zugfahrzeug präzise.', shape: 'trailer' },
  { title: 'Gewerbliche Flotten', href: '/lkw-gutachten', text: 'Mehrere Fahrzeuge im Zusammenhang.', shape: 'fleet' },
];
function Silhouette({ kind }: { kind: string }) {
  const car = <><path pathLength={1} d="M12 52V42l12-4 12-16h33l20 16 17 5v9H12Z M29 38h53M53 23v15" /><circle pathLength={1} cx="30" cy="53" r="8" /><circle pathLength={1} cx="87" cy="53" r="8" /></>;
  return <svg className="vc-draw" viewBox="0 0 120 80" width="120" height="80" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {['car', 'electric', 'hybrid'].includes(kind) && car}
    {kind === 'electric' && <path pathLength={1} d="m65 3-7 10h7l-5 9" />}
    {kind === 'hybrid' && <path pathLength={1} d="M44 10h25m-5-4 5 4-5 4M44 6v8" />}
    {kind === 'bike' && <><circle pathLength={1} cx="27" cy="52" r="13" /><circle pathLength={1} cx="92" cy="52" r="13" /><path pathLength={1} d="m27 52 22-24h21l22 24M49 28l14 24H27M63 52l14-31-9-7h-9M41 26h17M74 30h10" /></>}
    {kind === 'van' && <><path pathLength={1} d="M12 51V20h57l22 18h15v13M70 21v18h20M21 27h18v12H21zM47 27h15v12H47zM39 52h41" /><circle pathLength={1} cx="29" cy="53" r="8" /><circle pathLength={1} cx="89" cy="53" r="8" /></>}
    {kind === 'classic' && <><path pathLength={1} d="M12 50V40h16l10-18h32l13 18h23v10M37 40h36M53 23v17M38 52h43" /><circle pathLength={1} cx="28" cy="52" r="9" /><circle pathLength={1} cx="91" cy="52" r="9" /></>}
    {kind === 'truck' && <><path pathLength={1} d="M8 50V15h62v35M70 28h21l18 16v6H8M80 32v12h23" /><circle pathLength={1} cx="27" cy="53" r="8" /><circle pathLength={1} cx="90" cy="53" r="8" /></>}
    {kind === 'trailer' && <><path pathLength={1} d="M13 48V22h72v26H13m72 0h20l7-8M20 28h58" /><circle pathLength={1} cx="39" cy="53" r="8" /><circle pathLength={1} cx="63" cy="53" r="8" /></>}
    {kind === 'fleet' && <><g transform="translate(17 -9) scale(.78)">{car}</g><g transform="translate(-5 20) scale(.78)">{car}</g></>}
  </svg>;
}
export function VehicleClasses() {
  return <section className="theme-dark section border-y border-line" aria-labelledby="vehicles-h" id="fahrzeugklassen"><div className="shell">
    <p className="eyebrow mb-4">02 / Fahrzeugklassen</p><h2 id="vehicles-h" className="display mb-6 max-w-[18ch] text-h2"><SplitWords text="Unsere Expertise kennt viele Fahrzeugklassen." /></h2>
    <Reveal delay={0.1}><p className="mb-12 max-w-[55ch] text-fg-dim">Jedes Fahrzeug hat seine Besonderheiten. Wir betrachten die Technik, den Einsatz und den Zustand im Zusammenhang.</p></Reveal>
    <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">{classes.map((c, i) => <Reveal as="li" key={c.title} variant="up" delay={(i % 3) * 0.1} className="bg-ink-900"><Link href={c.href} className="vehicle-card group flex h-full items-center gap-5 p-6 sm:flex-col sm:items-start sm:p-8"><span className="shrink-0 text-signal-bright"><Silhouette kind={c.shape} /></span><div><h3 className="display mb-2 text-xl">{c.title}</h3><p className="text-sm text-fg-dim">{c.text}</p></div></Link></Reveal>)}</ul>
  </div></section>;
}
