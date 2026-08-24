import type { Metadata } from 'next';
import { BIZ, FAQS, REGIONS, SERVICES, SITE_URL, type Faq } from './content';

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
      siteName: 'ING Gutachten',
      title: opts.title,
      description: opts.description,
      url,
      images: [{ url: '/assets/img/og-ing-gutachten.jpg', width: 1200, height: 630, alt: 'ING Gutachten – Kfz-Sachverständigenbüro Hannover' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: opts.title,
      description: opts.description,
      images: ['/assets/img/og-ing-gutachten.jpg'],
    },
  };
}

export function localBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': ['AutomotiveBusiness', 'ProfessionalService', 'LocalBusiness'],
    '@id': `${SITE_URL}/#business`,
    name: BIZ.name,
    alternateName: 'ING Gutachten',
    description:
      'Unabhängiges Kfz-Sachverständigenbüro in Hannover: Unfallgutachten, Schadengutachten, Wertgutachten und Kostenvoranschläge für PKW, LKW, Elektro- und Hybridfahrzeuge, Motorräder und Oldtimer. Vor-Ort-Service in Hannover und Umgebung.',
    url: `${SITE_URL}/`,
    telephone: '+49 511 54300976',
    email: BIZ.email,
    image: `${SITE_URL}/assets/img/og-ing-gutachten.jpg`,
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: BIZ.street,
      postalCode: BIZ.zip,
      addressLocality: BIZ.city,
      addressRegion: 'Niedersachsen',
      addressCountry: 'DE',
    },
    geo: { '@type': 'GeoCoordinates', latitude: BIZ.lat, longitude: BIZ.lng },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        opens: '08:00',
        closes: '18:00',
      },
    ],
    areaServed: REGIONS.map((r) => ({ '@type': 'City', name: r.name.split(' /')[0] })),
    knowsAbout: [
      'Unfallgutachten', 'Schadengutachten', 'Wertgutachten', 'Achsvermessung',
      'Karosserievermessung', 'Restwertermittlung', 'Wertminderung', 'Nutzungsausfall',
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Kfz-Gutachten',
      itemListElement: SERVICES.map((s) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: s.title, url: `${SITE_URL}${s.href}/` },
      })),
    },
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

export function breadcrumbSchema(trail: { name: string; href: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: `${SITE_URL}${t.href === '/' ? '/' : `${t.href}/`}`,
    })),
  };
}

export function serviceSchema(name: string, description: string, path: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    serviceType: name,
    description,
    url: `${SITE_URL}${path}/`,
    provider: { '@id': `${SITE_URL}/#business` },
    areaServed: { '@type': 'City', name: 'Hannover' },
    audience: { '@type': 'Audience', audienceType: 'Fahrzeughalter, Geschädigte, Anwälte, Versicherungen' },
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'ING Gutachten',
    url: `${SITE_URL}/`,
    inLanguage: 'de-DE',
  };
}
