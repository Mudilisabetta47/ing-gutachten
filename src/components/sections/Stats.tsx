import { BIZ, REGIONS } from '@/lib/content';
import { Reveal } from '@/components/ui/Reveal';

/**
 * Nur Angaben, die sich aus den Stammdaten der Website belegen lassen (Adresse, Einsatzorte) –
 * bewusst keine Erfahrungsjahre, Prozentwerte, Fallzahlen oder Terminversprechen.
 * Solche Zahlen können nach schriftlichem Beleg durch ING wieder aufgenommen werden.
 */
const CELLS = [
  { label: 'Büro', value: <span className="text-[clamp(1.5rem,3.4vw,2.4rem)] leading-tight">Hannover</span>, text: `${BIZ.street}, ${BIZ.zip} ${BIZ.city}` },
  { label: 'Einsatzgebiet', value: <span className="text-[clamp(1.5rem,3.4vw,2.4rem)] leading-tight">Hannover<br />+ Region</span>, text: `Vor-Ort-Besichtigung, z. B. in ${REGIONS.slice(0, 3).map((r) => r.name).join(', ')} und weiteren Orten.` },
  { label: 'Unabhängig', value: <span className="text-[clamp(1.5rem,3.4vw,2.4rem)] leading-tight">Ohne<br />Bindung</span>, text: 'Keine Beteiligung von Versicherern, Werkstätten oder Autohäusern.' },
];

export function Stats() {
  return (
    <section className="grid grid-cols-1 gap-px border-y border-line bg-line sm:grid-cols-3" aria-label="Eckdaten">
      {CELLS.map((c) => (
        <Reveal key={c.label} className="relative grid gap-[.35rem] overflow-hidden bg-ink-900 px-[clamp(1.1rem,2.4vw,2rem)] py-[clamp(1.4rem,3.5vw,2.4rem)]">
          <small className="font-mono text-[.68rem] uppercase tracking-[.16em] text-fg-mute">{c.label}</small>
          <b className="font-display text-[clamp(2.1rem,5.5vw,3.5rem)] font-bold leading-none tracking-[-.04em]">{c.value}</b>
          <p className="mt-[.35rem] text-[.9rem] text-fg-dim">{c.text}</p>
        </Reveal>
      ))}
    </section>
  );
}
