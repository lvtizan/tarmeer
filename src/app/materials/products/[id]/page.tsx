export const dynamic = 'force-dynamic';

// 新材料产品详情页 — spec §1.2 / §6
// 铁律：params 键名 `id` 与目录名 [id] 一致；非 AE 或产品不存在一律 notFound()（禁止软 404）。

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import ProductDetailClient from '@/components/materials/ProductDetailClient';
import { getCountry } from '@/lib/country';
import { fetchMaterialProduct, fetchSupplierCatalogs } from '@/lib/materialsApi';
import { resolveImageUrl } from '@/lib/imageUrl';
import { jsonLdHtml } from '@/lib/schema/jsonLdScript';

interface PageProps {
  params: Promise<{ id: string }>;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** category/scene slug → 展示 label（服务端用，不依赖客户端 hook）：flooring → Flooring */
function prettifyCategory(cat: string | null | undefined): string {
  return cat ? cat.replace(/[_-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) : '';
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
  const catLabel = prettifyCategory(product.category);
  // 标题：品名 + 品类 + 地域关键词。不手拼 " | Tarmeer"（root layout 模板会追加 → 避免双 Tarmeer）
  const title = catLabel ? `${name} — ${catLabel} in the UAE` : `${name} — New Material in the UAE`;

  // 描述：真实描述去遮蔽(***)后够料就用；否则用 specs 拼出关键词丰富的兜底描述
  const cleanDesc = (product.description || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  const specText = product.specs.map((s) => `${s.label}: ${s.value}`).join(' · ');
  const description = cleanDesc.length >= 40
    ? truncate(cleanDesc, 155)
    : truncate(
        [`${name}${catLabel ? ` — ${catLabel}` : ''} building material available in the UAE via Tarmeer.`, specText]
          .filter(Boolean)
          .join(' '),
        160,
      );

  // keywords：品名 + 品类 + 应用场景 + 地域长尾（去重去空）
  const keywords = Array.from(
    new Set(
      [
        name,
        catLabel,
        ...product.application_scenes.map((s) => prettifyCategory(s)),
        catLabel ? `${catLabel} UAE` : '',
        catLabel ? `${catLabel} Dubai` : '',
        'building materials UAE',
        'building materials Dubai',
        'construction materials Dubai',
        'Tarmeer',
      ].filter(Boolean) as string[],
    ),
  );

  const url = `${c.baseUrl}/materials/products/${product.id}`;
  const ogImage = toAbsoluteImage(product.image_url, c.baseUrl);

  return {
    title,
    description,
    keywords,
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
  // 供应商图册（PDF→电子书）；无则空数组，客户端据此隐藏阅读器模块
  const catalogs = product.supplier_slug
    ? await fetchSupplierCatalogs(product.supplier_slug, c.code)
    : [];
  const name = product.title || 'New Material';
  const catLabel = prettifyCategory(product.category);
  const productUrl = `${c.baseUrl}/materials/products/${product.id}`;
  const images = (product.image_urls.length ? product.image_urls : [product.image_url])
    .map((img) => toAbsoluteImage(img, c.baseUrl))
    .filter((img): img is string => Boolean(img));

  const cleanDesc = (product.description || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  const materialSpec = product.specs.find((s) => /material|材质/i.test(s.label));
  // specs + certifications → 结构化 additionalProperty（Product 富结果 + 关键词）
  const additionalProperty = [
    ...product.specs.map((s) => ({ '@type': 'PropertyValue', name: s.label, value: s.value })),
    ...product.certifications.map((cert) => ({ '@type': 'PropertyValue', name: 'Certification', value: cert })),
  ];

  // Product schema：brand=supplier；offers 不外显价格（spec §6，业务定价不外显）
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${productUrl}#product`,
    name,
    url: productUrl,
    sku: String(product.id),
    ...(images.length ? { image: images } : {}),
    ...(cleanDesc ? { description: truncate(cleanDesc, 300) } : {}),
    ...(catLabel ? { category: catLabel } : {}),
    ...(materialSpec ? { material: materialSpec.value } : {}),
    ...(additionalProperty.length ? { additionalProperty } : {}),
    ...(product.supplier_name ? { brand: { '@type': 'Brand', name: product.supplier_name } } : {}),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: c.baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Materials', item: `${c.baseUrl}/materials` },
      { '@type': 'ListItem', position: 3, name: 'New Materials', item: `${c.baseUrl}/materials/new-materials` },
      { '@type': 'ListItem', position: 4, name, item: productUrl },
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
      <ProductDetailClient product={product} related={related} catalogs={catalogs} />
    </>
  );
}
