import type { Metadata } from 'next';
import { BIZ, BIZ_VERIFIED, FAQS, GOOGLE_PROFILE_URL, REGION_PAGES, SERVICE_PAGES, SITE_URL, type Faq } from './content';
import { IS_PREVIEW } from './site';

export const OG_IMAGE = '/assets/img/og-ing-gutachten.png';

/** Absolute URL einer Seite – immer auf der konfigurierten Produktivdomain, mit Trailing Slash. */
export function absoluteUrl(path: string): string {
  return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path.replace(/\/+$/, '')}/`;
}

/** Baut die Standard-Metadaten einer Seite inkl. Canonical und Open Graph. */
export function buildMetadata(opts: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  /** true = Titel steht komplett für sich, ohne „| ING Gutachten“-Suffix. */
  absoluteTitle?: boolean;
}): Metadata {
  const url = absoluteUrl(opts.path);
  const index = !opts.noindex && !IS_PREVIEW;
  const fullTitle = opts.absoluteTitle ? opts.title : `${opts.title} | ING Gutachten`;
  return {
    title: opts.absoluteTitle ? { absolute: opts.title } : opts.title,
    description: opts.description,
    alternates: { canonical: url },
    robots: index
      ? { index: true, follow: true, 'max-image-preview': 'large' }
      : { index: false, follow: true },
    openGraph: {
      type: 'website',
      locale: 'de_DE',
      siteName: 'ING Gutachten',
      title: fullTitle,
      description: opts.description,
      url,
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: 'ING Gutachten – Kfz-Sachverständigenbüro Hannover' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: opts.description,
      images: [OG_IMAGE],
    },
  };
}

export function localBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': ['ProfessionalService', 'LocalBusiness'],
    '@id': `${SITE_URL}/#business`,
    name: BIZ.name,
    alternateName: 'ING Gutachten',
    description:
      'Unabhängiges Kfz-Sachverständigenbüro in Hannover: Unfallgutachten, Schadengutachten, Wertgutachten und Kostenvoranschläge für PKW, LKW, Elektro- und Hybridfahrzeuge, Motorräder und Oldtimer. Vor-Ort-Service in Hannover und Umgebung.',
    url: `${SITE_URL}/`,
    telephone: '+49 511 54300976',
    // Nur ausgeben, was verifiziert ist (siehe BIZ_VERIFIED in content.ts).
    ...(BIZ_VERIFIED.email ? { email: BIZ.email } : {}),
    image: `${SITE_URL}${OG_IMAGE}`,
    logo: `${SITE_URL}/assets/img/logo.svg`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: BIZ.street,
      postalCode: BIZ.zip,
      addressLocality: BIZ.city,
      addressRegion: 'Niedersachsen',
      addressCountry: 'DE',
    },
    ...(BIZ_VERIFIED.geo ? { geo: { '@type': 'GeoCoordinates', latitude: BIZ.lat, longitude: BIZ.lng } } : {}),
    ...(BIZ_VERIFIED.hours
      ? {
          openingHoursSpecification: [
            { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '08:00', closes: '18:00' },
          ],
        }
      : {}),
    ...(GOOGLE_PROFILE_URL ? { sameAs: [GOOGLE_PROFILE_URL], hasMap: GOOGLE_PROFILE_URL } : {}),
    areaServed: [
      { '@type': 'City', name: 'Hannover' },
      ...REGION_PAGES.map((r) => ({ '@type': 'City', name: r.name })),
    ],
    knowsAbout: [
      'Unfallgutachten', 'Schadengutachten', 'Wertgutachten', 'Achsvermessung',
      'Karosserievermessung', 'Restwertermittlung', 'Wertminderung', 'Nutzungsausfall',
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Kfz-Gutachten',
      itemListElement: SERVICE_PAGES.map((s) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: s.title, url: absoluteUrl(s.href) },
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
      item: absoluteUrl(t.href),
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
    url: absoluteUrl(path),
    provider: { '@id': `${SITE_URL}/#business` },
    areaServed: { '@type': 'City', name: 'Hannover' },
    audience: { '@type': 'Audience', audienceType: 'Fahrzeughalter, Geschädigte, Anwälte, Versicherungen' },
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: 'ING Gutachten',
    url: `${SITE_URL}/`,
    inLanguage: 'de-DE',
    publisher: { '@id': `${SITE_URL}/#business` },
  };
}
