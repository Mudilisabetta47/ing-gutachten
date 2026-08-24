import Link from 'next/link';
import { SplitLines } from '@/components/ui/SplitLines';

export type Crumb = { name: string; href: string };

export function PageHero({
  eyebrow,
  title,
  lead,
  trail,
  chips,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  trail: Crumb[];
  chips?: string[];
}) {
  return (
    <section className="page-hero-bg relative overflow-hidden border-b border-line pb-[clamp(3rem,8vh,5.5rem)] pt-[clamp(8rem,18vh,12rem)]">
      <div className="shell">
        <nav aria-label="Brotkrumen-Navigation">
          <ol className="flex flex-wrap items-center gap-2 font-mono text-[.68rem] uppercase tracking-[.14em] text-fg-mute">
            {trail.map((c, i) => {
              const last = i === trail.length - 1;
              return (
                <li key={c.href} className="flex items-center gap-2">
                  {i > 0 && <span className="text-[#3b454f]">/</span>}
                  {last ? (
                    <span aria-current="page">{c.name}</span>
                  ) : (
                    <Link href={c.href} className="transition-colors hover:text-signal">
                      {c.name}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <p className="eyebrow mt-7">{eyebrow}</p>
        <h1 className="display my-6 max-w-[20ch] text-h1">
          <SplitLines lines={[title]} />
        </h1>
        <p className="lead max-w-[58ch]">{lead}</p>

        {chips && chips.length > 0 && (
          <div className="mt-7 flex flex-wrap gap-2">
            {chips.map((c) => (
              <span
                key={c}
                className="rounded-full px-[.8rem] py-[.4rem] font-mono text-[.66rem] uppercase tracking-[.14em] text-fg-mute"
                style={{ boxShadow: 'inset 0 0 0 1px #232b33' }}
              >
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
