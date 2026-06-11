import type { Metadata } from 'next';
import { headers } from 'next/headers';
import SoftDecorationClient from '@/components/services/SoftDecorationClient';
import { getCountry } from '@/lib/country';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  return {
    title: 'Soft Decoration & Furniture Design Service | Tarmeer',
    description: `Professional soft decoration service in ${c.name}. Furniture selection, color schemes, lighting plans, and complete styling for move-in ready spaces.`,
    openGraph: {
      title: 'Soft Decoration & Furniture Design | Tarmeer',
      description: `Furniture, color schemes, lighting, and styling for your home in ${c.name}.`,
      images: [{ url: `${c.baseUrl}/og-default.jpg` }],
      type: 'website',
      url: `${c.baseUrl}/services/soft-decoration`,
    },
    twitter: { card: 'summary_large_image' },
    keywords: [`soft decoration ${c.name}`, 'furniture design', 'interior styling', 'color scheme', 'lighting plan', 'Tarmeer'],
    robots: { index: true, follow: true },
    alternates: { canonical: `${c.baseUrl}/services/soft-decoration` },
  };
}

export default function SoftDecorationPage() {
  return <SoftDecorationClient />;
}
