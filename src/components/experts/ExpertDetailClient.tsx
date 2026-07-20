'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, MapPin, Briefcase, Calendar, FolderOpen,
  ShieldCheck, X, ChevronLeft, ChevronRight, BadgeCheck,
} from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import SmartImage from '@/components/ui/SmartImage';
import { resolveImageUrl } from '@/lib/imageUrl';
import { ExpertBadges } from './ExpertBadges';
import ProjectsShowcaseSection from '@/components/shared/ProjectsShowcaseSection';
import UnifiedInquiryForm from '@/components/shared/UnifiedInquiryForm';
import PhoneRevealButton from '@/components/shared/PhoneRevealButton';
import type { ExpertDetail } from './types';

interface ExpertDetailClientProps {
  expert: ExpertDetail;
  isVn: boolean;
}

/** Full-screen lightbox for certificate images. */
function CertificateLightbox({ images, index, onClose, onNavigate }: {
  images: string[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1);
      if (e.key === 'ArrowRight' && index < images.length - 1) onNavigate(index + 1);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [index, images.length, onClose, onNavigate]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>
      {index > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNavigate(index - 1); }}
          className="absolute left-3 sm:left-6 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          aria-label="Previous"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolveImageUrl(images[index])}
        alt={`Certificate ${index + 1}`}
        className="max-w-full max-h-[88vh] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
      {index < images.length - 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNavigate(index + 1); }}
          className="absolute right-3 sm:right-6 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          aria-label="Next"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

