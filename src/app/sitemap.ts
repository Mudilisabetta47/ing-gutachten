import type { MetadataRoute } from 'next';
import { REGION_PAGES, SERVICES, SITE_URL } from '@/lib/content';

export const dynamic = 'force-static';

/** Nur indexierbare Seiten – Impressum und Datenschutz sind noindex. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPaths: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' }[] = [
    { path: '/', priority: 1, changeFrequency: 'weekly' },
    { path: '/leistungen', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/wertgutachten', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/ablauf', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/einsatzgebiet', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/ueber-uns', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/faq', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/kontakt', priority: 0.9, changeFrequency: 'monthly' },
  ];

  const servicePaths = SERVICES.map((s) => ({
    path: s.href,
    priority: 0.85,
    changeFrequency: 'monthly' as const,
  }));

  const regionPaths = REGION_PAGES.map((r) => ({
    path: `/kfz-gutachter/${r.slug}`,
    priority: 0.7,
    changeFrequency: 'monthly' as const,
  }));

  const all = [...staticPaths, ...servicePaths, ...regionPaths];
  const seen = new Set<string>();

  return all
    .filter((entry) => (seen.has(entry.path) ? false : seen.add(entry.path)))
    .map((entry) => ({
      url: entry.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${entry.path}/`,
      lastModified: now,
      changeFrequency: entry.changeFrequency,
      priority: entry.priority,
    }));
}
