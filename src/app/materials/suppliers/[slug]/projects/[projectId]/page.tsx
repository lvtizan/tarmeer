export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import SupplierProjectDetailClient from '@/components/materials/SupplierProjectDetailClient';
import { getCountry } from '@/lib/country';
import { resolveImageUrl } from '@/lib/imageUrl';
import { jsonLdHtml } from '@/lib/schema/jsonLdScript';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() ?? process.env.API_INTERNAL_URL?.trim() ?? 'http://localhost:3002/api';

interface PageProps {
  params: Promise<{ slug: string; projectId: string }>;
}

interface ProjectDetail {
  supplier: { id: number; company_name: string; slug: string; logo_url: string | null };
  project: { id: number; title: string; description: string | null; images: string[] | string | null };
}

/** 服务端取项目详情；缺失返回 null（→ notFound，禁止软 404） */
async function fetchProjectDetail(slug: string, projectId: string): Promise<ProjectDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/suppliers/detail/${slug}/projects/${projectId}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<ProjectDetail>;
    if (!data?.supplier || !data?.project) return null;
    return data as ProjectDetail;
  } catch {
    return null;
  }
}

/** project.images（string[] | JSON 字符串 | null）→ 首张 resolve 后的图 URL */
function firstImage(raw: string[] | string | null): string | null {
  let arr: unknown;
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === 'string') { try { arr = JSON.parse(raw); } catch { return null; } }
  else return null;
  if (!Array.isArray(arr)) return null;
  for (const x of arr) {
    const resolved = x ? resolveImageUrl(String(x)) : '';
    if (resolved) return resolved;
  }
  return null;
}

function toAbsolute(url: string | null, baseUrl: string): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, projectId } = await params;
  const c = getCountry((await headers()).get('x-country'));
  const detail = await fetchProjectDetail(slug, projectId);
  if (!detail) return { title: 'Project Not Found | Tarmeer', robots: { index: false, follow: false } };

  const { supplier, project } = detail;
  const title = `${project.title} — ${supplier.company_name} | Tarmeer ${c.name}`;
  const description = project.description
    ? `${project.description.slice(0, 155)}`
    : `View the ${project.title} project by ${supplier.company_name} on Tarmeer ${c.name}.`;
  const canonical = `${c.baseUrl}/materials/suppliers/${slug}/projects/${projectId}`;
  const image = toAbsolute(firstImage(project.images), c.baseUrl);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      title,
      description,
      url: canonical,
      ...(image ? { images: [{ url: image, alt: project.title }] } : {}),
    },
    twitter: { card: 'summary_large_image', ...(image ? { images: [image] } : {}) },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
  };
}

export default async function SupplierProjectDetailPage({ params }: PageProps) {
  const { slug, projectId } = await params;
  const c = getCountry((await headers()).get('x-country'));
  const detail = await fetchProjectDetail(slug, projectId);
  if (!detail) notFound();

  const { supplier, project } = detail;
  const canonical = `${c.baseUrl}/materials/suppliers/${slug}/projects/${projectId}`;
  const image = toAbsolute(firstImage(project.images), c.baseUrl);

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: c.baseUrl },
      { '@type': 'ListItem', position: 2, name: 'Materials', item: `${c.baseUrl}/materials` },
      { '@type': 'ListItem', position: 3, name: supplier.company_name, item: `${c.baseUrl}/materials/suppliers/${slug}` },
      { '@type': 'ListItem', position: 4, name: project.title, item: canonical },
    ],
  };
  const projectJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    '@id': `${canonical}#project`,
    name: project.title,
    url: canonical,
    ...(project.description ? { description: project.description.slice(0, 300) } : {}),
    ...(image ? { image } : {}),
    creator: { '@type': 'Organization', name: supplier.company_name, url: `${c.baseUrl}/materials/suppliers/${slug}` },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(projectJsonLd) }} />
      {/* SSR SEO 正文兜底（客户端组件水合前爬虫可读） */}
      <div className="sr-only">
        <h1>{project.title} — {supplier.company_name}</h1>
        {project.description && <p>{project.description}</p>}
      </div>
      <SupplierProjectDetailClient />
    </>
  );
}
