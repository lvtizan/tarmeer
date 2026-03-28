import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { PortfolioItem } from '../lib/companyData';

interface LightboxProps {
  open: boolean;
  images: PortfolioItem[];
  currentIndex: number;
  categoryName: string;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export default function Lightbox({
  open,
  images,
  currentIndex,
  categoryName,
  onClose,
  onNavigate,
}: LightboxProps) {
  const thumbnailRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onNavigate(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < images.length - 1) {
        onNavigate(currentIndex + 1);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, currentIndex, images.length, onNavigate, onClose]);

  // Scroll active thumbnail into view
  useEffect(() => {
    if (!open || !thumbnailRef.current) return;
    const activeThumb = thumbnailRef.current.querySelector('[data-active="true"]') as HTMLElement;
    if (activeThumb) {
      activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [currentIndex, open]);

  if (!open || images.length === 0) return null;

  const currentImage = images[currentIndex];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="lightbox-overlay"
          className="fixed inset-0 z-50 flex flex-col bg-[#faf9f7]/95 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          {/* Top bar */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#1c1917]">{categoryName}</span>
              <span className="text-sm text-[#2c2c2c]/60">
                {currentIndex + 1} of {images.length}
              </span>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white shadow-md hover:bg-stone-50 border border-stone-100 transition-colors"
              aria-label="Close lightbox"
            >
              <X size={18} className="text-[#1c1917]" />
            </button>
          </div>

          {/* Main image area */}
          <div
            className="flex-1 flex items-center justify-center relative px-12 min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Prev button */}
            {currentIndex > 0 && (
              <button
                onClick={() => onNavigate(currentIndex - 1)}
                className="absolute left-3 flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-md hover:bg-stone-50 border border-stone-100 transition-colors z-10"
                aria-label="Previous image"
              >
                <ChevronLeft size={20} className="text-[#1c1917]" />
              </button>
            )}

            {/* Image */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                className="flex flex-col items-center gap-3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={currentImage.url}
                  alt={currentImage.title || `Image ${currentIndex + 1}`}
                  className="max-w-[85vw] max-h-[70vh] object-contain rounded-lg shadow-lg"
                />
                {currentImage.title && (
                  <p className="text-sm text-[#2c2c2c] text-center max-w-md">
                    {currentImage.title}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Next button */}
            {currentIndex < images.length - 1 && (
              <button
                onClick={() => onNavigate(currentIndex + 1)}
                className="absolute right-3 flex items-center justify-center w-10 h-10 rounded-full bg-white shadow-md hover:bg-stone-50 border border-stone-100 transition-colors z-10"
                aria-label="Next image"
              >
                <ChevronRight size={20} className="text-[#1c1917]" />
              </button>
            )}
          </div>

          {/* Thumbnail strip */}
          <div
            className="shrink-0 bg-white border-t border-stone-100 shadow-sm py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              ref={thumbnailRef}
              className="flex gap-2 overflow-x-auto px-4 max-w-4xl mx-auto scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {images.map((image, index) => (
                <button
                  key={index}
                  data-active={index === currentIndex ? 'true' : 'false'}
                  onClick={() => onNavigate(index)}
                  className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden transition-all ${
                    index === currentIndex
                      ? 'ring-2 ring-[#c6a065] opacity-100'
                      : 'opacity-50 hover:opacity-80'
                  }`}
                  aria-label={`Go to image ${index + 1}`}
                >
                  <img
                    src={image.url}
                    alt={image.title || `Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
