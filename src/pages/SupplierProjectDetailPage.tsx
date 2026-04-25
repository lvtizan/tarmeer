import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, MapPin, Maximize2, Banknote, ChevronLeft, ChevronRight } from 'lucide-react';
import SmartImage from '../components/ui/SmartImage';

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

interface Supplier {
  id: number;
  company_name: string;
  slug: string;
  logo_url: string | null;
}

interface Material {
  id: number;
  title: string | null;
  category: string | null;
  image_url: string;
  description: string | null;
}

interface Project {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  year: string | null;
  area_sqm: number | null;
  budget: string | null;
  images: string[] | string | null;
  materials?: Material[];
}

interface ProjectStub {
  id: number;
  title: string;
  images: string[] | string | null;
}

function parseImages(raw: string[] | string | null): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
}

export default function SupplierProjectDetailPage() {
  const { slug, projectId } = useParams<{ slug: string; projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [allProjects, setAllProjects] = useState<ProjectStub[]>([]);
  const [loading, setLoading] = useState(true);
  const [logoError, setLogoError] = useState(false);

  const photoParam = parseInt(searchParams.get('photo') || '0', 10);
  const images = project ? parseImages(project.images) : [];
  const photoIdx = Math.max(0, Math.min(photoParam, images.length - 1));

  const goToPhoto = useCallback((idx: number) => {
    setSearchParams({ photo: String(idx) }, { replace: true });
  }, [setSearchParams]);

  const prev = useCallback(() => { if (photoIdx > 0) goToPhoto(photoIdx - 1); }, [photoIdx, goToPhoto]);
  const next = useCallback(() => { if (photoIdx < images.length - 1) goToPhoto(photoIdx + 1); }, [photoIdx, images.length, goToPhoto]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next]);

  useEffect(() => {
    if (!slug || !projectId) return;
    fetch(`${API_BASE}/suppliers/detail/${slug}/projects/${projectId}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        setSupplier(data.supplier);
        setProject({
          ...data.project,
          images: parseImages(data.project.images),
        });
        setAllProjects((data.allProjects || []).map((p: any) => ({
          ...p,
          images: parseImages(p.images),
        })));
      })
      .catch(() => setProject(null))
      .finally(() => setLoading(false));
  }, [slug, projectId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
      <div className="w-8 h-8 border-2 border-[#b8864a]/30 border-t-[#b8864a] rounded-full animate-spin" />
    </div>
  );

  if (!project || !supplier) return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
      <div className="text-center px-4">
        <h1 className="text-xl font-bold text-[#2c2c2c] mb-4">Project not found</h1>
        <button onClick={() => navigate(`/materials/suppliers/${slug}`)} className="text-[#b8864a] hover:underline text-[15px]">
          Back to Supplier
        </button>
      </div>
    </div>
  );

  const materials = Array.isArray(project.materials) ? project.materials : [];
  const initial = supplier.company_name?.[0]?.toUpperCase() || 'S';
  const currentImage = images[photoIdx];

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <Helmet>
        <title>{project.title} — {supplier.company_name} | Tarmeer</title>
        <meta name="description" content={project.description?.slice(0, 155) || `${project.title} by ${supplier.company_name} — supplier project on Tarmeer`} />
        <link rel="canonical" href={`https://www.tarmeer.com/materials/suppliers/${slug}/projects/${projectId}`} />
        <meta property="og:title" content={`${project.title} — ${supplier.company_name} | Tarmeer`} />
        <meta property="og:description" content={project.description?.slice(0, 200) || `${project.title} by ${supplier.company_name}`} />
        <meta property="og:type" content="article" />
        {currentImage && <meta property="og:image" content={currentImage} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="keywords" content={`${project.title}, ${supplier.company_name}, building materials UAE, supplier project, Tarmeer`} />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.tarmeer.com' },
            { '@type': 'ListItem', position: 2, name: 'Materials', item: 'https://www.tarmeer.com/materials' },
            { '@type': 'ListItem', position: 3, name: supplier.company_name, item: `https://www.tarmeer.com/materials/suppliers/${slug}` },
            { '@type': 'ListItem', position: 4, name: project.title, item: `https://www.tarmeer.com/materials/suppliers/${slug}/projects/${projectId}` },
          ],
        })}</script>
      </Helmet>

      {/* ── Back nav ── */}
      <div className="px-4 sm:px-6 pt-4 pb-2 max-w-[1400px] mx-auto">
        <button
          onClick={() => navigate(`/materials/suppliers/${slug}`)}
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-[#b8864a] transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to {supplier.company_name}
        </button>
      </div>

      {/* ── Main layout: image + sidebar ── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pb-6">
        <div className="flex flex-col lg:flex-row gap-0 lg:gap-6 lg:items-start">

          {/* ── Large image ── */}
          <div className="flex-1 min-w-0">
            <div className="relative bg-black rounded-none lg:rounded-2xl overflow-hidden select-none"
              style={{ aspectRatio: '4/3' }}>
              {currentImage ? (
                <SmartImage
                  src={currentImage}
                  alt={`${project.title} — photo ${photoIdx + 1}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full bg-stone-200 flex items-center justify-center text-stone-400 text-sm">No image</div>
              )}

              {/* Prev/Next arrows */}
              {photoIdx > 0 && (
                <button
                  onClick={prev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition backdrop-blur-sm"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
              )}
              {photoIdx < images.length - 1 && (
                <button
                  onClick={next}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition backdrop-blur-sm"
                  aria-label="Next photo"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}

              {/* Counter */}
              {images.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs font-medium">
                  {photoIdx + 1} / {images.length}
                </div>
              )}
            </div>

            {/* Thumbnail strip below image on mobile */}
            {images.length > 1 && (
              <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-none pb-1 lg:hidden">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => goToPhoto(i)}
                    className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition ${
                      i === photoIdx ? 'border-[#b8864a]' : 'border-transparent opacity-60 hover:opacity-90'
                    }`}
                  >
                    <SmartImage src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="w-full lg:w-72 xl:w-80 shrink-0 space-y-4 pt-4 lg:pt-0">

            {/* Supplier card */}
            <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5">
              <div className="flex items-center gap-3 mb-3">
                {supplier.logo_url && !logoError ? (
                  <SmartImage
                    src={supplier.logo_url}
                    alt={supplier.company_name}
                    className="w-10 h-10 rounded-xl object-contain border border-stone-100 bg-stone-50 p-1 shrink-0"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-[#b8864a]/10 flex items-center justify-center text-[#b8864a] font-bold text-sm shrink-0">
                    {initial}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-[#2c2c2c] truncate">{supplier.company_name}</p>
                  <Link
                    to={`/materials/suppliers/${slug}`}
                    className="text-xs text-[#b8864a] hover:underline"
                  >
                    View Profile →
                  </Link>
                </div>
              </div>

              {/* Project info */}
              <div className="border-t border-stone-100 pt-3 space-y-2">
                <h1 className="text-[15px] font-semibold text-[#2c2c2c]">{project.title}</h1>
                {project.description && (
                  <p className="text-sm text-stone-500 leading-relaxed">{project.description}</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-1">
                  {project.location && (
                    <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                      <MapPin className="w-3.5 h-3.5 text-[#b8864a] shrink-0" />{project.location}
                    </span>
                  )}
                  {project.area_sqm && (
                    <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                      <Maximize2 className="w-3.5 h-3.5 text-[#b8864a] shrink-0" />{project.area_sqm} m²
                    </span>
                  )}
                  {project.budget && (
                    <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                      <Banknote className="w-3.5 h-3.5 text-[#b8864a] shrink-0" />{project.budget}
                    </span>
                  )}
                  {project.year && (
                    <span className="text-xs text-stone-400">{project.year}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Materials */}
            {materials.length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-3">
                  Materials Used
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {materials.map(m => (
                    <div key={m.id} className="rounded-xl border border-stone-200 overflow-hidden">
                      <div className="aspect-square bg-stone-100">
                        <SmartImage src={m.image_url} alt={m.title || ''} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                      <div className="p-1.5">
                        {m.category && <p className="text-[9px] font-medium text-[#b8864a] uppercase tracking-wider truncate">{m.category}</p>}
                        <p className="text-[11px] font-medium text-[#2c2c2c] truncate">{m.title || 'Material'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Thumbnail strip on desktop */}
            {images.length > 1 && (
              <div className="hidden lg:block bg-white rounded-2xl border border-stone-200 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-3">
                  All Photos ({images.length})
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => goToPhoto(i)}
                      className={`aspect-square rounded-lg overflow-hidden border-2 transition ${
                        i === photoIdx ? 'border-[#b8864a]' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <SmartImage src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Other Projects strip ── */}
      {allProjects.filter(p => p.id !== project.id).length > 0 && (
        <div className="border-t border-stone-200 bg-white mt-4 py-6 px-4 sm:px-6">
          <div className="max-w-[1400px] mx-auto">
            <p className="text-[15px] font-semibold text-[#2c2c2c] mb-4">
              Other Projects by {supplier.company_name}
            </p>
            <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2">
              {allProjects
                .filter(p => p.id !== project.id)
                .map(p => {
                  const firstImg = parseImages(p.images)[0];
                  return (
                    <Link
                      key={p.id}
                      to={`/materials/suppliers/${slug}/projects/${p.id}`}
                      className="shrink-0 group"
                    >
                      <div className="w-48 sm:w-56 rounded-2xl overflow-hidden border border-stone-200 bg-stone-100">
                        <div className="aspect-[4/3]">
                          {firstImg ? (
                            <SmartImage src={firstImg} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" loading="lazy" />
                          ) : (
                            <div className="w-full h-full bg-stone-200" />
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-medium text-[#2c2c2c] line-clamp-1">{p.title}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
