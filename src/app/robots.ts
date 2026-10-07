import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/content';
import { IS_PREVIEW } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  // Preview-/Staging-Deployments auf Vercel werden nicht indexiert.
  if (IS_PREVIEW) return { rules: [{ userAgent: '*', disallow: '/' }] };
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
