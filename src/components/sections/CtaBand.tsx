import Link from 'next/link';
import type { ReactNode } from 'react';
import { BIZ } from '@/lib/content';
import { Reveal } from '@/components/ui/Reveal';
import { Magnetic } from '@/components/ui/Magnetic';
import { Arrow } from '@/components/ui/Icon';

export function CtaBand({
  title = (
    <>
      Sie hatten einen Unfall?
      <br />
      Wir kümmern uns um den Rest.
    </>
  ),
  text = 'Ein Anruf genügt. Wir sichten den Schaden, dokumentieren beweissicher und begleiten Sie bis zur Regulierung.',
  ctaHref = '/kontakt#anfrage',
}: {
  title?: ReactNode;
  text?: string;
  ctaHref?: string;
}) {
  return (
    <section className="cta-bg relative overflow-hidden border-t border-line bg-ink-850">
      <div className="shell grid gap-8 py-[clamp(4rem,10vh,8rem)] lg:grid-cols-[1.5fr_.8fr] lg:items-end">
        <Reveal>
          <h2 className="display text-[clamp(2rem,5.4vw,4.6rem)]">{title}</h2>
        </Reveal>
        <Reveal direction="right" className="grid gap-6">
          <p className="lead">{text}</p>
          <div className="flex flex-wrap gap-[.85rem]">
            <Magnetic strength={0.25}>
              <Link href={ctaHref} className="btn">
                Gutachten anfordern <Arrow />
              </Link>
            </Magnetic>
            <Magnetic strength={0.2}>
              <a href={`tel:${BIZ.phoneLink}`} className="btn btn-ghost">
                {BIZ.phoneDisplay}
              </a>
            </Magnetic>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
