export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import SupplierDetailClient from '@/components/materials/SupplierDetailClient';
import { getCountry } from '@/lib/country';

const API_BASE_STATIC = process.env.NEXT_PUBLIC_API_URL?.trim() ?? process.env.API_INTERNAL_URL?.trim() ?? 'http://localhost:3002/api';

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  try {
    const res = await fetch(`${API_BASE_STATIC}/suppliers/public?limit=200`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json() as { suppliers?: Array<{ slug: string }> };
    return (data.suppliers ?? []).filter((s) => s.slug).map((s) => ({ slug: s.slug }));
  } catch {
    return [];
  }
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function fetchSupplierBasic(slug: string): Promise<{ company_name: string; description: string } | null> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || process.env.API_URL?.trim() || 'http://localhost:3002/api';
  try {
    const res = await fetch(`${API_BASE}/suppliers/detail/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.supplier || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const c = getCountry((await headers()).get('x-country'));
  const supplier = await fetchSupplierBasic(slug);

  if (!supplier) {
    return { title: 'Supplier Not Found | Tarmeer' };
  }

  const title = `${supplier.company_name} — Materials & Suppliers | Tarmeer ${c.name}`;
  const description =
    supplier.description
      ? `${supplier.description.slice(0, 155)} | Tarmeer`
      : `Browse products and projects from ${supplier.company_name} on Tarmeer.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${c.baseUrl}/materials/suppliers/${slug}`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `${c.baseUrl}/materials/suppliers/${slug}`,
    },
    keywords: [
      supplier.company_name,
      `building materials ${c.name}`,
      `material supplier ${c.defaultCity}`,
      'renovation supplies',
      'Tarmeer',
    ],
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
  };
}

export default async function SupplierDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const c = getCountry((await headers()).get('x-country'));
  const supplier = await fetchSupplierBasic(slug);
  if (!supplier) notFound();

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: c.baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Materials', item: `${c.baseUrl}/materials` },
      { '@type': 'ListItem', position: 3, name: supplier?.company_name ?? slug, item: `${c.baseUrl}/materials/suppliers/${slug}` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {supplier && (
        <div className="sr-only">
          <h1>{supplier.company_name}</h1>
          {supplier.description && <p>{supplier.description}</p>}
        </div>
      )}
      <SupplierDetailClient slug={slug} />
    </>
  );
}
