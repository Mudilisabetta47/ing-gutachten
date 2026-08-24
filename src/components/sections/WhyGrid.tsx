import { WHY_ITEMS } from '@/lib/content';
import { Icon } from '@/components/ui/Icon';
import { Reveal } from '@/components/ui/Reveal';
import { Slug } from '@/components/ui/Slug';

export function WhyGrid() {
  return (
    <section className="section" id="warum" aria-labelledby="why-h">
      <div className="shell">
        <Slug left="Warum ING" right="Vertrauen in Zahlen" />
        <div className="mb-[clamp(2.5rem,6vw,4.5rem)] grid max-w-4xl gap-[1.1rem]">
          <p className="eyebrow">Warum ING Gutachten</p>
          <Reveal>
            <h2 id="why-h" className="display text-h2">
              Sechs Gründe, die im
              <br />
              Schadenfall zählen.
            </h2>
          </Reveal>
        </div>

        <div className="grid gap-px overflow-hidden rounded-[22px] border border-line bg-line sm:grid-cols-2 xl:grid-cols-3">
          {WHY_ITEMS.map((item, i) => (
            <Reveal
              key={item.title}
              delay={i * 0.06}
              className="group relative grid min-h-[220px] content-start gap-3 overflow-hidden bg-ink-900 p-[clamp(1.6rem,3.4vw,2.4rem)] transition-colors duration-500 hover:bg-ink-800"
            >
              <span
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100"
                style={{ background: 'radial-gradient(120% 90% at 0% 0%, rgba(255,180,60,.09), transparent 60%)' }}
              />
              <span className="relative text-signal">
                <Icon name={item.icon} />
              </span>
              <h3 className="relative font-display text-[1.18rem] font-semibold">{item.title}</h3>
              <p className="relative text-[.93rem] text-fg-mute">{item.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
