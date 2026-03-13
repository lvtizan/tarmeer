import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface ProjectGalleryProps {
  images: string[];
  title?: string;
  /** When true, do not open a lightbox on image click (e.g. when already inside a large modal) */
  disableLightbox?: boolean;
}

// 图片加载缓存
const loadedImages = new Set<string>();

function ProgressiveImg({ src, alt, className = '', loading = 'lazy' }: { src: string; alt: string; className?: string; loading?: 'eager' | 'lazy' }) {
  const [isLoaded, setIsLoaded] = useState(loadedImages.has(src));

  const handleLoad = () => {
    setIsLoaded(true);
    loadedImages.add(src);
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* 模糊占位 - 使用极小尺寸图片作为模糊背景 */}
      {!isLoaded && (
        <div 
          className="absolute inset-0 bg-stone-200"
          style={{
            backgroundImage: `url(${src.split('?')[0]}?w=40&q=10&blur=20)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(15px)',
            transform: 'scale(1.2)',
          }}
        />
      )}
      
      {/* 实际图片 */}
      <img
        src={src}
        alt={alt}
        loading={loading}
        onLoad={handleLoad}
        className={`w-full h-full object-cover transition-opacity duration-500 relative z-10 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  );
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

  return (
    <>
      <div className="space-y-3">
        {/* Main image with navigation overlaid in bottom-right corner */}
        <div className="relative w-full aspect-video sm:aspect-[16/10] rounded-lg overflow-hidden bg-stone-200">
          {disableLightbox ? (
            <ProgressiveImg
              src={images[index]}
              alt={title ? `${title} ${index + 1}` : ''}
              className="w-full h-full"
            />
          ) : (
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="w-full h-full focus:outline-none focus:ring-2 focus:ring-[#c6a065]"
            >
              <ProgressiveImg
                src={images[index]}
                alt={title ? `${title} ${index + 1}` : ''}
                className="w-full h-full hover:scale-105 transition-transform duration-300"
              />
            </button>
          )}
          
          {/* Navigation controls in bottom-right corner */}
          {images.length > 1 && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1">
              <button
                type="button"
                onClick={goPrev}
                className="p-1 text-white hover:bg-white/20 rounded-full transition"
                aria-label="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-white px-1">
                {index + 1} / {images.length}
              </span>
              <button
                type="button"
                onClick={goNext}
                className="p-1 text-white hover:bg-white/20 rounded-full transition"
                aria-label="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Thumbnails */}
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
                <ProgressiveImg src={src} alt="" className="w-full h-full" />
              </button>
            ))}
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
          <ProgressiveImg
            src={images[index]}
            alt=""
            className="max-w-full max-h-[90vh]"
            loading="eager"
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goNext(e); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white hover:bg-white/10 rounded-full"
            aria-label="Next"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
          {/* Lightbox pagination */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goPrev(e); }}
              className="p-1 text-white hover:bg-white/20 rounded-full transition"
              aria-label="Previous"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-white">
              {index + 1} / {images.length}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goNext(e); }}
              className="p-1 text-white hover:bg-white/20 rounded-full transition"
              aria-label="Next"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
