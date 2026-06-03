'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SimpleGalleryProps {
  images: string[];
  title: string;
}

export default function SimpleGallery({ images, title }: SimpleGalleryProps) {
  const [idx, setIdx] = useState(0);
  if (!images.length) return null;
  return (
    <div className="relative rounded-xl overflow-hidden aspect-video bg-stone-100">
      <img src={images[idx]} alt={title} className="w-full h-full object-cover" />
      {images.length > 1 && (
        <>
          <button onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60" aria-label="Previous">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setIdx((i) => (i + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60" aria-label="Next">
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}
