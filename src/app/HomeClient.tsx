import type { Metadata } from 'next';
import HomeClient from './HomeClient';

export const metadata: Metadata = {
  title: 'Music Market | Direct-to-Fan Music Storefront & Streaming Hub for Independent Artists',
  description:
    'Music Market is the central direct-to-fan hub for independent artists and record labels. Route listeners to streaming platforms, sell digital music directly with instant payouts, and build your fan list.',
  keywords: [
    'sell music direct to fans',
    'independent artist storefront',
    'music smart link and store',
    'direct to fan music platform',
    'record label distribution hub',
    'Music Market',
    '2G Entertainment',
  ],
  alternates: {
    canonical: 'https://musicmarket.app',
  },
  openGraph: {
    title: 'Music Market | Direct-to-Fan Solutions for Artists & Labels',
    description:
      'Guide fans frictionlessly to streaming platforms while offering direct track purchases, audience capture, and instant payouts.',
    url: 'https://musicmarket.app',
    siteName: 'Music Market',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Music Market | Direct-to-Fan Music Storefront',
    description:
      'Centralize your catalog, sell music directly to fans, and keep up to 95% of your revenue.',
  },
};

export default function Page() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': 'https://musicmarket.app/#website',
        name: 'Music Market',
        url: 'https://musicmarket.app',
        description:
          'Direct-to-fan music storefront, smart streaming bridge, and catalog hub for independent artists and record labels.',
        publisher: {
          '@id': 'https://musicmarket.app/#organization',
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://musicmarket.app/market?q={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        '@id': 'https://musicmarket.app/#organization',
        name: 'Music Market',
        url: 'https://musicmarket.app',
        parentOrganization: {
          '@type': 'Organization',
          name: '2G Entertainment',
        },
      },
      {
        '@type': 'SoftwareApplication',
        name: 'Music Market',
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Web, iOS, Android',
        url: 'https://musicmarket.app',
        description:
          'A direct-to-fan music commerce and listener routing platform enabling independent artists and labels to sell digital tracks, capture fan emails, and link instant payouts.',
        offers: [
          {
            '@type': 'Offer',
            name: 'Free Hub',
            price: '0.00',
            priceCurrency: 'USD',
            description: '10-song centralized catalog hub with direct track sales and Stripe Express payouts.',
          },
          {
            '@type': 'Offer',
            name: 'Independent Artist',
            price: '9.99',
            priceCurrency: 'USD',
            description: 'Unlimited catalog uploads, custom player branding, fan list capture, and 10% platform commission.',
          },
          {
            '@type': 'Offer',
            name: 'Imprint & Label',
            price: '29.99',
            priceCurrency: 'USD',
            description: 'Multi-artist roster management, unified analytics, and 5% platform commission.',
          },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, '\\u003c'),
        }}
      />
      <HomeClient />
    </>
  );
}
