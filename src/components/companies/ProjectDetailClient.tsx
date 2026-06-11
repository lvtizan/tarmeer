'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ChevronLeft, ChevronRight, X,
  Share2, Heart, MapPin, Calendar, DollarSign, BadgeCheck,
  Mail, Globe, ExternalLink, FolderOpen,
} from 'lucide-react';
import { fetchPublicProjectDetail, type PublicProjectDetailData } from '@/lib/publicApi';
import SmartImage from '@/components/ui/SmartImage';
import ServiceInquiryCard from '@/components/services/ServiceInquiryCard';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import { countryFromLang } from '@/lib/country';

const SAVED_PROJECTS_KEY = 'saved-projects';

function readSavedProjects(): Set<string> {
  try {
    if (typeof window === 'undefined') return new Set();
    const raw = localStorage.getItem(SAVED_PROJECTS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch { return new Set(); }
}

function writeSavedProjects(set: Set<string>) {
  try {
    localStorage.setItem(SAVED_PROJECTS_KEY, JSON.stringify([...set]));
  } catch { /* localStorage full */ }
}

interface Props {
  companySlug: string;
  projectSlug: string;
  initialData: PublicProjectDetailData;
}

export default function ProjectDetailClient({ companySlug, projectSlug, initialData }: Props) {
  const country = countryFromLang(useSiteLocale().lang);
  const isVn = country.code === 'vn';
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromPortfolio = searchParams.get('from') === 'portfolio';
  const initialImgParam = Number(searchParams.get('img') || '0');

  const [data, setData] = useState<PublicProjectDetailData>(initialData);
  const [currentIndex, setCurrentIndex] = useState(
    Number.isFinite(initialImgParam) && initialImgParam >= 0 ? initialImgParam : 0
  );
  const [descExpanded, setDescExpanded] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(() => readSavedProjects());
  const [shareToast, setShareToast] = useState('');

  useEffect(() => {
    if (!companySlug || !projectSlug) return;
    window.scrollTo(0, 0);
    fetchPublicProjectDetail(companySlug, projectSlug)
      .then((result) => {
        setData(result);
        const len = result.project.images.length;
        setCurrentIndex((i) => (len > 0 ? Math.min(Math.max(0, i), len - 1) : 0));
      })
      .catch(() => {});
  }, [companySlug, projectSlug]);

  useEffect(() => { setCurrentIndex(0); }, [projectSlug]);

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/portfolio');
    }
  }, [router]);

  useEffect(() => {
    if (!fromPortfolio || !data) return;
    const len = data.project.images.length;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setCurrentIndex((i) => (i > 0 ? i - 1 : len - 1));
      else if (e.key === 'ArrowRight') setCurrentIndex((i) => (i < len - 1 ? i + 1 : 0));
      else if (e.key === 'Escape') handleBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fromPortfolio, data, handleBack]);

  const { project, company } = data;
  const metaTags: string[] = [];
  if (project.style) metaTags.push(project.style);
  if (project.location) metaTags.push(project.location);
  if (project.year) metaTags.push(String(project.year));

  const companyHref = `/companies/${company.slug || company.id}`;
  const projectKey = `${company.id}-${project.id}`;
  const isSaved = saved.has(projectKey);

  const siblingNav = useMemo(() => {
    if (!data?.siblings || data.siblings.length === 0) return { prev: null, next: null };
    const valid = data.siblings.filter((s) => s.slug);
    const currentIdx = valid.findIndex((s) => s.slug === projectSlug);
    return {
      prev: currentIdx > 0 ? valid[currentIdx - 1] : null,
      next: currentIdx < valid.length - 1 ? valid[currentIdx + 1] : null,
    };
  }, [data, projectSlug]);

  const description = project.description || '';
  const shouldTruncateDesc = description.length > 380;
  const activeImage = project.images[currentIndex] || project.images[0] || '';
  const goPrev = () => setCurrentIndex((i) => (i > 0 ? i - 1 : project.images.length - 1));
  const goNext = () => setCurrentIndex((i) => (i < project.images.length - 1 ? i + 1 : 0));

  const handleShare = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: `${project.title} by ${company.name}`,
          url: window.location.href,
        });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setShareToast('Link copied');
        setTimeout(() => setShareToast(''), 2000);
      }
    } catch { /* user cancelled */ }
  };

  const handleSave = () => {
    const next = new Set(saved);
    if (next.has(projectKey)) next.delete(projectKey);
    else next.add(projectKey);
    setSaved(next);
    writeSavedProjects(next);
  };

  const openGalleryImage = (idx: number) => {
    router.push(`/companies/${companySlug}/${projectSlug}?from=portfolio&img=${idx}`);
  };

  // ── Portfolio entry layout (from=portfolio) ──────────────────────────────
  if (fromPortfolio) {
    return (
      <div className="min-h-screen bg-[#faf9f7]">
        <div className="sticky top-0 z-20 bg-white border-b border-stone-200">
          <div className="px-4 sm:px-6 h-14 flex items-center justify-between">
            <button
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-[#b8864a] transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={handleBack}
              aria-label="Close"
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100 transition"
            >
              <X className="w-5 h-5 text-stone-500" />
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-5">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1 min-w-0">
              <div className="relative rounded-xl overflow-hidden bg-stone-100 flex items-center justify-center" style={{ minHeight: '60vh' }}>
                <SmartImage
                  src={activeImage}
                  alt={`${project.title} — photo ${currentIndex + 1}`}
                  className="w-full h-auto object-contain"
                  style={{ maxHeight: 'calc(100vh - 120px)' }}
                />
                {project.images.length > 1 && (
                  <>
                    <button onClick={goPrev} aria-label="Previous photo" className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/85 hover:bg-white shadow-md flex items-center justify-center transition">
                      <ChevronLeft className="w-5 h-5 text-stone-700" />
                    </button>
                    <button onClick={goNext} aria-label="Next photo" className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/85 hover:bg-white shadow-md flex items-center justify-center transition">
                      <ChevronRight className="w-5 h-5 text-stone-700" />
                    </button>
                    <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/60 text-white text-xs font-medium backdrop-blur-sm tabular-nums">
                      {currentIndex + 1} / {project.images.length}
                    </div>
                  </>
                )}
              </div>

              {project.images.length > 1 && (
                <div className="mt-5">
                  <h3 className="text-sm font-medium text-[#2c2c2c] mb-3">Other Photos in {project.title}</h3>
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                    {project.images.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentIndex(i)}
                        aria-label={`Show photo ${i + 1}`}
                        className={`flex-shrink-0 w-28 h-20 rounded-lg overflow-hidden border-2 transition ${i === currentIndex ? 'border-[#b8864a]' : 'border-transparent hover:border-stone-300'}`}
                      >
                        <SmartImage src={url} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8">
                <h1 className="font-serif text-2xl font-semibold text-[#1c1917]">{project.title}</h1>
                {metaTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {metaTags.map((tag) => (
                      <span key={tag} className="border border-stone-200 text-stone-600 rounded-2xl px-3 py-1 text-sm">{tag}</span>
                    ))}
                  </div>
                )}
                {project.description && (
                  <p className="text-[15px] text-[#2c2c2c] leading-relaxed mt-4">{project.description}</p>
                )}
                {project.tags && project.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {project.tags.map((tag) => (
                      <span key={tag} className="border border-stone-200 text-stone-600 rounded-2xl px-3 py-1 text-sm">{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              {(siblingNav.prev || siblingNav.next) && (
                <div className="mt-10 pt-6 border-t border-stone-200 flex items-center justify-between">
                  {siblingNav.prev ? (
                    <button onClick={() => router.push(`/companies/${companySlug}/${siblingNav.prev!.slug}?from=portfolio`)} className="flex items-center gap-2 text-sm text-stone-600 hover:text-[#b8864a] transition group">
                      <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                      <div className="text-left">
                        <p className="text-xs text-stone-400">Prev Project</p>
                        <p className="font-medium">{siblingNav.prev.title}</p>
                      </div>
                    </button>
                  ) : <div />}
                  {siblingNav.next ? (
                    <button onClick={() => router.push(`/companies/${companySlug}/${siblingNav.next!.slug}?from=portfolio`)} className="flex items-center gap-2 text-sm text-stone-600 hover:text-[#b8864a] transition group text-right">
                      <div>
                        <p className="text-xs text-stone-400">Next Project</p>
                        <p className="font-medium">{siblingNav.next.title}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  ) : <div />}
                </div>
              )}
            </div>

            <div className="w-full lg:w-[360px] lg:flex-shrink-0">
              <div className="lg:sticky lg:top-[72px] space-y-4">
                <ServiceInquiryCard
                  title={`Get in touch with ${company.name}`}
                  companyName={company.name}
                  companySlug={company.slug || String(company.id)}
                />

                <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    {company.logo ? (
                      <SmartImage src={company.logo} alt={`${company.name} logo`} className="w-12 h-12 rounded-lg object-contain bg-white border border-stone-100 p-1 flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                        <span className="font-serif text-lg text-stone-400">{company.name.charAt(0)}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <Link href={companyHref} className="font-serif text-[16px] text-[#1c1917] hover:text-[#b8864a] transition truncate block">
                        {company.name}
                      </Link>
                      {company.city && <p className="text-xs text-stone-500 mt-0.5">{company.city}{isVn ? '' : ', UAE'}</p>}
                    </div>
                  </div>
                  <Link href={companyHref} className="mt-4 inline-flex w-full items-center justify-center px-4 py-2 border border-stone-200 rounded-2xl text-sm font-medium text-[#2c2c2c] hover:border-[#b8864a] hover:text-[#b8864a] transition">
                    View Profile
                  </Link>
                  <Link href={`/companies/${companySlug}/${projectSlug}`} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 px-4 py-2 border border-stone-200 rounded-2xl text-sm font-medium text-[#2c2c2c] hover:border-[#b8864a] hover:text-[#b8864a] transition">
                    <FolderOpen className="w-4 h-4" />
                    View Project
                  </Link>
                </div>

                {(company.email || company.website || company.instagram || company.address) && (
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                    <h3 className="text-sm font-semibold text-[#1c1917] mb-3">Contact Info</h3>
                    <div className="space-y-2.5 text-sm">
                      {company.email && (
                        <a href={`mailto:${company.email}`} className="flex items-center gap-2.5 text-stone-600 hover:text-[#b8864a] transition truncate">
                          <Mail className="w-4 h-4 text-stone-400 flex-shrink-0" /> <span className="truncate">{company.email}</span>
                        </a>
                      )}
                      {company.website && (
                        <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-stone-600 hover:text-[#b8864a] transition">
                          <Globe className="w-4 h-4 text-stone-400 flex-shrink-0" /> Website <ExternalLink className="w-3 h-3 text-stone-300" />
                        </a>
                      )}
                      {company.instagram && (
                        <a href={company.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 text-stone-600 hover:text-[#b8864a] transition">
                          <ExternalLink className="w-4 h-4 text-stone-400 flex-shrink-0" /> Instagram
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Default layout ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-5 pb-3">
        <button onClick={handleBack} className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-[#b8864a] transition">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pb-28 sm:pb-10">
        <div className="flex flex-col lg:flex-row gap-8">

          <div className="flex-1 min-w-0">
            {/* Company header */}
            <div className="pb-5 border-b border-stone-200">
              <div className="flex items-center gap-3">
                {company.logo ? (
                  <SmartImage src={company.logo} alt={`${company.name} logo`} className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-contain bg-white border border-stone-100 p-1.5 flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0">
                    <span className="font-serif text-lg text-stone-400">{company.name.charAt(0)}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <Link href={companyHref} className="font-serif text-lg sm:text-2xl font-semibold text-[#1c1917] hover:text-[#b8864a] transition inline-flex items-center gap-1.5 leading-snug">
                    <span className="break-words">{company.name}</span>
                    <BadgeCheck className="w-4 h-4 sm:w-5 sm:h-5 text-[#b8864a]/70 flex-shrink-0" />
                  </Link>
                  {company.city && (
                    <p className="text-sm text-stone-500 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" /> {company.city}{isVn ? '' : ', UAE'}
                    </p>
                  )}
                </div>
                <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                  <button onClick={handleShare} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl border border-stone-200 text-sm text-[#2c2c2c] hover:border-[#b8864a] hover:text-[#b8864a] transition">
                    <Share2 className="w-4 h-4" /> Share
                  </button>
                  <button onClick={handleSave} aria-pressed={isSaved} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl border text-sm transition ${isSaved ? 'border-[#b8864a] bg-[#b8864a]/10 text-[#b8864a]' : 'border-stone-200 text-[#2c2c2c] hover:border-[#b8864a] hover:text-[#b8864a]'}`}>
                    <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} /> {isSaved ? 'Saved' : 'Save'}
                  </button>
                </div>
              </div>
              <div className="flex sm:hidden items-center gap-2 mt-3">
                <button onClick={handleShare} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl border border-stone-200 text-sm text-[#2c2c2c] hover:border-[#b8864a] hover:text-[#b8864a] transition">
                  <Share2 className="w-4 h-4" /> Share
                </button>
                <button onClick={handleSave} aria-pressed={isSaved} className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-2xl border text-sm transition ${isSaved ? 'border-[#b8864a] bg-[#b8864a]/10 text-[#b8864a]' : 'border-stone-200 text-[#2c2c2c] hover:border-[#b8864a] hover:text-[#b8864a]'}`}>
                  <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} /> {isSaved ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#1c1917] mt-8">{project.title}</h1>

            {project.style && (
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="border border-stone-200 text-stone-600 rounded-2xl px-3 py-1 text-sm">{project.style}</span>
              </div>
            )}

            {description && (
              <div className="mt-5 text-[15px] text-[#2c2c2c] leading-relaxed">
                <p className="whitespace-pre-line">
                  {descExpanded || !shouldTruncateDesc ? description : `${description.slice(0, 380)}…`}
                </p>
                {shouldTruncateDesc && (
                  <button onClick={() => setDescExpanded(!descExpanded)} className="mt-2 text-[#1c1917] font-medium hover:text-[#b8864a] transition inline-flex items-center gap-1">
                    {descExpanded ? 'Read Less' : 'Read More'} <span className="text-xs">{descExpanded ? '↑' : '↓'}</span>
                  </button>
                )}
              </div>
            )}

            <dl className="mt-6 space-y-2 text-[15px]">
              {project.year && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#c6a065] flex-shrink-0" />
                  <dt className="text-stone-500">Project Year:</dt>
                  <dd className="text-[#2c2c2c]">{project.year}</dd>
                </div>
              )}
              {(project.location || company.city) && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#c6a065] flex-shrink-0" />
                  <dt className="text-stone-500">Location:</dt>
                  <dd className="text-[#2c2c2c]">{project.location || company.city}{isVn ? '' : ', UAE'}</dd>
                </div>
              )}
              {project.cost && (
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#c6a065] flex-shrink-0" />
                  <dt className="text-stone-500">Project Cost:</dt>
                  <dd className="text-[#2c2c2c]">{project.cost}</dd>
                </div>
              )}
            </dl>

            {project.tags && project.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-6">
                {project.tags.map((tag) => (
                  <span key={tag} className="border border-stone-200 text-stone-600 rounded-2xl px-3 py-1 text-sm">{tag}</span>
                ))}
              </div>
            )}

            {project.images.length > 0 && (
              <div className="mt-10">
                <h2 className="font-serif text-xl font-semibold text-[#1c1917] mb-4">
                  Project Gallery
                  <span className="ml-2 text-sm font-normal text-stone-500">({project.images.length} {project.images.length === 1 ? 'photo' : 'photos'})</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {project.images.map((url, i) => (
                    <button key={i} onClick={() => openGalleryImage(i)} className="group relative rounded-xl overflow-hidden bg-stone-100 aspect-[4/3] text-left">
                      <SmartImage src={url} alt={`${project.title} ${i + 1}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(siblingNav.prev || siblingNav.next) && (
              <div className="mt-12 pt-6 border-t border-stone-200 flex items-center justify-between">
                {siblingNav.prev ? (
                  <button onClick={() => router.push(`/companies/${companySlug}/${siblingNav.prev!.slug}`)} className="flex items-center gap-2 text-sm text-stone-600 hover:text-[#b8864a] transition group">
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                    <div className="text-left">
                      <p className="text-xs text-stone-400">Prev Project</p>
                      <p className="font-medium">{siblingNav.prev.title}</p>
                    </div>
                  </button>
                ) : <div />}
                {siblingNav.next ? (
                  <button onClick={() => router.push(`/companies/${companySlug}/${siblingNav.next!.slug}`)} className="flex items-center gap-2 text-sm text-stone-600 hover:text-[#b8864a] transition group text-right">
                    <div>
                      <p className="text-xs text-stone-400">Next Project</p>
                      <p className="font-medium">{siblingNav.next.title}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                ) : <div />}
              </div>
            )}
          </div>

          <div id="inquiry-form" className="w-full lg:w-[340px] lg:flex-shrink-0">
            <div className="lg:sticky lg:top-6">
              <ServiceInquiryCard
                title={`Get in touch with ${company.name}`}
                companyName={company.name}
                companySlug={company.slug || String(company.id)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-white/95 backdrop-blur-sm border-t border-stone-200 px-4 py-3">
        <a
          href="#inquiry-form"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById('inquiry-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          className="btn-primary w-full text-center py-3 block"
        >
          Get in touch
        </a>
      </div>

      {shareToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#1c1917] text-white text-sm shadow-lg">
          {shareToast}
        </div>
      )}
    </div>
  );
}
