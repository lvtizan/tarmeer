'use client';

/**
 * ProjectsShowcaseSection — shared project / portfolio card grid.
 *
 * Single rendering entry point for project card grids on BOTH the company
 * detail page and the expert detail page. Both data shapes (CompanyProjectCard
 * and ExpertProjectItem) reduce to the generic ProjectCardItem below.
 *
 * Image ratio rule (AGENTS.md 铁律): project covers MUST use aspect-video (16:9).
 */

import { ImageIcon, MapPin, Briefcase } from 'lucide-react';
import SmartImage from '../ui/SmartImage';

/** Generic project card model that both company + expert projects map to. */
export interface ProjectCardItem {
  /** Stable key (slug or numeric id). */
  key: string | number;
  title: string;
  description?: string | null;
  style?: string | null;
  location?: string | null;
  area?: string | null;
  images: string[];
}

interface ProjectsShowcaseSectionProps {
  projects: ProjectCardItem[];
  /** Section heading, e.g. "Projects" / "Featured Projects" / "Dự án tiêu biểu". */
  title: string;
  /**
   * Variant controls the surrounding chrome / heading scale:
   * - 'company': big serif heading + count on the right (company detail page)
   * - 'expert' : inline heading already supplied by the parent card; renders grid only
   */
  variant?: 'company' | 'expert';
  /** Click handler — receives the clicked project. */
  onProjectClick?: (project: ProjectCardItem) => void;
  /** Optional accessory next to the company-variant title (e.g. count override). */
  countLabel?: string;
  className?: string;
}

export default function ProjectsShowcaseSection({
  projects,
  title,
  variant = 'company',
  onProjectClick,
  countLabel,
  className = '',
}: ProjectsShowcaseSectionProps) {
  if (!projects.length) return null;

  const grid = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {projects.map((proj) => {
        const cover = proj.images && proj.images.length > 0 ? proj.images[0] : null;
        return (
          <button
            key={proj.key}
            type="button"
            onClick={() => onProjectClick?.(proj)}
            className="group text-left"
          >
            {/* Cover — aspect-video (16:9), never a fixed pixel height */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-stone-100">
              {cover ? (
                <SmartImage
                  src={cover}
                  alt={proj.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Briefcase className="w-8 h-8 text-stone-300" />
                </div>
              )}
              {proj.images && proj.images.length > 1 && (
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 text-white text-xs font-medium backdrop-blur-sm">
                  <ImageIcon className="w-3.5 h-3.5" />
                  {proj.images.length}
                </div>
              )}
            </div>
            <div className="mt-3">
              <h3 className="text-[15px] font-medium text-[#1c1917] group-hover:text-[#b8864a] transition line-clamp-1">
                {proj.title}
              </h3>
              {proj.location ? (
                <p className="flex items-center gap-1 text-sm text-stone-500 mt-1 line-clamp-1">
                  {(proj.style || proj.area) && variant === 'expert' ? (
                    <ExpertMeta proj={proj} />
                  ) : (
                    <>
                      <MapPin className="w-3.5 h-3.5" /> {proj.location}
                    </>
                  )}
                </p>
              ) : (proj.style || proj.area) ? (
                <p className="text-sm text-stone-500 mt-1 line-clamp-1 flex items-center gap-1.5">
                  <ExpertMeta proj={proj} />
                </p>
              ) : proj.description ? (
                <p className="text-sm text-stone-500 mt-1 line-clamp-1">{proj.description}</p>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );

  if (variant === 'expert') {
    // Heading supplied by parent card wrapper; render grid only.
    return <div className={className}>{grid}</div>;
  }

  return (
    <section className={`py-10 lg:py-14 ${className}`}>
      <div className="flex items-end justify-between mb-8">
        <h2 className="font-serif text-3xl sm:text-4xl text-[#1c1917]">{title}</h2>
        <span className="text-sm text-[#6b6b6b] tabular-nums">
          {countLabel ?? `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`}
        </span>
      </div>
      {grid}
    </section>
  );
}

/** Inline style · location · area meta line used by the expert variant. */
function ExpertMeta({ proj }: { proj: ProjectCardItem }) {
  return (
    <>
      {proj.style && <span>{proj.style}</span>}
      {proj.location && (
        <>
          {proj.style && <span className="text-stone-300">·</span>}
          <MapPin className="w-3 h-3 inline" />
          <span>{proj.location}</span>
        </>
      )}
      {proj.area && (
        <>
          {(proj.style || proj.location) && <span className="text-stone-300">·</span>}
          <span>{proj.area}</span>
        </>
      )}
    </>
  );
}
