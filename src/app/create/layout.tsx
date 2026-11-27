import type { Metadata } from 'next';

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  'https://musicmarket.app'
).replace(/\/+$/, '');

const OG_IMAGE_URL =
  'https://www.2g-ent.com/uploads/2/7/5/9/27593217/youtube-banner-music-market-01-artboard-2_orig.jpg';

export const metadata: Metadata = {
  title: 'Music Market — Claim Your First Month Free (30-Day Trial)',
  description:
    'Stop sending fans away. Turn social media clicks into streaming traffic, direct single & album sales, and an owned fan email list. Start Artist or Label free for 30 days.',
  alternates: {
    canonical: `${SITE_URL}/create`,
  },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/create`,
    siteName: 'Music Market',
    title: 'Music Market Is Your Bridge — First Month Free',
    description:
      'Route listeners to every DSP, sell singles & albums direct with instant payouts, and capture your own fan list. Try Artist or Label free for 30 days—no promo code needed.',
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: 'Music Market — Direct-To-Fan Solutions',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Music Market Is Your Bridge — First Month Free',
    description:
      'Turn social media clicks into streaming traffic, direct sales, and owned fan data. Try Artist or Label free for 30 days.',
    images: [OG_IMAGE_URL],
  },
};

export default function CreateAdLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Music Market',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    url: `${SITE_URL}/create`,
    image: OG_IMAGE_URL,
    description:
      'Direct-to-fan music storefront, DSP smart-link router, and fan email capture platform for independent artists and record labels.',
    offers: [
      {
        '@type': 'Offer',
        name: 'Independent Artist Tier (30-Day Free Trial)',
        price: '0.00',
        priceCurrency: 'USD',
        description: 'First 30 days free, then $9.99/month. 10% platform commission split.',
      },
      {
        '@type': 'Offer',
        name: 'Imprint & Label Tier (30-Day Free Trial)',
        price: '0.00',
        priceCurrency: 'USD',
        description: 'First 30 days free, then $29.99/month. 5% platform commission split.',
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
