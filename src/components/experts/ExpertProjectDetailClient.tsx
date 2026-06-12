'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, MapPin, Calendar, DollarSign, Maximize2 } from 'lucide-react';
import { resolveImageUrl } from '@/lib/imageUrl';
import Avatar from '@/components/ui/Avatar';
import { ExpertInquiryForm, RevealExpertPhone } from './ExpertContactSidebar';
import type { ExpertDetail, ExpertProjectItem } from './types';

interface Props {
  expert: ExpertDetail;
  project: ExpertProjectItem;
  isVn: boolean;
}

export default function ExpertProjectDetailClient({ expert, project, isVn }: Props) {
  const router = useRouter();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const images = project.images;

  const goPrev = useCallback(() => setCurrentIdx(i => (i > 0 ? i - 1 : images.length - 1)), [images.length]);
  const goNext = useCallback(() => setCurrentIdx(i => (i < images.length - 1 ? i + 1 : 0)), [images.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'Escape') { if (fullscreen) setFullscreen(false); else router.back(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext, fullscreen, router]);

  const siblings = (expert.projects || []).filter(p => p.slug && p.id !== project.id);

  const metaItems = [
    project.style ? { icon: null, label: project.style } : null,
    project.location ? { icon: <MapPin className="w-3.5 h-3.5" />, label: project.location } : null,
    project.area ? { icon: null, label: project.area } : null,
    project.year ? { icon: <Calendar className="w-3.5 h-3.5" />, label: String(project.year) } : null,
    project.cost ? { icon: <DollarSign className="w-3.5 h-3.5" />, label: project.cost } : null,
  ].filter(Boolean) as { icon: React.ReactNode; label: string }[];

  return (
    <>
      <div className="min-h-screen bg-white">
        {/* Sticky top nav */}
        <div className="sticky top-0 z-20 bg-white border-b border-stone-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 text-sm text-stone-600 hover:text-[#b8864a] transition"
            >
              <ArrowLeft className="w-4 h-4" />
              {isVn ? 'Quay lại' : 'Back'}
            </button>
            <span className="text-stone-300">·</span>
            <Link href={`/experts/${expert.slug}`} className="text-sm text-stone-500 hover:text-[#b8864a] transition line-clamp-1">
              {expert.full_name}
            </Link>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex flex-col lg:flex-row gap-8 items-start">

            {/* ── Left: images ── */}
            <div className="flex-1 min-w-0">
              {/* Main image */}
              {images.length > 0 ? (
                <div className="relative rounded-2xl overflow-hidden bg-stone-100 group">
                  <div className="relative aspect-video">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveImageUrl(images[currentIdx])}
                      alt={project.title}
                      className="w-full h-full object-cover"
                    />
                    {images.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={goPrev}
                          className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/90 hover:bg-white shadow-md transition opacity-0 group-hover:opacity-100"
                        >
                          <ChevronLeft className="w-5 h-5 text-[#1c1917]" />
                        </button>
                        <button
                          type="button"
                          onClick={goNext}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/90 hover:bg-white shadow-md transition opacity-0 group-hover:opacity-100"
                        >
                          <ChevronRight className="w-5 h-5 text-[#1c1917]" />
                        </button>
                        <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/50 text-white text-xs font-medium">
                          {currentIdx + 1} / {images.length}
                        </div>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setFullscreen(true)}
                      className="absolute top-3 right-3 p-2 rounded-full bg-white/90 hover:bg-white shadow transition opacity-0 group-hover:opacity-100"
                    >
                      <Maximize2 className="w-4 h-4 text-[#1c1917]" />
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Thumbnail strip */}
              {images.length > 1 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <button key={i} type="button" onClick={() => setCurrentIdx(i)} className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolveImageUrl(img)}
                        alt=""
                        className={`h-16 w-24 object-cover rounded-xl transition ${i === currentIdx ? 'ring-2 ring-[#b8864a]' : 'opacity-55 hover:opacity-80'}`}
                      />
                    </button>
                  ))}
                </div>
              )}

              {/* More projects — inside left column so it sits right below thumbnails */}
              {siblings.length > 0 && (
                <div className="mt-8 pt-6 border-t border-stone-100">
                  <h2 className="font-serif text-lg text-[#1c1917] mb-4">
                    {isVn ? 'Dự án khác' : 'More projects by'} {expert.full_name}
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {siblings.slice(0, 3).map(sib => {
                      const sibCover = Array.isArray(sib.images) && sib.images.length > 0
                        ? resolveImageUrl(sib.images[0])
                        : null;
                      return (
                        <Link
                          key={sib.id}
                          href={`/experts/${expert.slug}/${sib.slug}`}
                          className="group rounded-xl overflow-hidden border border-stone-200 hover:border-[#b8864a]/50 hover:shadow-md transition"
                        >
                          {sibCover ? (
                            <div className="aspect-video overflow-hidden bg-stone-100">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={sibCover}
                                alt={sib.title}
                                className="w-full h-full object-cover group-hover:scale-[1.04] transition duration-300"
                                loading="lazy"
                              />
                            </div>
                          ) : (
                            <div className="aspect-video bg-stone-100" />
                          )}
                          <div className="p-3">
                            <p className="text-xs font-semibold text-[#1c1917] line-clamp-2">{sib.title}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── Right: sticky details + contact ── */}
            <div className="lg:w-80 xl:w-96 shrink-0">
              <div className="lg:sticky lg:top-20 space-y-5">
                {/* Project info */}
                <div>
                  <h1 className="font-serif text-2xl sm:text-3xl text-[#1c1917] leading-snug mb-3">{project.title}</h1>
                  {metaItems.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {metaItems.map((m, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-100 text-stone-600 text-xs font-medium">
                          {m.icon}{m.label}
                        </span>
                      ))}
                    </div>
                  )}
                  {project.description && (
                    <p className="text-[15px] text-stone-600 leading-relaxed">{project.description}</p>
                  )}
                  {Array.isArray(project.tags) && project.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {project.tags.map((tag, i) => (
                        <span key={i} className="px-2.5 py-0.5 text-[11px] text-[#8b6914] bg-[#f5f0e8] rounded-full font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Expert card — display only, no navigation */}
                <div className="rounded-xl border border-stone-200 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={expert.full_name} avatarUrl={expert.avatar_url || ''} size="md" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#1c1917] line-clamp-1">{expert.full_name}</p>
                      {expert.services.length > 0 && (
                        <p className="text-xs text-stone-500 line-clamp-1">{expert.services[0]}</p>
                      )}
                    </div>
                  </div>
                  {Boolean(expert.has_phone) && (
                    <RevealExpertPhone expertId={expert.id} isVn={isVn} />
                  )}
                </div>

                {/* Contact form — all countries */}
                <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
                  <div>
                    <p className="font-serif text-base text-[#1c1917]">
                      {isVn ? 'Gửi tin nhắn cho chuyên gia' : 'Message this expert'}
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {isVn
                        ? 'Mô tả nhu cầu của bạn, chuyên gia sẽ phản hồi trực tiếp.'
                        : 'Describe your project and the expert will get back to you directly.'}
                    </p>
                  </div>
                  <ExpertInquiryForm expertId={expert.id} isVn={isVn} />
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Fullscreen overlay */}
      {fullscreen && images.length > 0 && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={() => setFullscreen(false)}
        >
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <ArrowLeft className="w-5 h-5 rotate-45" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveImageUrl(images[currentIdx])}
            alt={project.title}
            className="max-w-full max-h-[90vh] object-contain"
            onClick={e => e.stopPropagation()}
          />
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); goPrev(); }}
                className="absolute left-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); goNext(); }}
                className="absolute right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
