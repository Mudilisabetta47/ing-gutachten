import Link from 'next/link';
import { Tilt } from '@/components/ui/Tilt';
import { Arrow } from '@/components/ui/Icon';
import { Slug } from '@/components/ui/Slug';

export type Related = { title: string; text: string; href: string };

export function RelatedCards({ items }: { items: Related[] }) {
  if (items.length === 0) return null;
  return (
    <section className="section-tight" aria-labelledby="rel-h">
      <div className="shell">
        <Slug left="Weiterlesen" right="Passende Seiten" />
        <h2 id="rel-h" className="display mb-8 text-[clamp(1.5rem,3vw,2.2rem)]">
          Das könnte auch passen
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Tilt key={item.href} max={4}>
              <Link href={item.href} className="card h-full">
                <h3 className="font-display text-h3 font-semibold">{item.title}</h3>
                <p className="text-fg-mute">{item.text}</p>
                <span className="tlink text-signal-bright">
                  Ansehen <Arrow />
                </span>
              </Link>
            </Tilt>
          ))}
        </div>
      </div>
    </section>
  );
}