export default function ExpertDetailClient({ expert, isVn }: ExpertDetailClientProps) {
  const router = useRouter();

  const [heroIndex, setHeroIndex] = useState(0);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const projects = useMemo(() => expert.projects || [], [expert.projects]);

  // Hero carousel images: aggregate every project's images.
  const heroImages = useMemo(() => {
    const imgs: string[] = [];
    for (const proj of projects) {
      if (Array.isArray(proj.images)) {
        for (const img of proj.images) {
          if (img) imgs.push(img);
        }
      }
    }
    return imgs.slice(0, 10);
  }, [projects]);

  const heroPrev = () => setHeroIndex((i) => (i > 0 ? i - 1 : heroImages.length - 1));
  const heroNext = () => setHeroIndex((i) => (i < heroImages.length - 1 ? i + 1 : 0));

  const yearsExp = Number(expert.experience_years) || 0;
  const bio = expert.bio || '';
  const shouldTruncate = bio.length > 300;

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/experts');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Back nav */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-2">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-[#b8864a] transition"
        >
          <ArrowLeft className="w-4 h-4" /> {isVn ? 'Quay lại' : 'Back'}
        </button>
      </div>

      {/* ===== Top Section: Hero + Sidebar ===== */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex gap-6">

          {/* Left: main column */}
          <div className="flex-1 min-w-0">

            {/* Image Carousel */}
            <div className="relative rounded-lg overflow-hidden bg-stone-100 aspect-[16/10]">
              {heroImages.length > 0 ? (
                <>
                  <SmartImage
                    src={heroImages[heroIndex]}
                    alt={`${expert.full_name} project ${heroIndex + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {heroImages.length > 1 && (
                    <>
                      <button
                        onClick={heroPrev}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white shadow flex items-center justify-center transition"
                      >
                        <ChevronLeft className="w-5 h-5 text-stone-700" />
                      </button>
                      <button
                        onClick={heroNext}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white shadow flex items-center justify-center transition"
                      >
                        <ChevronRight className="w-5 h-5 text-stone-700" />
                      </button>
                      {/* Dots */}
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {heroImages.slice(0, 8).map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setHeroIndex(i)}
                            className={`w-2 h-2 rounded-full transition ${
                              i === heroIndex ? 'bg-white' : 'bg-white/50'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : expert.avatar_url ? (
                <SmartImage
                  src={expert.avatar_url}
                  alt={expert.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-200 to-stone-300">
                  <span className="font-serif text-6xl text-stone-400">
                    {expert.full_name.charAt(0)}
                  </span>
                </div>
              )}
            </div>

            {/* Header — Below carousel（头像只在右侧 Contact 卡，左栏不重复）*/}
            <div className="flex items-start gap-4 mt-5">
              <div className="flex-1 min-w-0">
                <h1 className="font-serif text-2xl font-semibold text-[#1c1917] flex items-center gap-2 flex-wrap">
                  {expert.full_name}
                  <ExpertBadges isSigned={expert.is_signed} isCertified={expert.is_certified} isVn={isVn} />
                </h1>
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1 text-sm">
                  {expert.services[0] && (
                    <>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#f5f0e8] text-[#8b6914] font-medium">
                        {expert.services[0]}
                      </span>
                      <span className="text-stone-300">&middot;</span>
                    </>
                  )}
                  {projects.length > 0 && (
                    <>
                      <span className="text-[#b8864a] font-medium">{projects.length}+ {isVn ? 'dự án' : 'projects'}</span>
                      {expert.city && <span className="text-stone-300">&middot;</span>}
                    </>
                  )}
                  {expert.city && <span className="text-stone-500">{expert.city}</span>}
                  {yearsExp > 0 && (
                    <>
                      <span className="text-stone-300">&middot;</span>
                      <span className="text-stone-500">
                        {isVn ? `${yearsExp} năm kinh nghiệm` : `${yearsExp} yrs experience`}
                      </span>
                    </>
                  )}
                </div>
                {/* Stats row */}
                <div className="flex items-center gap-4 mt-2 text-xs text-stone-500">
                  {projects.length > 0 && (
                    <span className="flex items-center gap-1">
                      <FolderOpen className="w-3.5 h-3.5 text-[#c6a065]" />{projects.length}+ {isVn ? 'Dự án' : 'Projects'}
                    </span>
                  )}
                  {yearsExp > 0 && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#c6a065]" />{yearsExp} {isVn ? 'Năm' : 'Years'}
                    </span>
                  )}
                  {expert.services.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-[#c6a065]" />{expert.services.length} {isVn ? 'Dịch vụ' : 'Services'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pb-1 border-b border-stone-200" />

            {/* About Section */}
            {bio && (
              <section className="py-6 border-b border-stone-100">
                <h2 className="text-lg font-semibold text-[#1c1917] mb-3">{isVn ? 'Giới thiệu' : 'About'}</h2>
                <div className="text-sm text-stone-600 leading-relaxed">
                  <p className="whitespace-pre-line">
                    {aboutExpanded || !shouldTruncate ? bio : bio.slice(0, 300) + '...'}
                  </p>
                  {shouldTruncate && (
                    <button
                      onClick={() => setAboutExpanded(!aboutExpanded)}
                      className="text-[#1c1917] font-medium mt-1 hover:underline"
                    >
                      {aboutExpanded ? (isVn ? 'Thu gọn' : 'Show Less') : (isVn ? 'Xem thêm' : 'Read More')} &darr;
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* Services Section */}
            {expert.services.length > 0 && (
              <section className="py-6 border-b border-stone-100">
                <h2 className="text-lg font-semibold text-[#1c1917] mb-3">{isVn ? 'Dịch vụ' : 'Services'}</h2>
                <div className="flex flex-wrap gap-2">
                  {expert.services.map((svc) => (
                    <span
                      key={svc}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-700"
                    >
                      <Briefcase className="w-3.5 h-3.5 text-[#c6a065]" /> {svc}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Work Experience Section */}
            {expert.work_history.length > 0 && (
              <section className="py-6 border-b border-stone-100">
                <h2 className="text-lg font-semibold text-[#1c1917] mb-4">{isVn ? 'Kinh nghiệm làm việc' : 'Work Experience'}</h2>
                <ol className="relative border-l border-stone-200 ml-1.5 space-y-6">
                  {expert.work_history.map((item, i) => (
                    <li key={`${item.org}-${i}`} className="pl-5 relative">
                      <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#b8864a] ring-4 ring-[#b8864a]/15" />
                      <p className="text-xs text-stone-400 mb-0.5">
                        {[item.from, item.to].filter(Boolean).join(' – ')}
                      </p>
                      <p className="text-[15px] font-semibold text-[#1c1917]">{item.org}</p>
                      {item.role && <p className="text-sm text-stone-500">{item.role}</p>}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Skills Section */}
            {expert.skills.length > 0 && (
              <section className="py-6 border-b border-stone-100">
                <h2 className="text-lg font-semibold text-[#1c1917] mb-3">{isVn ? 'Kỹ năng' : 'Skills'}</h2>
                <div className="flex flex-wrap gap-2">
                  {expert.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-3 py-1 bg-stone-50 border border-stone-200 rounded-full text-xs text-stone-600"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Certificates Section */}
            {(expert.certificates.length > 0 || Boolean(expert.license_verified)) && (
              <section className="py-6 border-b border-stone-100">
                <h2 className="text-lg font-semibold text-[#1c1917] mb-3">{isVn ? 'Chứng chỉ' : 'Certificates'}</h2>
                {Boolean(expert.license_verified) && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium mb-4">
                    <ShieldCheck className="w-4 h-4" />
                    {isVn ? 'Giấy phép kinh doanh đã được xác minh ✓' : 'Business license verified ✓'}
                  </div>
                )}
                {expert.certificates.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {expert.certificates.map((cert, i) => (
                      <button
                        key={`${cert}-${i}`}
                        type="button"
                        onClick={() => setLightboxIndex(i)}
                        className="group aspect-[4/3] rounded-xl overflow-hidden border border-stone-200 bg-stone-50 hover:border-[#b8864a]/50 transition"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resolveImageUrl(cert)}
                          alt={`${expert.full_name} certificate ${i + 1}`}
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-300"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Portfolio / Projects Section */}
            {projects.length > 0 && (
              <ProjectsShowcaseSection
                variant="company"
                title={isVn ? 'Dự án tiêu biểu' : 'Portfolio'}
                projects={projects.map((proj) => ({
                  key: proj.id,
                  title: proj.title,
                  description: proj.description,
                  style: proj.style,
                  location: proj.location,
                  area: proj.area,
                  images: Array.isArray(proj.images) ? proj.images : [],
                }))}
                onProjectClick={(p) => {
                  const proj = projects.find((x) => x.id === p.key);
                  if (proj?.slug) router.push(`/experts/${expert.slug}/${proj.slug}`);
                }}
              />
            )}

            {/* Mobile: Contact + inquiry form (below content on small screens) */}
            <div className="lg:hidden py-6 border-t border-stone-100 space-y-4">
              <ExpertContactCard expert={expert} isVn={isVn} />
            </div>
          </div>

          {/* Right: Sticky Sidebar (desktop only) */}
          <div className="hidden lg:block w-[320px] flex-shrink-0">
            <div className="sticky top-20 space-y-4">
              <ExpertContactCard expert={expert} isVn={isVn} />
            </div>
          </div>
        </div>
      </div>

      {/* Certificate lightbox */}
      {lightboxIndex !== null && expert.certificates.length > 0 && (
        <CertificateLightbox
          images={expert.certificates}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}

      {/* Footer */}
      <div className="border-t border-stone-200 py-6 text-center mt-8">
        <button
          onClick={handleBack}
          className="text-sm text-stone-500 hover:text-[#b8864a] transition"
        >
          <ArrowLeft className="w-4 h-4 inline mr-1" /> {isVn ? 'Quay lại' : 'Back'}
        </button>
      </div>
    </div>
  );
}

/**
 * Contact card — the one differentiator from the company sidebar:
 * avatar + full_name header on top, then phone (VN only) + inquiry form.
 */
function ExpertContactCard({ expert, isVn }: { expert: ExpertDetail; isVn: boolean }) {
  const yearsExp = Number(expert.experience_years) || 0;
  const subParts: string[] = [];
  if (yearsExp > 0) subParts.push(isVn ? `${yearsExp} năm KN` : `${yearsExp} yrs exp`);
  if (expert.city) subParts.push(expert.city);

  return (
    <div className="border border-stone-200 rounded-xl p-5">
      {/* Expert identity header — avatar + name */}
      <div className="flex items-center gap-3 pb-4 mb-4 border-b border-stone-100">
        <Avatar name={expert.full_name} avatarUrl={expert.avatar_url || ''} size="lg" className="flex-shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold text-[15px] text-[#1c1917] truncate flex items-center gap-1.5">
            {expert.full_name}
            {Boolean(expert.is_certified) && <BadgeCheck className="w-4 h-4 text-[#b8864a]/70 shrink-0" />}
          </p>
          {subParts.length > 0 && (
            <p className="text-xs text-stone-500 mt-0.5 truncate">{subParts.join(' · ')}</p>
          )}
        </div>
      </div>

      {/* Phone reveal — VN only */}
      {isVn && Boolean(expert.has_phone) && (
        <div className="mb-4">
          <PhoneRevealButton targetType="expert" targetId={expert.id} isVn={isVn} variant="button" />
        </div>
      )}

      {/* Inquiry form — all countries */}
      <h3 className="font-serif text-base text-[#1c1917] mb-1">
        {isVn ? 'Gửi tin nhắn cho nhà thiết kế' : 'Message this designer'}
      </h3>
      <p className="text-xs text-stone-500 mb-4">
        {isVn
          ? 'Mô tả nhu cầu của bạn, nhà thiết kế sẽ phản hồi trực tiếp.'
          : 'Describe your project and the designer will get back to you directly.'}
      </p>
      <UnifiedInquiryForm variant="expert" expertId={expert.id} isVn={isVn} />
    </div>
  );
}
