import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ImageIcon } from 'lucide-react';
import type { Designer } from '../../data/designers';

interface DesignerCardProps {
  designer: Designer;
}

export default function DesignerCard({ designer }: DesignerCardProps) {
  const [imgIndex, setImgIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const images = designer.projectImages;
  const currentSrc = images[imgIndex] || images[0];
  const hasMultiple = images.length > 1;

  const handleImageError = () => setImageError(true);
  const goNext = (e: React.MouseEvent) => {
    e.preventDefault();
    setImageError(false);
    setImgIndex((i) => (i + 1) % images.length);
  };

  return (
    <article className="group bg-white rounded-xl overflow-hidden border border-stone-100 hover:border-[#c6a065]/30 hover:shadow-lg transition-all duration-200 hover:-translate-y-1 flex flex-col">
      {/* Top: project/case image (main focus) */}
      <Link to={`/designers/${designer.slug}`} className="block relative aspect-video bg-stone-200 overflow-hidden">
        {imageError ? (
          <div className="w-full h-full flex items-center justify-center bg-stone-200 text-stone-400" aria-hidden>
            <ImageIcon className="w-14 h-14" />
          </div>
        ) : (
          <img
            src={currentSrc}
            alt={`Project by ${designer.name}`}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            onError={handleImageError}
          />
        )}
        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={goNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow"
              aria-label="Next image"
            >
              <ChevronRight className="w-5 h-5 text-[#2c2c2c]" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full ${i === imgIndex ? 'bg-[#c6a065]' : 'bg-white/80'}`}
                  aria-hidden
                />
              ))}
            </div>
          </>
        )}
      </Link>

      {/* Bottom: designer info */}
      <div className="p-4 sm:p-5 flex flex-col flex-1">
        <div className="flex items-start gap-3 mb-2">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow flex-shrink-0">
            <img src={designer.avatar} alt={`${designer.name} avatar`} className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0 flex-1 overflow-visible">
            <p className="text-xs text-[#6b6b6b]">Available this week</p>
            <h3 className="font-semibold text-[#2c2c2c] group-hover:text-[#c6a065] transition break-words whitespace-normal">
              {designer.name}
            </h3>
            <p className="text-xs text-[#6b6b6b] flex items-center gap-1 mt-0.5" aria-label="Location">
              <span aria-hidden>📍</span> {designer.location}
            </p>
          </div>
        </div>
        <p className="text-sm text-[#6b6b6b] line-clamp-2 mb-4 flex-1">
          {designer.bioShort}
        </p>
        <Link
          to={`/designers/${designer.slug}`}
          className="inline-flex items-center justify-center gap-1 w-full py-3 px-4 rounded-lg border-2 border-[#c6a065] text-[#c6a065] font-medium hover:bg-[#c6a065] hover:text-white transition text-sm"
        >
          Design with {designer.firstName}
        </Link>
      </div>
    </article>
  );
}
