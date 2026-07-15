export const dynamic = 'force-dynamic';

// 新材料产品详情页 — spec §1.2 / §6
// 铁律：params 键名 `id` 与目录名 [id] 一致；非 AE 或产品不存在一律 notFound()（禁止软 404）。

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import ProductDetailClient from '@/components/materials/ProductDetailClient';
import { getCountry } from '@/lib/country';
import { fetchMaterialProduct } from '@/lib/materialsApi';
import { resolveImageUrl } from '@/lib/imageUrl';
import { jsonLdHtml } from '@/lib/schema/jsonLdScript';

interface PageProps {
  params: Promise<{ id: string }>;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** 相对路径图片补 baseUrl（resolveImageUrl 已规范 /uploads → /api/uploads；禁止 https:/// 三斜杠） */
function toAbsoluteImage(url: string | null | undefined, baseUrl: string): string | undefined {
  const resolved = resolveImageUrl(url);
  if (!resolved) return undefined;
  if (resolved.startsWith('http')) return resolved;
  return `${baseUrl}${resolved.startsWith('/') ? '' : '/'}${resolved}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const c = getCountry((await headers()).get('x-country'));
  // 非 AE / 产品缺失：metadata 与页面体同口径 notFound（全站新页面统一写法，禁软 404）
  if (c.code !== 'ae') notFound();
  const detail = await fetchMaterialProduct(id, c.code);
  if (!detail) notFound();

  const { product } = detail;
  const name = product.title || 'New Material';
  const title = `${name} | New Materials | Tarmeer`;
  const description = product.description
    ? truncate(product.description, 155)
    : `${name} — curated new material from ${product.supplier_name || 'a verified supplier'}, available in the UAE through Tarmeer.`;
  const url = `${c.baseUrl}/materials/products/${product.id}`;
  const ogImage = toAbsoluteImage(product.image_url, c.baseUrl);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: { card: 'summary_large_image', title, description },
    alternates: { canonical: url },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
  };
}

export default async function MaterialProductPage({ params }: PageProps) {
  const { id } = await params;
  const c = getCountry((await headers()).get('x-country'));
  // 国家门禁：新材料页 AE 专属，VN 站访问一律 404
  if (c.code !== 'ae') notFound();

  const detail = await fetchMaterialProduct(id, c.code);
  if (!detail) notFound();

  const { product, related } = detail;
  const name = product.title || 'New Material';
  const productUrl = `${c.baseUrl}/materials/products/${product.id}`;
  const images = (product.image_urls.length ? product.image_urls : [product.image_url])
    .map((img) => toAbsoluteImage(img, c.baseUrl))
    .filter((img): img is string => Boolean(img));

  // Product schema：brand=supplier；offers 不外显价格（spec §6，业务定价不外显）
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${productUrl}#product`,
    name,
    url: productUrl,
    ...(images.length ? { image: images } : {}),
    ...(product.description ? { description: truncate(product.description, 300) } : {}),
    ...(product.category ? { category: product.category } : {}),
    ...(product.supplier_name ? { brand: { '@type': 'Brand', name: product.supplier_name } } : {}),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: c.baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Materials', item: `${c.baseUrl}/materials` },
      { '@type': 'ListItem', position: 3, name, item: productUrl },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbJsonLd) }}
      />
      <ProductDetailClient product={product} related={related} />
    </>
  );
}
