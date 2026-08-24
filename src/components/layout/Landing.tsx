import type { ReactNode } from 'react';
import { PageHero, type Crumb } from '@/components/sections/PageHero';
import { FaqSection } from '@/components/sections/FaqSection';
import { RelatedCards, type Related } from '@/components/sections/RelatedCards';
import { CtaBand } from '@/components/sections/CtaBand';
import { JsonLd } from '@/components/ui/JsonLd';
import { breadcrumbSchema, faqSchema, serviceSchema } from '@/lib/seo';
import type { Faq } from '@/lib/content';

/**
 * Gerüst aller Unterseiten: Brotkrumen, Hero, Inhalt, FAQ, Querverweise, CTA.
 * Strukturierte Daten werden aus denselben Props abgeleitet – so kann Markup
 * und sichtbarer Inhalt nicht auseinanderlaufen.
 */
export function Landing({
  eyebrow,
  title,
  lead,
  chips,
  trail,
  children,
  faqs,
  related,
  service,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  chips?: string[];
  trail: Crumb[];
  children: ReactNode;
  faqs?: Faq[];
  related?: Related[];
  service?: { name: string; description: string; path: string };
}) {
  const fullTrail: Crumb[] = [{ name: 'Startseite', href: '/' }, ...trail];
  const schemas: object[] = [breadcrumbSchema(fullTrail)];
  if (service) schemas.push(serviceSchema(service.name, service.description, service.path));
  if (faqs && faqs.length) schemas.push(faqSchema(faqs));

  return (
    <>
      <JsonLd data={schemas} />
      <PageHero eyebrow={eyebrow} title={title} lead={lead} trail={fullTrail} chips={chips} />
      {children}
      {faqs && faqs.length > 0 && <FaqSection items={faqs} slugRight={title} />}
      {related && related.length > 0 && <RelatedCards items={related} />}
      <CtaBand />
    </>
  );
}
