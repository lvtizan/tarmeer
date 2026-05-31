import type { Metadata } from 'next';
import { Suspense } from 'react';
import MaterialsClient, { type Supplier } from '@/components/materials/MaterialsClient';

export const metadata: Metadata = {
  title: 'Materials & Suppliers — Interior Design Showrooms | Tarmeer UAE',
  description:
    'Discover premium building material suppliers from China and Dubai for your UAE renovation project. Furniture, stone, lighting, flooring, and more.',
  openGraph: {
    title: 'Materials & Suppliers — Interior Design Showrooms | Tarmeer UAE',
    description:
      'Explore Tarmeer\'s verified suppliers for premium building materials — furniture, stone, lighting, flooring, and more.',
    images: [{ url: 'https://www.tarmeer.com/images/tarmeer_logo.svg' }],
    url: 'https://www.tarmeer.com/materials',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
  alternates: {
    canonical: 'https://www.tarmeer.com/materials',
  },
  keywords: [
    'building materials UAE',
    'suppliers Dubai Sharjah',
    'furniture stone lighting flooring',
    'renovation materials',
    'Tarmeer showroom',
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
};

const collectionJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Material Suppliers in UAE — Tarmeer',
  description: 'Verified building material suppliers from China and Dubai for renovation projects in the UAE.',
  url: 'https://www.tarmeer.com/materials',
  publisher: {
    '@type': 'Organization',
    name: 'Tarmeer',
    url: 'https://www.tarmeer.com',
    logo: { '@type': 'ImageObject', url: 'https://www.tarmeer.com/images/tarmeer_logo.svg' },
  },
};

async function fetchInitialSuppliers(): Promise<Supplier[]> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || process.env.API_URL?.trim() || '/api';
  try {
    const res = await fetch(`${API_BASE}/suppliers?limit=24`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.suppliers || [];
  } catch {
    return [];
  }
}

export default async function MaterialsPage() {
  const initialSuppliers = await fetchInitialSuppliers();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <Suspense fallback={<div className="py-20 text-center text-stone-400">Loading suppliers...</div>}>
        <MaterialsClient initialSuppliers={initialSuppliers} />
      </Suspense>
    </>
  );
}
