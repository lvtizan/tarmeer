import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Share2 } from 'lucide-react';
import { getDesignerBySlug, getDesignerProjects, type DesignerProject } from '../data/designers';
import { WHATSAPP_LINK } from '../lib/constants';

function shareProfile(name: string, url: string) {
  const text = `Meet ${name}, Tarmeer designer. View portfolio: ${url}`;
  if (navigator.share) {
    navigator.share({ title: `${name} | Tarmeer`, url, text }).catch(() => copyAndAlert(url));
  } else {
    copyAndAlert(url);
  }
}

function copyAndAlert(url: string) {
  navigator.clipboard.writeText(url).then(() => {
    alert('Link copied to clipboard. Share to social or WhatsApp.');
  });
}

function projectSummary(project: DesignerProject): string {
  return project.description.length > 80 ? `${project.description.slice(0, 80)}…` : project.description;
}

export default function DesignerProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const designer = slug ? getDesignerBySlug(slug) : null;
  const allProjects = slug ? getDesignerProjects(slug) : [];
  const [selectedTag, setSelectedTag] = useMemo<[string | null, (tag: string | null) => void]>(() => {
    let currentTag: string | null = null;
    const setSelectedTag = (tag: string | null) => { currentTag = tag; };
    return [currentTag, setSelectedTag];
  }, []);

  const uniqueTags = useMemo(() => {
    const set = new Set<string>();
    allProjects.forEach((p) => (p.tags ?? []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [allProjects]);

  const projects = useMemo(() => {
    if (!selectedTag) return allProjects;
    return allProjects.filter((p) => (p.tags ?? []).includes(selectedTag));
  }, [allProjects, selectedTag]);

  if (!designer) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-[#6b6b6b]">Designer not found.</p>
          <Link to="/designers" className="text-[#b8864a] hover:underline mt-4 inline-block">
            ← All designers
          </Link>
        </div>
      </div>
    );
  }

  const profileUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,380px)_1fr] lg:min-h-screen">
        {/* Left: designer info */}
        <aside className="lg:border-r lg:border-stone-200 lg:bg-white lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto">
          <div className="p-6 sm:p-8">
            <Link
              to="/designers"
              className="text-[#b8864a] hover:underline text-sm mb-6 inline-block"
            >
              ← All designers
            </Link>
            {designer.avatar && (
              <div className="w-[100px] sm:w-[120px] h-[100px] sm:h-[120px] rounded-full overflow-hidden flex-shrink-0 border-2 border-[#b8864a] mb-6">
                <img
                  src={designer.avatar}
                  alt={`${designer.name} profile`}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#b8864a] mb-2 break-words overflow-visible whitespace-normal">
              {designer.name}
            </h1>
            <p className="text-[#6b6b6b] mb-4 flex items-center gap-1.5">
              <span aria-hidden>📍</span> {designer.location}
            </p>
            <div className="flex flex-wrap gap-2 mb-6">
              <span className="text-xs px-3 py-1.5 bg-[#b8864a]/15 text-[#b8864a] uppercase tracking-wide">
                In-Person
              </span>
              <span className="text-xs px-3 py-1.5 bg-[#b8864a]/15 text-[#b8864a] uppercase tracking-wide">
                {designer.style}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 items-center mb-8">
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary text-white text-sm uppercase tracking-wider"
              >
                Work with {designer.firstName}
              </a>
              <button
                type="button"
                onClick={() => shareProfile(designer.name, profileUrl)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded border-2 border-[#b8864a] text-[#b8864a] font-semibold text-sm uppercase tracking-wider hover:bg-[#b8864a]/10 transition"
              >
                <Share2 className="w-4 h-4" aria-hidden />
                Share
              </button>
            </div>

            <section className="border-t border-stone-200 pt-6">
              <h2 className="font-serif text-lg font-semibold text-[#b8864a] uppercase tracking-wider mb-3">
                About
              </h2>
              <p className="text-[#2c2c2c] leading-relaxed mb-3">{designer.bioShort}</p>
              {designer.bioLong && designer.bioLong !== designer.bioShort && (
                <p className="text-[#6b6b6b] text-sm leading-relaxed mb-4">{designer.bioLong}</p>
              )}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#b8864a]/10 border border-[#b8864a]/30 rounded">
                <span className="font-serif text-xl font-bold text-[#b8864a]">{designer.projectCount}</span>
                <span className="text-sm text-[#6b6b6b] uppercase tracking-wide">Projects</span>
              </div>
            </section>

            <section className="border-t border-stone-200 pt-6 mt-6">
              <h2 className="font-serif text-lg font-semibold text-[#b8864a] uppercase tracking-wider mb-3">
                Expertise
              </h2>
              <div className="flex flex-wrap gap-2">
                {designer.expertise.map((tag) => (
                  <span
                    key={tag}
                    className="text-sm px-3 py-1.5 bg-white border border-[#b8864a]/30 text-[#2c2c2c] rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          </div>
        </aside>

        {/* Right: portfolio */}
        <main className="p-6 sm:p-8 lg:p-10">
          <h2 className="font-serif text-xl sm:text-2xl font-semibold text-[#2c2c2c] mb-4">
            Portfolio
          </h2>
          {uniqueTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                type="button"
                onClick={() => setSelectedTag(null)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  selectedTag === null
                    ? 'bg-[#b8864a] text-white'
                    : 'bg-stone-100 text-[#2c2c2c] hover:bg-stone-200'
                }`}
              >
                All
              </button>
              {uniqueTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTag(tag)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    selectedTag === tag
                      ? 'bg-[#b8864a] text-white'
                      : 'bg-stone-100 text-[#2c2c2c] hover:bg-stone-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {projects.map((project) => (
              <Link
                key={project.id}
                to={`/designers/${slug}/projects/${project.id}`}
                className="group block aspect-[4/3] overflow-hidden rounded-lg bg-stone-200 transition-transform duration-200 hover:-translate-y-1 relative"
              >
                <img
                  src={project.coverImage}
                  alt={`${project.title} by ${designer.name}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-4">
                  <p className="font-semibold text-white text-sm sm:text-base line-clamp-1">
                    {project.title}
                  </p>
                  <p className="text-white/90 text-xs sm:text-sm line-clamp-2 mt-0.5">
                    {projectSummary(project)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          {projects.length === 0 && (
            <p className="text-[#6b6b6b] py-8">No projects in this category.</p>
          )}
          <div className="mt-12 pt-8 border-t border-stone-200 text-center">
            <a
              href={WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-white px-8 py-4 text-sm uppercase tracking-wider"
            >
              Work with {designer.firstName}
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}
