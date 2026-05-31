'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { PortfolioItem } from '../lib/companyData';
import { resolveImageUrl } from '../lib/imageUrl';
import { getImageFallbackCandidates } from '../lib/imageCleanup';

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
  const currentImageCandidates = getImageFallbackCandidates(resolveImageUrl(currentImage.url));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="lightbox-overlay"
          className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
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
              <span className="text-sm font-medium text-white">{categoryName}</span>
              <span className="text-sm text-white/60">
                {currentIndex + 1} of {images.length}
              </span>
            </div>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="Close lightbox"
            >
              <X size={18} className="text-white" />
            </button>
          </div>

          {/* Main image area */}
          <div className="flex-1 flex items-center justify-center relative px-12 min-h-0">
            {/* Prev button */}
            {currentIndex > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex - 1); }}
                className="absolute left-3 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
                aria-label="Previous image"
              >
                <ChevronLeft size={20} className="text-white" />
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentImageCandidates[0] || ''}
                  alt={currentImage.title || `Image ${currentIndex + 1}`}
                  className="max-w-[92vw] max-h-[82vh] object-contain rounded-lg"
                  onError={(e) => {
                    const retryIndex = Number(e.currentTarget.dataset.retryIndex || '0');
                    if (retryIndex < currentImageCandidates.length - 1) {
                      const next = retryIndex + 1;
                      e.currentTarget.dataset.retryIndex = String(next);
                      e.currentTarget.src = currentImageCandidates[next];
                    }
                  }}
                />
                {currentImage.title && (
                  <p className="text-sm text-white/80 text-center max-w-md">
                    {currentImage.title}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Next button */}
            {currentIndex < images.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex + 1); }}
                className="absolute right-3 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
                aria-label="Next image"
              >
                <ChevronRight size={20} className="text-white" />
              </button>
            )}
          </div>

          {/* Thumbnail strip */}
          <div
            className="shrink-0 bg-black/50 border-t border-white/10 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              ref={thumbnailRef}
              className="flex gap-2 overflow-x-auto px-4 max-w-4xl mx-auto scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {images.map((image, index) => {
                const thumbCandidates = getImageFallbackCandidates(resolveImageUrl(image.url));
                return (
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbCandidates[0] || ''}
                      alt={image.title || `Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const retryIndex = Number(e.currentTarget.dataset.retryIndex || '0');
                        if (retryIndex < thumbCandidates.length - 1) {
                          const next = retryIndex + 1;
                          e.currentTarget.dataset.retryIndex = String(next);
                          e.currentTarget.src = thumbCandidates[next];
                        }
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
