import type { Faq } from '@/lib/content';
import { FaqList } from './Faq';
import { Slug } from '@/components/ui/Slug';

export function FaqSection({
  items,
  title = 'Häufige Fragen',
  slugRight = 'Häufige Fragen',
}: {
  items: Faq[];
  title?: string;
  slugRight?: string;
}) {
  return (
    <section className="section" aria-labelledby="faq-h">
      <div className="shell">
        <Slug left="FAQ" right={slugRight} />
        <h2 id="faq-h" className="display mb-10 text-[clamp(1.7rem,3.6vw,2.6rem)]">
          {title}
        </h2>
        <FaqList items={items} />
      </div>
    </section>
  );
}
