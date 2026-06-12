'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MapPin, Briefcase, ShieldCheck, X,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { resolveImageUrl } from '@/lib/imageUrl';
import { ExpertBadges } from './ExpertBadges';
import { ExpertInquiryForm, RevealExpertPhone } from './ExpertContactSidebar';
import ProjectsShowcaseSection from '@/components/shared/ProjectsShowcaseSection';
import type { ExpertDetail, ExpertProjectItem } from './types';

interface ExpertDetailClientProps {
  expert: ExpertDetail;
  isVn: boolean;
}


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

function ProjectDetailSheet({ project, onClose }: { project: ExpertProjectItem; onClose: () => void }) {
  const [imgIdx, setImgIdx] = useState(0);
  const images = Array.isArray(project.images) ? project.images : [];

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && imgIdx > 0) setImgIdx(i => i - 1);
      if (e.key === 'ArrowRight' && imgIdx < images.length - 1) setImgIdx(i => i + 1);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [imgIdx, images.length, onClose]);

  const meta: { icon: React.ReactNode; label: string }[] = [
    ...(project.style ? [{ icon: null, label: project.style }] : []),
    ...(project.location ? [{ icon: <MapPin className="w-3.5 h-3.5" />, label: project.location }] : []),
    ...(project.area ? [{ icon: null, label: project.area }] : []),
    ...(project.year ? [{ icon: null, label: String(project.year) }] : []),
    ...(project.cost ? [{ icon: null, label: project.cost }] : []),
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-3xl rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-stone-100 shrink-0">
          <h3 className="font-semibold text-[#1c1917] text-base line-clamp-1 pr-4">{project.title}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-stone-100 transition shrink-0">
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          {/* Main image */}
          {images.length > 0 && (
            <div className="relative bg-stone-100">
              <div className="relative h-64 sm:h-96">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveImageUrl(images[imgIdx])}
                  alt={project.title}
                  className="w-full h-full object-cover"
                />
                {images.length > 1 && (
                  <>
                    {imgIdx > 0 && (
                      <button
                        type="button"
                        onClick={() => setImgIdx(i => i - 1)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow transition"
                      >
                        <ChevronLeft className="w-5 h-5 text-[#1c1917]" />
                      </button>
                    )}
                    {imgIdx < images.length - 1 && (
                      <button
                        type="button"
                        onClick={() => setImgIdx(i => i + 1)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow transition"
                      >
                        <ChevronRight className="w-5 h-5 text-[#1c1917]" />
                      </button>
                    )}
                    <div className="absolute bottom-2 right-3 px-2 py-0.5 rounded-full bg-black/50 text-white text-xs">
                      {imgIdx + 1} / {images.length}
                    </div>
                  </>
                )}
              </div>
              {/* Thumbnail strip */}
              {images.length > 1 && (
                <div className="flex gap-2 px-4 py-3 overflow-x-auto">
                  {images.map((img, i) => (
                    <button key={i} type="button" onClick={() => setImgIdx(i)} className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolveImageUrl(img)}
                        alt=""
                        className={`h-14 w-20 object-cover rounded-lg transition ${i === imgIdx ? 'ring-2 ring-[#b8864a]' : 'opacity-60 hover:opacity-90'}`}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Details */}
          <div className="px-5 py-5 space-y-4">
            {meta.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {meta.map((m, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 text-stone-600 text-xs font-medium">
                    {m.icon}{m.label}
                  </span>
                ))}
              </div>
            )}
            {project.description && (
              <p className="text-sm text-stone-600 leading-relaxed">{project.description}</p>
            )}
            {Array.isArray(project.tags) && project.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {project.tags.map((tag, i) => (
                  <span key={i} className="px-2.5 py-0.5 text-[11px] text-[#8b6914] bg-[#f5f0e8] rounded-full font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


export default function ExpertDetailClient({ expert, isVn }: ExpertDetailClientProps) {
  const router = useRouter();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const currentYear = new Date().getFullYear();
  const age = expert.birth_year && expert.birth_year > 1900 ? currentYear - expert.birth_year : null;

  const metaParts: string[] = [];
  if (age) metaParts.push(isVn ? `${age} tuổi` : `Age ${age}`);
  if (Number(expert.experience_years) > 0) {
    metaParts.push(isVn ? `${expert.experience_years} năm kinh nghiệm` : `${expert.experience_years} yrs experience`);
  }
  if (expert.city) metaParts.push(expert.city);

  const cardCls = 'bg-white border border-stone-200/60 rounded-2xl p-6';
  const sectionTitle = 'font-serif text-lg text-[#1c1917] mb-4';

  const projects = expert.projects || [];

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ── Left main column ── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Header card */}
            <div className={cardCls}>
              <div className="flex flex-col sm:flex-row items-start gap-5">
                <Avatar name={expert.full_name} avatarUrl={expert.avatar_url || ''} size="xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h1 className="font-serif text-2xl sm:text-3xl text-[#1c1917]">{expert.full_name}</h1>
                    <ExpertBadges isSigned={expert.is_signed} isCertified={expert.is_certified} isVn={isVn} />
                  </div>
                  {expert.services.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {expert.services.map((svc) => (
                        <span key={svc} className="px-2.5 py-0.5 text-[11px] text-[#8b6914] bg-[#f5f0e8] rounded-full font-medium">
                          {svc}
                        </span>
                      ))}
                    </div>
                  )}
                  {metaParts.length > 0 && (
                    <p className="text-sm text-stone-500 flex items-center gap-1.5 flex-wrap">
                      {metaParts.map((part, i) => (
                        <span key={part} className="flex items-center gap-1.5">
                          {i > 0 && <span className="text-stone-300">·</span>}
                          {part}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Bio */}
            {expert.bio && (
              <div className={cardCls}>
                <h2 className={sectionTitle}>{isVn ? 'Giới thiệu' : 'About'}</h2>
                <p className="text-[15px] text-stone-600 leading-relaxed whitespace-pre-line">{expert.bio}</p>
              </div>
            )}

            {/* Work history */}
            {expert.work_history.length > 0 && (
              <div className={cardCls}>
                <h2 className={sectionTitle}>{isVn ? 'Kinh nghiệm làm việc' : 'Work Experience'}</h2>
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
              </div>
            )}

            {/* Skills */}
            {expert.skills.length > 0 && (
              <div className={cardCls}>
                <h2 className={sectionTitle}>{isVn ? 'Kỹ năng' : 'Skills'}</h2>
                <div className="flex flex-wrap gap-2">
                  {expert.skills.map((skill) => (
                    <span key={skill} className="px-3 py-1.5 text-sm text-stone-600 border border-stone-200 rounded-full bg-stone-50">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Certificates */}
            {(expert.certificates.length > 0 || Boolean(expert.license_verified)) && (
              <div className={cardCls}>
                <h2 className={sectionTitle}>{isVn ? 'Chứng chỉ' : 'Certificates'}</h2>
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
              </div>
            )}

            {/* Projects showcase — shared grid (same component as company detail) */}
            {projects.length > 0 && (
              <div className={cardCls}>
                <h2 className={sectionTitle}>
                  {isVn ? 'Dự án tiêu biểu' : 'Featured Projects'}
                  <span className="ml-2 text-sm font-normal text-stone-400">({projects.length})</span>
                </h2>
                <ProjectsShowcaseSection
                  variant="expert"
                  title={isVn ? 'Dự án tiêu biểu' : 'Featured Projects'}
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
              </div>
            )}

            {/* Mobile: inquiry form (all countries, below content on small screens) */}
            <div className="lg:hidden">
              <div className={cardCls}>
                <h2 className={sectionTitle}>
                  {isVn ? 'Gửi tin nhắn cho chuyên gia' : 'Message this expert'}
                </h2>
                <p className="text-xs text-stone-500 -mt-2 mb-4">
                  {isVn
                    ? 'Mô tả nhu cầu của bạn, chuyên gia sẽ phản hồi trực tiếp.'
                    : 'Describe your project and the expert will get back to you directly.'}
                </p>
                <ExpertInquiryForm expertId={expert.id} isVn={isVn} />
              </div>
              {isVn && Boolean(expert.has_phone) && (
                <div className={`${cardCls} mt-5`}>
                  <h2 className={sectionTitle}>Liên hệ trực tiếp</h2>
                  <RevealExpertPhone expertId={expert.id} isVn={isVn} />
                </div>
              )}
            </div>
          </div>

          {/* ── Right sticky sidebar (desktop only) ── */}
          <div className="hidden lg:block w-[320px] flex-shrink-0">
            <div className="sticky top-20 space-y-4">

              {/* Inquiry form card — all countries */}
              <div className={cardCls}>
                <h2 className="font-serif text-base text-[#1c1917] mb-1">
                  {isVn ? 'Gửi tin nhắn cho chuyên gia' : 'Message this expert'}
                </h2>
                <p className="text-xs text-stone-500 mb-4">
                  {isVn
                    ? 'Mô tả nhu cầu của bạn, chuyên gia sẽ phản hồi trực tiếp.'
                    : 'Describe your project and the expert will get back to you directly.'}
                </p>
                <ExpertInquiryForm expertId={expert.id} isVn={isVn} />
              </div>

              {/* Phone reveal card — VN only */}
              {isVn && Boolean(expert.has_phone) && (
                <div className={cardCls}>
                  <h2 className="font-serif text-base text-[#1c1917] mb-3">Liên hệ trực tiếp</h2>
                  <RevealExpertPhone expertId={expert.id} isVn={isVn} />
                </div>
              )}

              {/* Quick facts */}
              {(Number(expert.experience_years) > 0 || expert.city) && (
                <div className={cardCls}>
                  <div className="space-y-2.5 text-sm">
                    {Number(expert.experience_years) > 0 && (
                      <div className="flex items-center gap-2.5 text-stone-600">
                        <Briefcase className="w-4 h-4 text-[#b8864a] shrink-0" />
                        <span>
                          {isVn
                            ? `${expert.experience_years} năm kinh nghiệm`
                            : `${expert.experience_years} years experience`}
                        </span>
                      </div>
                    )}
                    {expert.city && (
                      <div className="flex items-center gap-2.5 text-stone-600">
                        <MapPin className="w-4 h-4 text-[#b8864a] shrink-0" />
                        <span>{expert.city}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
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

    </div>
  );
}
