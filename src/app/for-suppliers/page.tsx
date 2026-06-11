import type { Metadata } from 'next';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import ForSuppliersClient from '@/components/for-suppliers/ForSuppliersClient';
import { getCountry } from '@/lib/country';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  return {
    title: 'List Your Showroom on Tarmeer — Supplier Portal',
    description: `List your furniture, stone, lighting or materials showroom on Tarmeer and get discovered by interior designers across ${c.name}.`,
    openGraph: {
      title: 'Tarmeer Supplier Portal — List Your Showroom',
      description: `Reach ${c.name} renovation companies and interior designers. Upload products, catalogs, and projects.`,
      images: [{ url: `${c.baseUrl}/images/tarmeer_logo.svg` }],
      url: `${c.baseUrl}/for-suppliers`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Tarmeer Supplier Portal — List Your Showroom',
      description: `Reach ${c.name} renovation companies and interior designers. Upload products, catalogs, and projects.`,
    },
    alternates: { canonical: `${c.baseUrl}/for-suppliers` },
    robots: 'index, follow, max-image-preview:large',
  };
}

export default function ForSuppliersPage() {
  return (
    <Suspense>
      <ForSuppliersClient />
    </Suspense>
  );
}
