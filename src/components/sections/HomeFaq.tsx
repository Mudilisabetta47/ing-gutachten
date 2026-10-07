import Link from 'next/link';
import { HOME_FAQS } from '@/lib/content';
import { FaqList } from './Faq';
import { SplitWords } from '@/components/ui/Split';
import { Arrow } from '@/components/ui/Icon';

export function HomeFaq() {
  return (
    <section className="theme-light section relative" id="faq" aria-labelledby="home-faq-h">
      <div className="shell grid gap-[clamp(2rem,5vw,6rem)] lg:grid-cols-[.8fr_1.2fr]">
        <div className="grid content-start gap-6">
          <p className="eyebrow">FAQ</p>
          <h2 id="home-faq-h" className="display text-h2">
            <SplitWords text="Kurz erklärt." />
          </h2>
          <Link href="/faq" className="tlink w-fit text-signal-bright">
            Alle Fragen <Arrow />
          </Link>
        </div>
        <FaqList items={HOME_FAQS} />
      </div>
    </section>
  );
}
