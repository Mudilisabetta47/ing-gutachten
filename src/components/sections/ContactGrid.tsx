import { BIZ } from '@/lib/content';

const CELLS = [
  { label: 'Telefon', value: BIZ.phoneDisplay, href: `tel:${BIZ.phoneLink}`, note: 'Büro Hannover' },
  { label: 'Mobil', value: BIZ.mobileDisplay, href: `tel:${BIZ.mobileLink}`, note: 'Auch außerhalb der Bürozeiten' },
  { label: 'E-Mail', value: BIZ.email, href: `mailto:${BIZ.email}`, note: 'Fotos gern direkt anhängen' },
  { label: 'Büro', value: BIZ.street, href: null, note: `${BIZ.zip} ${BIZ.city} · ${BIZ.hours}` },
];

export function ContactGrid() {
  return (
    <div className="grid gap-px overflow-hidden rounded-[22px] border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
      {CELLS.map((c) => (
        <div key={c.label} className="grid content-start gap-[.4rem] bg-ink-900 p-[clamp(1.4rem,3vw,2rem)] transition-colors hover:bg-ink-800">
          <span className="eyebrow eyebrow-plain">{c.label}</span>
          <b className="font-display text-[1.1rem] tracking-[-.01em]">
            {c.href ? (
              <a href={c.href} className="transition-colors hover:text-signal">
                {c.value}
              </a>
            ) : (
              c.value
            )}
          </b>
          <p className="text-[.88rem] text-fg-mute">{c.note}</p>
        </div>
      ))}
    </div>
  );
}
