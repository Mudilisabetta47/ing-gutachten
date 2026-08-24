import { CountUp } from '@/components/ui/CountUp';
import { Reveal } from '@/components/ui/Reveal';

const CELLS = [
  { label: 'Erfahrung', value: <CountUp to={15} suffix="+" />, text: 'Jahre als Kfz-Sachverständige – über 15 Jahre Praxis in der Schadenbewertung.' },
  { label: 'Terminvergabe', value: <>24–48<span className="text-[.55em]">h</span></>, text: 'Typischer Zeitraum bis zur Besichtigung – auf Wunsch auch schneller.' },
  { label: 'Unabhängig', value: <CountUp to={100} suffix="%" />, text: 'Keine Bindung an Versicherer, Werkstatt oder Autohaus.' },
  { label: 'Einsatzgebiet', value: <span className="text-[clamp(1.5rem,3.4vw,2.4rem)] leading-tight">Hannover<br />+ Region</span>, text: 'Vor-Ort-Service im gesamten Umland – ohne Zusatzkosten für die Anfahrt.' },
];

export function Stats() {
  return (
    <section className="grid grid-cols-2 gap-px border-y border-line bg-line lg:grid-cols-4" aria-label="Kennzahlen">
      {CELLS.map((c) => (
        <Reveal key={c.label} className="relative grid gap-[.35rem] overflow-hidden bg-ink-900 px-[clamp(1.1rem,2.4vw,2rem)] py-[clamp(1.6rem,4vw,2.8rem)]">
          <small className="font-mono text-[.68rem] uppercase tracking-[.16em] text-fg-mute">{c.label}</small>
          <b className="font-display text-[clamp(2.1rem,5.5vw,3.5rem)] font-bold leading-none tracking-[-.04em]">
            {c.value}
          </b>
          <p className="mt-[.35rem] text-[.9rem] text-fg-dim">{c.text}</p>
        </Reveal>
      ))}
    </section>
  );
}
