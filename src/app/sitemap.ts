import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/content';

export const dynamic = 'force-static';

/** Nur indexierbare Seiten – Impressum und Datenschutz sind noindex. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [{ path: '/', priority: 1, changeFrequency: 'weekly' as const }].map((entry) => ({
    url: entry.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${entry.path}/`,
    lastModified: now,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
