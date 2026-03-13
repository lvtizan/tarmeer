import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { PublicDesignerCardData } from '../../lib/publicApi';
import type { Designer } from '../../data/designers';
import { getNextRenderableImageIndex } from '../../lib/imageCleanup';

type DesignerCardData = Pick<Designer, 'slug' | 'name' | 'firstName' | 'location' | 'style' | 'bioShort' | 'avatar' | 'projectImages'>;

interface DesignerCardProps {
  designer: DesignerCardData | PublicDesignerCardData;
}

export default function DesignerCard({ designer }: DesignerCardProps) {
  const [imgIndex, setImgIndex] = useState(0);
  const [failedIndices, setFailedIndices] = useState<number[]>([]);
  const images = designer.projectImages;
  const activeIndex = getNextRenderableImageIndex(images, imgIndex, failedIndices);
  const currentSrc = activeIndex === -1 ? '' : images[activeIndex];
  const hasMultiple = images.length > 1;
  const hasImage = Boolean(currentSrc);
  const hasAvatar = Boolean(designer.avatar);

  const handleImageError = () => {
    if (activeIndex === -1) return;
    const nextFailed = failedIndices.includes(activeIndex)
      ? failedIndices
      : [...failedIndices, activeIndex];
    setFailedIndices(nextFailed);

    const nextIndex = getNextRenderableImageIndex(images, activeIndex + 1, nextFailed);
    if (nextIndex !== -1) {
      setImgIndex(nextIndex);
    }
  };
  const goNext = (e: React.MouseEvent) => {
    e.preventDefault();
    const nextIndex = getNextRenderableImageIndex(images, activeIndex + 1, failedIndices);
    if (nextIndex !== -1) {
      setImgIndex(nextIndex);
    }
  };

  return (
    <article className="group bg-white rounded-lg border border-stone-100 hover:border-[#c6a065]/30 hover:shadow-lg transition-all duration-200 hover:-translate-y-1 flex flex-col overflow-hidden">
      {hasImage && (
        <Link
          to={`/designers/${designer.slug}`}
          className="block relative w-full h-0 pb-[56.25%] bg-stone-200 overflow-hidden rounded-t-lg"
        >
          <img
            src={currentSrc}
            alt={`Project by ${designer.name}`}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-300"
            onError={handleImageError}
          />
          {hasMultiple && (
            <>
              <button
                type="button"
                onClick={goNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow z-20 cursor-pointer"
                aria-label="Next image"
              >
                <ChevronRight className="w-5 h-5 text-[#2c2c2c]" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-20">
                {images.map((_, i) => (
                  <span
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full ${i === activeIndex ? 'bg-[#c6a065]' : 'bg-white/80'}`}
                    aria-hidden
                  />
                ))}
              </div>
            </>
          )}
        </Link>
      )}

      <div className="p-4 sm:p-5 flex flex-col flex-1">
        <div className="flex items-start gap-3 mb-3">
          {hasAvatar && (
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md bg-stone-200 shrink-0">
              <img
                src={designer.avatar}
                alt={`${designer.name} avatar`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
          <div className="flex-1 overflow-visible">
            <h3 className="font-semibold text-[#2c2c2c] group-hover:text-[#c6a065] transition text-left whitespace-nowrap">
              {designer.name}
            </h3>
            <p className="text-xs text-[#6b6b6b] flex items-center gap-1 mt-1 justify-start" aria-label="Location">
              <span aria-hidden>📍</span> <span>{designer.location}</span>
            </p>
          </div>
        </div>
        <p className="text-sm text-[#6b6b6b] line-clamp-2 mb-4 flex-1 text-left">
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
