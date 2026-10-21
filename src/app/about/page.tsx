import type { Metadata } from 'next';
import { headers } from 'next/headers';
import AboutClient from '@/components/about/AboutClient';
import { getCountry } from '@/lib/country';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  return {
    title: `About Us | Tarmeer ${c.name}`,
    description: 'Tarmeer connects homeowners with verified design, build and renovation companies — and trusted building-materials suppliers — across the UAE.',
    alternates: { canonical: `${c.baseUrl}/about` },
    openGraph: {
      title: `About Tarmeer ${c.name}`,
      description: 'Connecting homeowners with trusted design, build and renovation partners.',
      url: `${c.baseUrl}/about`,
      type: 'website',
    },
  };
}

export default function AboutPage() {
  return <AboutClient />;
}
