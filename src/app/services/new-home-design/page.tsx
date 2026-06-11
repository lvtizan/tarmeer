import type { Metadata } from 'next';
import { headers } from 'next/headers';
import NewHomeDesignClient from '@/components/services/NewHomeDesignClient';
import { getCountry } from '@/lib/country';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  return {
    title: 'New Home Design Service - Floor Plans & 3D Renderings | Tarmeer',
    description: `Professional new home interior design service in ${c.name}. Get floor plans, 3D renderings, construction drawings, and full material specifications.`,
    openGraph: {
      title: 'New Home Design Service | Tarmeer',
      description: `Floor plans, 3D renderings, and construction drawings for your new home in ${c.name}.`,
      images: [{ url: `${c.baseUrl}/og-default.jpg` }],
      type: 'website',
      url: `${c.baseUrl}/services/new-home-design`,
    },
    twitter: { card: 'summary_large_image' },
    keywords: [`new home design ${c.name}`, 'interior design service', 'floor plan', '3D rendering', 'construction drawings', 'Tarmeer'],
    robots: { index: true, follow: true },
    alternates: { canonical: `${c.baseUrl}/services/new-home-design` },
  };
}

export default function NewHomeDesignPage() {
  return <NewHomeDesignClient />;
}
