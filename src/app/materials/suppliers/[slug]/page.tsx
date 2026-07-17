export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import SupplierDetailClient from '@/components/materials/SupplierDetailClient';
import { getCountry } from '@/lib/country';
import { resolveImageUrl } from '@/lib/imageUrl';
import { jsonLdHtml } from '@/lib/schema/jsonLdScript';
import { supplierPublicTitle } from '@/lib/supplierConstants';

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

interface SupplierBasic {
  company_name: string;
  description: string;
  logo_url?: string | null;
  contact_phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  google_maps_url?: string | null;
  store_address?: string | null;
  has_physical_store?: boolean | number | null;
  country?: string | null;
  categories?: unknown;
}

async function fetchSupplierBasic(slug: string): Promise<SupplierBasic | null> {
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

  // 公开去标识：用品类通用标题，不用真实/遮蔽后的厂家名（避免 title 变一串 ****，同时保 SEO 品类关键词）
  const pubTitle = supplierPublicTitle(supplier.categories);
  const title = `${pubTitle} in ${c.name}`; // root layout 模板会自动追加 " | Tarmeer"
  const description = `Browse verified products and catalogs from a ${pubTitle.toLowerCase()} in ${c.name} on Tarmeer.`;

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
      pubTitle,
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

  const supplierUrl = `${c.baseUrl}/materials/suppliers/${slug}`;
  // 公开去标识：用品类通用标题代替真实/遮蔽厂家名（title/JSON-LD/breadcrumb/h1 统一口径）
  const pubTitle = supplierPublicTitle(supplier.categories);

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: c.baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Materials', item: `${c.baseUrl}/materials` },
      { '@type': 'ListItem', position: 3, name: pubTitle, item: supplierUrl },
    ],
  };

  // website: 裸域名补协议;whatsapp: 电话号 → wa.me 链接(禁止直接拼 https://+号码);
  // logo: 相对路径经 resolveImageUrl 规范后补 baseUrl(禁止 https:///uploads 三斜杠)
  const toWebUrl = (v?: string | null): string | undefined => {
    if (!v) return undefined;
    return v.startsWith('http://') || v.startsWith('https://') ? v : `https://${v}`;
  };
  const toWaLink = (v?: string | null): string | undefined => {
    if (!v) return undefined;
    const digits = v.replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}` : undefined;
  };
  const toImage = (v?: string | null): string | undefined => {
    const resolved = resolveImageUrl(v);
    if (!resolved) return undefined;
    if (resolved.startsWith('http')) return resolved;
    return `${c.baseUrl}${resolved.startsWith('/') ? '' : '/'}${resolved}`;
  };
  const sameAs = [toWebUrl(supplier.website), toWaLink(supplier.whatsapp), supplier.google_maps_url ?? undefined]
    .filter((x): x is string => Boolean(x));
  const image = toImage(supplier.logo_url);
  const hasStore = Boolean(supplier.has_physical_store) && Boolean(supplier.store_address);
  const supplierJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${supplierUrl}#business`,
    name: pubTitle,
    url: supplierUrl,
    ...(supplier.description ? { description: supplier.description.slice(0, 300) } : {}),
    ...(image ? { image } : {}),
    ...(supplier.contact_phone ? { telephone: supplier.contact_phone } : {}),
    ...(hasStore
      ? { address: { '@type': 'PostalAddress', streetAddress: supplier.store_address, addressCountry: (supplier.country ?? c.isoCode).toUpperCase() } }
      : { areaServed: { '@type': 'Country', name: c.fullName } }),
    ...(sameAs.length ? { sameAs } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(supplierJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbJsonLd) }}
      />
      {supplier && (
        <div className="sr-only">
          <h1>{pubTitle}</h1>
          {supplier.description && <p>{supplier.description}</p>}
        </div>
      )}
      <SupplierDetailClient slug={slug} />
    </>
  );
}
