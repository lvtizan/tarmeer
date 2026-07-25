import type { Metadata } from 'next';
import { Suspense } from 'react';
import { headers } from 'next/headers';
import MaterialsClient, { type Supplier } from '@/components/materials/MaterialsClient';
import MaterialsTabs from '@/components/materials/MaterialsTabs';
import { getCountry } from '@/lib/country';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  return {
    title: `Materials & Suppliers — Interior Design Showrooms | Tarmeer ${c.name}`,
    description:
      `Discover premium building material suppliers from China and ${c.defaultCity} for your ${c.name} renovation project. Furniture, stone, lighting, flooring, and more.`,
    openGraph: {
      title: `Materials & Suppliers — Interior Design Showrooms | Tarmeer ${c.name}`,
      description:
        'Explore Tarmeer\'s verified suppliers for premium building materials — furniture, stone, lighting, flooring, and more.',
      images: [{ url: `${c.baseUrl}/images/tarmeer_logo.svg` }],
      url: `${c.baseUrl}/materials`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
    },
    alternates: {
      canonical: `${c.baseUrl}/materials`,
    },
    keywords: [
      `building materials ${c.name}`,
      `suppliers ${c.cities.slice(0, 2).join(' ')}`,
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
}

async function fetchInitialSuppliers(country: string): Promise<Supplier[]> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || process.env.API_URL?.trim() || 'http://localhost:3002/api';
  try {
    // 国家隔离：SSR 出站 fetch 不会自动继承入站 x-country，必须显式带上（?country= 穿透 dev proxy + x-country 头直连 server），否则 VN 站首屏 SSR 会渲染 AE 供应商
    const res = await fetch(`${API_BASE}/suppliers?limit=200&country=${country}`, {
      next: { revalidate: 3600 },
      headers: { 'x-country': country },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.suppliers || [];
  } catch {
    return [];
  }
}

export default async function MaterialsPage() {
  const c = getCountry((await headers()).get('x-country'));
  // 新材料已拆到独立页 /materials/new-materials；本页专注供应商目录
  const isAe = c.code === 'ae';
  const initialSuppliers = await fetchInitialSuppliers(c.code);

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Material Suppliers in ${c.name} — Tarmeer`,
    description: `Verified building material suppliers from China and ${c.defaultCity} for renovation projects in ${c.name}.`,
    url: `${c.baseUrl}/materials`,
    publisher: {
      '@type': 'Organization',
      name: 'Tarmeer',
      url: c.baseUrl,
      logo: { '@type': 'ImageObject', url: `${c.baseUrl}/images/tarmeer_logo.svg` },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <Suspense fallback={<div className="py-20 text-center text-stone-400">Loading suppliers...</div>}>
        {isAe ? (
          <MaterialsTabs initialSuppliers={initialSuppliers} showNewMaterialsEntry={isAe} />
        ) : (
          <MaterialsClient initialSuppliers={initialSuppliers} showNewMaterialsEntry={isAe} />
        )}
      </Suspense>
    </>
  );
}
