import { WHY_ITEMS } from '@/lib/content';
import { Icon } from '@/components/ui/Icon';
import { Reveal } from '@/components/ui/Reveal';
import { Slug } from '@/components/ui/Slug';

export function WhyGrid() {
  return (
    <section className="section" id="warum" aria-labelledby="why-h">
      <div className="shell">
        <Slug left="Warum ING" right="Arbeitsweise" />
        <div className="mb-[clamp(2rem,5vw,3.5rem)] grid max-w-4xl gap-[1.1rem]">
          <p className="eyebrow">Warum ING Gutachten</p>
          <Reveal>
            <h2 id="why-h" className="display text-h2">
              Vier Gründe, die im
              <br />
              Schadenfall zählen.
            </h2>
          </Reveal>
        </div>

        <ul className="grid gap-px overflow-hidden rounded-[22px] border border-line bg-line sm:grid-cols-2">
          {WHY_ITEMS.map((item) => (
            <li key={item.title} className="grid content-start gap-3 bg-ink-900 p-[clamp(1.4rem,3vw,2.2rem)]">
              <span className="text-signal-bright">
                <Icon name={item.icon} />
              </span>
              <h3 className="font-display text-[1.15rem] font-semibold">{item.title}</h3>
              <p className="text-[.93rem] text-fg-mute">{item.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
