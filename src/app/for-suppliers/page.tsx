import type { Metadata } from 'next';
import { Suspense } from 'react';
import ForSuppliersClient from '@/components/for-suppliers/ForSuppliersClient';

export const metadata: Metadata = {
  title: 'List Your Showroom on Tarmeer — Supplier Portal',
  description: 'List your furniture, stone, lighting or materials showroom on Tarmeer and get discovered by interior designers across UAE.',
  openGraph: {
    title: 'Tarmeer Supplier Portal — List Your Showroom',
    description: 'Reach UAE renovation companies and interior designers. Upload products, catalogs, and projects.',
    images: [{ url: 'https://www.tarmeer.com/images/tarmeer_logo.svg' }],
    url: 'https://www.tarmeer.com/for-suppliers',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tarmeer Supplier Portal — List Your Showroom',
    description: 'Reach UAE renovation companies and interior designers. Upload products, catalogs, and projects.',
  },
  alternates: { canonical: 'https://www.tarmeer.com/for-suppliers' },
  robots: 'index, follow, max-image-preview:large',
};

export default function ForSuppliersPage() {
  return (
    <Suspense>
      <ForSuppliersClient />
    </Suspense>
  );
}
