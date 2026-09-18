import type { Metadata } from 'next';
import { BIZ, FAQS, SITE_URL, type Faq } from './content';

/** Baut die Standard-Metadaten einer Seite inkl. Canonical und Open Graph. */
export function buildMetadata(opts: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}): Metadata {
  const url = opts.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${opts.path}/`;
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    robots: opts.noindex
      ? { index: false, follow: true }
      : { index: true, follow: true, 'max-image-preview': 'large' },
    openGraph: {
      type: 'website',
      locale: 'de_DE',
      siteName: 'Rose Café Bremen',
      title: opts.title,
      description: opts.description,
      url,
      images: [{ url: '/assets/img/og-rose-cafe.svg', width: 1200, height: 630, alt: 'Rose Café Bremen' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: opts.title,
      description: opts.description,
      images: ['/assets/img/og-rose-cafe.svg'],
    },
  };
}

export function localBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': ['CafeOrCoffeeShop', 'LocalBusiness'],
    '@id': `${SITE_URL}/#business`,
    name: BIZ.name,
    alternateName: 'Rose Café',
    description:
      'Café in Bremen-Schwachhausen: Frühstück, Kaffee, hausgemachte Kuchen und Desserts in warmer, editorialer Atmosphäre.',
    url: `${SITE_URL}/`,
    telephone: BIZ.phoneLink,
    email: BIZ.email,
    image: `${SITE_URL}/assets/img/og-rose-cafe.svg`,
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: BIZ.street,
      postalCode: BIZ.zip,
      addressLocality: BIZ.city,
      addressRegion: 'Bremen',
      addressCountry: 'DE',
    },
    geo: { '@type': 'GeoCoordinates', latitude: BIZ.lat, longitude: BIZ.lng },
    servesCuisine: ['Café', 'Frühstück', 'Kuchen & Desserts'],
    sameAs: [BIZ.instagramHref],
  };
}

export function faqSchema(items: Faq[] = FAQS) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Rose Café Bremen',
    url: `${SITE_URL}/`,
    inLanguage: 'de-DE',
  };
}
