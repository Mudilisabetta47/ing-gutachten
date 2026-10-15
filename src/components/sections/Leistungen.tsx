import Link from 'next/link';
import { Icon, Arrow } from '@/components/ui/Icon';
import type { IconName } from '@/lib/content';
import { Reveal } from '@/components/ui/Reveal';
import { SplitWords } from '@/components/ui/Split';
import { PointerGlow } from '@/components/ui/PointerGlow';

/** Offerings evidenced by the existing service pages; see docs/PREMIUM-PREVIEW.md. */
const offerings: { title: string; text: string; href: string; icon: IconName; feature?: boolean }[] = [
  { title: 'Unfallgutachten', text: 'Vom Schadenbild bis zur Wertminderung. Eine nachvollziehbare Grundlage für die nächsten Schritte nach einem Unfall.', href: '/unfallgutachten', icon: 'shield', feature: true },
  { title: 'Schadengutachten', text: 'Beschädigungen, Reparaturumfang und Kosten fachgerecht dokumentiert.', href: '/schadensgutachten', icon: 'dent' },
  { title: 'Haftpflichtschaden', text: 'Schadenpositionen nach einem fremdverursachten Unfall unabhängig bewerten.', href: '/unfallgutachten', icon: 'doc' },
  { title: 'Wertgutachten', text: 'Zustand, Ausstattung und Markt zusammen betrachten. Damit der Fahrzeugwert nachvollziehbar wird.', href: '/wertgutachten', icon: 'scale', feature: true },
  { title: 'Oldtimergutachten', text: 'Originalität, Historie und Erhaltungszustand Ihres Klassikers im Blick.', href: '/oldtimer-gutachten', icon: 'classic' },
  { title: 'Beweissicherung', text: 'Spuren und Schäden festhalten, bevor eine Reparatur den Zustand verändert.', href: '/unfallgutachten', icon: 'ruler' },
  { title: 'Fahrzeugbewertung', text: 'Eine fundierte Entscheidungsgrundlage für Kauf, Verkauf oder Versicherung.', href: '/wertgutachten', icon: 'car' },
  { title: 'Leasingrückgabe', text: 'Zustand und Minderwert prüfen. Schäden von Gebrauchsspuren unterscheiden.', href: '/wertgutachten', icon: 'doc' },
  { title: 'Unfallanalyse', text: 'Schadenbilder, Spuren und verfügbare Fahrzeugdaten technisch einordnen.', href: '/unfallanalyse', icon: 'ruler' },
];
export function Leistungen() {
  return <section className="theme-light section" id="leistungen" aria-labelledby="svc-h">
    <div className="shell">
      <div className="mb-12 grid gap-5 lg:grid-cols-[1fr_22rem] lg:items-end">
        <div><p className="eyebrow mb-4">01 / Unsere Gutachten</p><h2 id="svc-h" className="display text-h2"><SplitWords text="Für jeden Schaden." /><br /><SplitWords text="Für jedes Fahrzeug." delay={0.15} /></h2></div>
        <Reveal delay={0.2}><p className="text-fg-dim">Professionelle Kfz-Gutachten, Fahrzeugbewertungen und unabhängige Schadenanalysen in Hannover – transparent, nachvollziehbar und fachgerecht.</p></Reveal>
      </div>
      <PointerGlow><ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {offerings.map((item, i) => <Reveal as="li" key={item.title} variant={i % 2 ? 'scale' : 'up'} delay={(i % 4) * 0.07} className={`group ${item.feature ? 'md:col-span-2' : ''}`}>
          <Link href={item.href} data-glow className={`premium-service flex h-full min-h-[260px] flex-col rounded-2xl border border-line p-7 ${item.feature ? 'bg-ink-850 md:p-9' : 'bg-ink-900'}`}>
            <div className="mb-9 flex items-center justify-between text-signal-bright"><span className="svc-icon inline-flex"><Icon name={item.icon} size={40} /></span><span className="mono-label">{String(i + 1).padStart(2, '0')}</span></div>
            <h3 className={`display mb-3 ${item.feature ? 'text-[clamp(2rem,3.5vw,3rem)]' : 'text-2xl'}`}>{item.title}</h3>
            <p className="mb-6 max-w-[48ch] text-fg-dim">{item.text}</p>
            <span className="mt-auto flex items-center gap-3 text-sm text-signal-bright">Mehr erfahren <span className="svc-arrow inline-flex"><Arrow /></span></span>
          </Link>
        </Reveal>)}
      </ul></PointerGlow>
      <div className="mt-7 flex flex-wrap justify-between gap-4 text-sm text-fg-dim"><p>Kaskoschaden? Den Auftrag bitte vorab mit Ihrem Versicherer abstimmen.</p><Link href="/leistungen" className="tlink">Leistungen im Überblick <Arrow /></Link></div>
    </div>
  </section>;
}
