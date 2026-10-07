import type { MetadataRoute } from 'next';
import { REGION_PAGES, SERVICE_PAGES } from '@/lib/content';
import { absoluteUrl } from '@/lib/seo';

/** Nur indexierbare Seiten – Impressum/Datenschutz (noindex) und APIs fehlen bewusst. */
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' }[] = [
    { path: '/', priority: 1, changeFrequency: 'weekly' },
    { path: '/kfz-gutachter-hannover', priority: 0.95, changeFrequency: 'monthly' },
    { path: '/leistungen', priority: 0.9, changeFrequency: 'monthly' },
    ...SERVICE_PAGES.map((s) => ({ path: s.href, priority: 0.85, changeFrequency: 'monthly' as const })),
    { path: '/ablauf', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/einsatzgebiet', priority: 0.7, changeFrequency: 'monthly' },
    ...REGION_PAGES.map((r) => ({ path: `/kfz-gutachter/${r.slug}`, priority: 0.6, changeFrequency: 'monthly' as const })),
    { path: '/ueber-uns', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/faq', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/kontakt', priority: 0.9, changeFrequency: 'monthly' },
  ];

  const seen = new Set<string>();
  return entries
    .filter((e) => (seen.has(e.path) ? false : (seen.add(e.path), true)))
    .map((e) => ({
      url: absoluteUrl(e.path),
      changeFrequency: e.changeFrequency,
      priority: e.priority,
    }));
}
