import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface ProjectGalleryProps {
  images: string[];
  title?: string;
  /** When true, do not open a lightbox on image click (e.g. when already inside a large modal) */
  disableLightbox?: boolean;
}

export default function ProjectGallery({ images, title, disableLightbox }: ProjectGalleryProps) {
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % images.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxOpen, images.length]);

  if (images.length === 0) return null;

  const goPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((i) => (i - 1 + images.length) % images.length);
  };
  const goNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((i) => (i + 1) % images.length);
  };

  const mainImage = (
    <div className="block w-full aspect-video sm:aspect-[16/10] rounded-xl overflow-hidden bg-stone-200">
      <img
        src={images[index]}
        alt={title ? `${title} ${index + 1}` : ''}
        className="w-full h-full object-cover"
      />
    </div>
  );

  return (
    <>
      <div className="space-y-3">
        {disableLightbox ? (
          mainImage
        ) : (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="block w-full aspect-video sm:aspect-[16/10] rounded-xl overflow-hidden bg-stone-200 focus:outline-none focus:ring-2 focus:ring-[#c6a065]"
          >
            <img
              src={images[index]}
              alt={title ? `${title} ${index + 1}` : ''}
              className="w-full h-full object-cover hover:scale-105 transition duration-300"
            />
          </button>
        )}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className="flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-[#c6a065]"
                style={{ borderColor: i === index ? '#c6a065' : undefined }}
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
        {images.length > 1 && (
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={goPrev}
              className="p-2 rounded-full border border-stone-300 hover:bg-stone-100 transition"
              aria-label="Previous"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-[#6b6b6b] self-center">
              {index + 1} / {images.length}
            </span>
            <button
              type="button"
              onClick={goNext}
              className="p-2 rounded-full border border-stone-300 hover:bg-stone-100 transition"
              aria-label="Next"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Lightbox – hidden when disableLightbox (e.g. inside project detail modal) */}
      {!disableLightbox && lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal
          aria-label="Image gallery"
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goPrev(e); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 text-white hover:bg-white/10 rounded-full"
            aria-label="Previous"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <img
            src={images[index]}
            alt=""
            className="max-w-full max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goNext(e); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white hover:bg-white/10 rounded-full"
            aria-label="Next"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </div>
      )}
    </>
  );
}
