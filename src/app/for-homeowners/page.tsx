import type { Metadata } from 'next';
import { headers } from 'next/headers';
import ForHomeownersClient from '@/components/for-homeowners/ForHomeownersClient';
import { getCountry } from '@/lib/country';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  return {
    title: `Find Renovation Companies in ${c.name} | Free Quotes | Tarmeer`,
    description: `Compare verified renovation companies in ${c.name}. Browse real portfolios, get free quotes, and find the perfect match for your home project.`,
    openGraph: {
      title: `Find Renovation Companies in ${c.name} | Free Quotes | Tarmeer`,
      description: 'Compare verified renovation companies, browse real portfolios, and get free quotes — all in one place.',
      images: [{ url: `${c.baseUrl}/images/tarmeer_logo.svg` }],
      url: `${c.baseUrl}/for-homeowners`,
      type: 'website',
    },
    twitter: { card: 'summary_large_image' },
    keywords: [`find renovation companies ${c.name}`, `home renovation ${c.defaultCity}`, 'interior design quotes', 'renovation platform', 'Tarmeer homeowners'],
    alternates: { canonical: `${c.baseUrl}/for-homeowners` },
  };
}

export default function ForHomeownersPage() {
  return <ForHomeownersClient />;
}
