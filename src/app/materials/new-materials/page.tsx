export const dynamic = 'force-dynamic';

// 新材料独立页 — 从 /materials 拆出（领导定：新材料与供应商分页）。
// 内容 = Browse by Application 场景瓦片 + Curated New Materials 产品流 + Showroom 预约。
// AE 专属：VN 站访问一律 notFound()（与新材料产品页同口径，禁软 404）。

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import MaterialsCatalogClient from '@/components/materials/MaterialsCatalogClient';
import ShowroomVisitSection from '@/components/materials/ShowroomVisitSection';
import { getCountry } from '@/lib/country';
import { fetchMaterialProducts } from '@/lib/materialsApi';

export async function generateMetadata(): Promise<Metadata> {
  const c = getCountry((await headers()).get('x-country'));
  if (c.code !== 'ae') notFound();
  const title = `New Materials — Curated by Space | Tarmeer ${c.name}`;
  const description = `The latest surfaces, fittings and finishes from China — furniture, stone, lighting, flooring and more, curated by where they live in a project. Available in the UAE through Tarmeer.`;
  const url = `${c.baseUrl}/materials/new-materials`;
  return {
    title,
    description,
    openGraph: { title, description, url, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
    alternates: { canonical: url },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
  };
}

export default async function NewMaterialsPage() {
  const c = getCountry((await headers()).get('x-country'));
  // 国家门禁：新材料页 AE 专属
  if (c.code !== 'ae') notFound();

  const initialProductsPage = await fetchMaterialProducts({ limit: 24 }, c.code);

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `New Materials — Curated by Space | Tarmeer ${c.name}`,
    description: `Curated new materials from China for renovation projects in ${c.name}.`,
    url: `${c.baseUrl}/materials/new-materials`,
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
      <div className="min-h-screen bg-[#faf9f7]">
        {/* Breadcrumb */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5">
          <nav className="flex items-center gap-1.5 text-xs text-stone-400">
            <a href="/" className="hover:text-[#b8864a] transition-colors">Home</a>
            <span>/</span>
            <a href="/materials" className="hover:text-[#b8864a] transition-colors">Materials</a>
            <span>/</span>
            <span className="text-stone-600 font-medium">New Materials</span>
          </nav>
        </div>
        <MaterialsCatalogClient initialProducts={initialProductsPage?.products ?? []} />
        <ShowroomVisitSection />
      </div>
    </>
  );
}
