import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Reveal } from '@/components/ui/Reveal';
import { Tilt } from '@/components/ui/Tilt';
import type { IconName } from '@/lib/content';

/** Textabschnitt mit begleitender Merkkarte – das Arbeitspferd der Unterseiten. */
export function TwoCol({
  eyebrow,
  heading,
  children,
  asideTitle,
  asideItems,
  icon = 'doc',
}: {
  eyebrow: string;
  heading: ReactNode;
  children: ReactNode;
  asideTitle: string;
  asideItems: string[];
  icon?: IconName;
}) {
  return (
    <section className="section">
      <div className="shell">
        <div className="grid gap-[clamp(2rem,5vw,5rem)] lg:grid-cols-[.85fr_1.15fr]">
          <div className="grid content-start gap-6">
            <p className="eyebrow">{eyebrow}</p>
            <Tilt max={4}>
              <div className="card mt-4">
                <span className="text-signal-bright">
                  <Icon name={icon} />
                </span>
                <h3 className="font-display text-h3 font-semibold">{asideTitle}</h3>
                <ul className="prose-ing">
                  {asideItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </Tilt>
          </div>

          <div className="prose-ing grid content-start gap-6">
            <Reveal>
              <h2 className="display text-[clamp(1.8rem,4vw,3rem)]">{heading}</h2>
            </Reveal>
            <div>{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
