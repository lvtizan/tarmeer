import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getCountry } from '@/lib/country';
import { FAQ_DATA } from '@/components/faq/faqData';
import FaqClient from '@/components/faq/FaqClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  return {
    title: 'FAQ - Interior Design Questions & Answers',
    description:
      `Frequently asked questions about interior design in ${c.name}. Learn about design costs, renovation timelines, company selection, popular styles, and how Tarmeer helps you find the right design company.`,
    openGraph: {
      title: 'FAQ - Interior Design Questions & Answers | Tarmeer',
      description:
        `Answers to common questions about interior design companies, costs, styles, and renovation services in ${c.name}.`,
      url: `${c.baseUrl}/faq`,
      images: [{ url: `${c.baseUrl}/og-default.jpg` }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'FAQ - Interior Design Questions & Answers | Tarmeer',
      description: `Answers to common questions about interior design in ${c.name}.`,
      images: [`${c.baseUrl}/og-default.jpg`],
    },
    alternates: {
      canonical: `${c.baseUrl}/faq`,
    },
    keywords: [
      'interior design FAQ',
      `${c.name} renovation questions`,
      `${c.defaultCity} design cost`,
      `interior design companies ${c.name}`,
      'home renovation process',
      `design styles ${c.name}`,
      'Tarmeer',
    ],
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
  };
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_DATA.flatMap(cat =>
    cat.items.map(item => ({
      '@type': 'Question',
      name: item.q.en,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a.en,
      },
    }))
  ),
};

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FaqClient />
    </>
  );
}
