/**
 * Zentrale Domain-Konfiguration.
 *
 * Production-Domain: https://ing-gutachten.de
 * Vercel-Adressen (*.vercel.app) dienen nur für Preview/Staging und werden
 * NIE als Canonical ausgegeben. Preview-Deployments sind zusätzlich noindex
 * (siehe robots.ts und buildMetadata).
 */
const PRODUCTION_URL = 'https://ing-gutachten.de';

function normalize(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

function resolveSiteUrl(): string {
  const fromEnv = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv && fromEnv.trim()) {
    const url = normalize(fromEnv);
    // Schutz: eine Vercel-Adresse darf in Production nie Canonical werden.
    if (process.env.VERCEL_ENV === 'production' && /\.vercel\.app$/i.test(new URL(url).hostname)) {
      return PRODUCTION_URL;
    }
    return url;
  }
  if (process.env.NODE_ENV === 'development') return 'http://localhost:3000';
  return PRODUCTION_URL;
}

export const SITE_URL = resolveSiteUrl();

/** true auf Vercel-Preview-Deployments – dort wird nichts indexiert. */
export const IS_PREVIEW = process.env.VERCEL_ENV === 'preview';
