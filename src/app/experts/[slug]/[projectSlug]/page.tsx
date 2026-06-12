export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import ExpertProjectDetailClient from '@/components/experts/ExpertProjectDetailClient';
import type { ExpertDetail, ExpertProjectItem } from '@/components/experts/types';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.trim() ??
  process.env.API_INTERNAL_URL?.trim() ??
  '/api';

async function fetchExpertWithProject(
  slug: string,
  projectSlug: string
): Promise<{ expert: ExpertDetail; project: ExpertProjectItem } | null> {
  try {
    const res = await fetch(`${API_BASE}/experts/${encodeURIComponent(slug)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { expert?: ExpertDetail };
    if (!data.expert) return null;
    const e = data.expert;
    const projects: ExpertProjectItem[] = Array.isArray(e.projects)
      ? e.projects.map(p => ({ ...p, images: Array.isArray(p.images) ? p.images : [], tags: Array.isArray(p.tags) ? p.tags : [] }))
      : [];
    const project = projects.find(p => p.slug === projectSlug) ?? null;
    if (!project) return null;
    return {
      expert: { ...e, services: Array.isArray(e.services) ? e.services : [], skills: Array.isArray(e.skills) ? e.skills : [], work_history: Array.isArray(e.work_history) ? e.work_history : [], certificates: Array.isArray(e.certificates) ? e.certificates : [], projects },
      project,
    };
  } catch {
    return null;
  }
}

interface Props {
  params: Promise<{ slug: string; projectSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, projectSlug } = await params;
  const headersList = await headers();
  const isVn = (headersList.get('x-country') ?? 'ae') === 'vn';
  const data = await fetchExpertWithProject(slug, projectSlug);
  if (!data) return { title: 'Project - Tarmeer' };
  const { expert, project } = data;
  const title = `${project.title} — ${expert.full_name} | Tarmeer`;
  const desc = project.description?.slice(0, 200) ?? `Interior design project by ${expert.full_name}`;
  const ogImage = project.images[0]
    ? (project.images[0].startsWith('http') ? project.images[0] : `https://www.tarmeer.com${project.images[0]}`)
    : 'https://www.tarmeer.com/images/tarmeer_logo.svg';
  return {
    title,
    description: desc,
    openGraph: { title, description: desc, images: [{ url: ogImage }] },
    alternates: { canonical: `https://www.tarmeer.com/experts/${slug}/${projectSlug}` },
  };
}

export default async function ExpertProjectDetailPage({ params }: Props) {
  const { slug, projectSlug } = await params;
  const headersList = await headers();
  const isVn = (headersList.get('x-country') ?? 'ae') === 'vn';

  const data = await fetchExpertWithProject(slug, projectSlug);
  if (!data) notFound();

  return <ExpertProjectDetailClient expert={data.expert} project={data.project} isVn={isVn} />;
}
