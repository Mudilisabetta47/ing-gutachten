import type { Metadata } from 'next';
import { Hero } from '@/components/sections/Hero';
import { FactStrip } from '@/components/sections/FactStrip';
import { CrashSequence } from '@/components/sections/CrashSequence';
import { Leistungen } from '@/components/sections/Leistungen';
import { DamageConfigurator } from '@/components/sections/DamageConfigurator';
import { WhyIng } from '@/components/sections/WhyIng';
import { AblaufRail } from '@/components/sections/AblaufRail';
import { ServiceMap } from '@/components/sections/ServiceMap';
import { HomeFaq } from '@/components/sections/HomeFaq';
import { RequestSection } from '@/components/sections/RequestSection';
import { JsonLd } from '@/components/ui/JsonLd';
import { HOME_FAQS } from '@/lib/content';
import { buildMetadata, faqSchema, websiteSchema } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Kfz-Gutachter & Sachverständiger Hannover | ING Gutachten',
  absoluteTitle: true,
  description:
    'Unabhängiger Kfz-Gutachter in Hannover: Unfallgutachten, Schadengutachten und PKW-Gutachten mit Vor-Ort-Service. Jetzt Schaden melden oder anrufen.',
  path: '/',
});

/**
 * Startseite in zehn Akten:
 * Hero · Fakten · Unfall-Film (Fahrt → Gutachten) · Leistungen · Konfigurator ·
 * Warum ING · Ablauf · Hannover · FAQ · Schaden melden.
 */
export default function HomePage() {
  return (
    <>
      <JsonLd data={[websiteSchema(), faqSchema(HOME_FAQS)]} />
      <Hero />
      <FactStrip />
      <CrashSequence />
      <Leistungen />
      <DamageConfigurator />
      <WhyIng />
      <AblaufRail />
      <ServiceMap />
      <HomeFaq />
      <RequestSection />
    </>
  );
}
