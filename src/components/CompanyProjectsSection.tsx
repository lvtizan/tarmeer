'use client';

/**
 * CompanyProjectsSection — company detail page project card grid.
 *
 * Single rendering entry point for all detail-page contexts
 * (public access / admin preview / company-dashboard preview).
 * Every detail data source that has isClaimed=true + projects[] uses this component.
 *
 * Thin adapter over the shared ProjectsShowcaseSection — keeps the exact same
 * company-page look while sharing one grid implementation with the expert page.
 */

import { useRouter } from 'next/navigation';
import ProjectsShowcaseSection, { type ProjectCardItem } from './shared/ProjectsShowcaseSection';
import type { Company, CompanyProjectCard } from '../lib/companyData';

interface Props {
  company: Pick<Company, 'id' | 'name'>;
  projects: CompanyProjectCard[];
}

export default function CompanyProjectsSection({ company, projects }: Props) {
  const router = useRouter();
  if (!projects.length) return null;

  const items: ProjectCardItem[] = projects.map((proj) => ({
    key: proj.slug,
    title: proj.title,
    description: proj.description,
    location: proj.location,
    style: proj.style,
    images: proj.images,
  }));

  return (
    <ProjectsShowcaseSection
      title="Projects"
      variant="company"
      projects={items}
      onProjectClick={(proj) => router.push(`/companies/${company.id}/${proj.key}`)}
    />
  );
}
