import type { Metadata } from 'next';
import { FAQ_DATA } from '@/components/faq/faqData';
import FaqClient from '@/components/faq/FaqClient';

export const metadata: Metadata = {
  title: 'FAQ - Interior Design Questions & Answers',
  description:
    'Frequently asked questions about interior design in the UAE. Learn about design costs, renovation timelines, company selection, popular styles, and how Tarmeer helps you find the right design company.',
  openGraph: {
    title: 'FAQ - Interior Design Questions & Answers | Tarmeer',
    description:
      'Answers to common questions about interior design companies, costs, styles, and renovation services in the UAE.',
    url: 'https://www.tarmeer.com/faq',
    images: [{ url: 'https://www.tarmeer.com/og-default.jpg' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FAQ - Interior Design Questions & Answers | Tarmeer',
    description: 'Answers to common questions about interior design in the UAE.',
    images: ['https://www.tarmeer.com/og-default.jpg'],
  },
  alternates: {
    canonical: 'https://www.tarmeer.com/faq',
  },
  keywords: [
    'interior design FAQ',
    'UAE renovation questions',
    'Dubai design cost',
    'interior design companies UAE',
    'home renovation process',
    'design styles UAE',
    'Tarmeer',
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

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
