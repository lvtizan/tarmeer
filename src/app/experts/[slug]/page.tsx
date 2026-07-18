export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import ExpertDetailClient from '@/components/experts/ExpertDetailClient';
import type { ExpertDetail } from '@/components/experts/types';
import { getCountry } from '@/lib/country';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.trim() ??
  process.env.API_INTERNAL_URL?.trim() ?? 'http://localhost:3002/api';

async function fetchExpert(slug: string): Promise<ExpertDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/experts/${encodeURIComponent(slug)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { expert?: ExpertDetail };
    if (!data.expert) return null;
    const e = data.expert;
    // Normalize JSON array fields defensively
    return {
      ...e,
      services: Array.isArray(e.services) ? e.services : [],
      skills: Array.isArray(e.skills) ? e.skills : [],
      work_history: Array.isArray(e.work_history) ? e.work_history : [],
      certificates: Array.isArray(e.certificates) ? e.certificates : [],
      projects: Array.isArray(e.projects)
        ? e.projects.map(p => ({ ...p, images: Array.isArray(p.images) ? p.images : [], tags: Array.isArray(p.tags) ? p.tags : [] }))
        : [],
    };
  } catch {
    return null;
  }
}

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const headersList = await headers();
  const country = headersList.get('x-country') ?? 'ae';
  const isVn = country === 'vn';
  const baseUrl = getCountry(country).baseUrl; // 按国家切 canonical 域名

  const expert = await fetchExpert(slug);
  if (!expert) {
    return {
      title: isVn ? 'Hồ Sơ Nhà Thiết Kế - Tarmeer' : 'Designer Profile - Tarmeer',
      description: isVn
        ? 'Tìm các nhà thiết kế nội thất đã được xác minh trên Tarmeer.'
        : 'Find verified interior designers on Tarmeer.',
      alternates: { canonical: `${baseUrl}/experts/${slug}` },
    };
  }

  const serviceLabel = expert.services[0] || (isVn ? 'Nhà thiết kế nội thất' : 'Interior Designer');
  const locationPart = expert.city ? ` - ${expert.city}` : '';
  const title = `${expert.full_name} - ${serviceLabel}${locationPart} - Tarmeer`;
  const description = isVn
    ? `${expert.full_name} — ${expert.services.slice(0, 3).join(', ') || 'nhà thiết kế nội thất'}${expert.city ? ` tại ${expert.city}` : ''}.${Number(expert.experience_years) > 0 ? ` ${expert.experience_years} năm kinh nghiệm.` : ''} Xem hồ sơ, chứng chỉ và liên hệ trên Tarmeer.`
    : `${expert.full_name} — ${expert.services.slice(0, 3).join(', ') || 'interior designer'}${expert.city ? ` in ${expert.city}` : ''}.${Number(expert.experience_years) > 0 ? ` ${expert.experience_years} years of experience.` : ''} View profile, certificates and get in touch on Tarmeer.`;
  const canonical = `${baseUrl}/experts/${expert.slug || slug}`;

  return {
    title,
    description,
    robots: 'index, follow, max-image-preview:large',
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'profile',
      images: [
        {
          url: !expert.avatar_url
            ? 'https://www.tarmeer.com/images/tarmeer_logo.svg'
            : expert.avatar_url.startsWith('http')
            ? expert.avatar_url
            : `https://www.tarmeer.com${expert.avatar_url}`,
        },
      ],
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function ExpertDetailPage({ params }: Props) {
  const { slug } = await params;
  const headersList = await headers();
  const country = headersList.get('x-country') ?? 'ae';
  const isVn = country === 'vn';
  const baseUrl = getCountry(country).baseUrl;

  const expert = await fetchExpert(slug);

  if (!expert) notFound();

  // 国家数据隔离（铁律）：本国站不得渲染他国专家，跨国访问触发真 404
  if (expert.country && expert.country !== country) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: expert.full_name,
    url: `${baseUrl}/experts/${expert.slug || slug}`,
    ...(expert.bio && { description: expert.bio }),
    ...(expert.services.length > 0 && { jobTitle: expert.services[0], knowsAbout: expert.services }),
    ...(expert.city && {
      address: {
        '@type': 'PostalAddress',
        addressLocality: expert.city,
        addressCountry: isVn ? 'VN' : 'AE',
      },
    }),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${baseUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Designers', item: `${baseUrl}/experts` },
      {
        '@type': 'ListItem',
        position: 3,
        name: expert.full_name,
        item: `${baseUrl}/experts/${expert.slug || slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* SEO-visible server HTML for crawlers */}
      <div className="sr-only">
        <h1>{expert.full_name}</h1>
        {expert.bio && <p>{expert.bio}</p>}
        {expert.services.length > 0 && (
          <ul>
            {expert.services.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        )}
        {expert.city && <address>{expert.city}</address>}
      </div>

      <ExpertDetailClient expert={expert} isVn={isVn} />
    </>
  );
}
