import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, MapPin, Calendar, Instagram, Globe, Briefcase, Mail } from 'lucide-react';
import type { Company } from '../../lib/companyData';
import { getImageFallbackCandidates, getNextRenderableImageIndex } from '../../lib/imageCleanup';
import { resolveImageUrl, resolveVariantUrl } from '../../lib/imageUrl';
import { trackClickButton } from '../../lib/analytics';

interface CompanyCardProps {
  company: Company;
}

export default function CompanyCard({ company }: CompanyCardProps) {
  const [imgIndex, setImgIndex] = useState(0);
  const [imgRetryIndex, setImgRetryIndex] = useState(0);
  const [failedIndices, setFailedIndices] = useState<number[]>([]);
  const images = company.projectImages;
  const activeIndex = getNextRenderableImageIndex(images, imgIndex, failedIndices);
  const currentSrc = activeIndex === -1 ? '' : resolveImageUrl(images[activeIndex]);
  const thumbSrc = activeIndex === -1 ? '' : resolveVariantUrl(images[activeIndex], 'thumb');
  const currentCandidates = [thumbSrc, ...getImageFallbackCandidates(currentSrc)].filter(Boolean);
  const displaySrc = currentCandidates[imgRetryIndex] || currentSrc;
  const hasMultiple = images.length > 1;
  const hasImage = Boolean(currentSrc);

  useEffect(() => {
    setImgRetryIndex(0);
  }, [activeIndex]);

  const handleImageError = () => {
    if (imgRetryIndex < currentCandidates.length - 1) {
      setImgRetryIndex((prev) => prev + 1);
      return;
    }
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

  const thumbnailImages = images.slice(0, 3);

  return (
    <article className="group bg-white rounded-xl border border-stone-100 hover:border-[#c6a065]/50 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col overflow-hidden">
      {/* Main Image */}
      <Link
        to={`/companies/${company.id}`}
        className="block relative w-full h-0 pb-[66.67%] bg-stone-200 overflow-hidden"
      >
        {hasImage ? (
          <img
            src={displaySrc}
            alt={`Project by ${company.name}`}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500"
            onError={handleImageError}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#c6a065]/10 to-[#b8864a]/20">
            <span className="font-serif text-5xl text-[#c6a065]/40">{company.name.charAt(0)}</span>
          </div>
        )}

        {/* Image counter */}
        {hasMultiple && (
          <div className="absolute top-3 right-3 px-2.5 py-1 bg-black/60 backdrop-blur-sm rounded-full text-white text-xs font-medium">
            {activeIndex + 1} / {images.length}
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </Link>

      {/* Thumbnail Gallery */}
      {thumbnailImages.length > 1 && (
        <div className="flex gap-1.5 p-3 bg-stone-50 border-b border-stone-100">
          {thumbnailImages.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setImgIndex(idx)}
              className={`flex-1 aspect-video rounded-lg overflow-hidden border-2 transition ${
                idx === activeIndex ? 'border-[#c6a065]' : 'border-transparent hover:border-stone-300'
              }`}
            >
              <img src={resolveVariantUrl(img, 'thumb')} alt={`${company.name} project ${idx + 1}`} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = resolveImageUrl(img); }} />
            </button>
          ))}
        </div>
      )}

      <div className="p-4 sm:p-5 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1">
            <h3 className="font-serif font-semibold text-lg text-[#2c2c2c] group-hover:text-[#c6a065] transition mb-1.5">
              {company.name}
            </h3>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#6b6b6b]">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#c6a065]" />
                {company.city}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#c6a065]" />
                Since {company.foundedYear}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-[#6b6b6b] line-clamp-2 mb-4 flex-1 leading-relaxed">
          {company.shortDescription}
        </p>

        {/* Services */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {company.services.slice(0, 3).map((service) => (
            <span
              key={service}
              className="inline-flex items-center gap-1 px-2 py-1 bg-[#faf9f7] text-[#6b6b6b] text-xs rounded-full"
            >
              <Briefcase className="w-3 h-3" />
              {service}
            </span>
          ))}
          {company.services.length > 3 && (
            <span className="px-2 py-1 bg-[#faf9f7] text-[#6b6b6b] text-xs rounded-full">
              +{company.services.length - 3}
            </span>
          )}
        </div>

        {/* Footer with Send Message and View */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-stone-100">
          <Link
            to={`/companies/${company.id}`}
            className="inline-flex items-center justify-center gap-2 flex-1 px-4 py-2.5 rounded-lg border border-[#c6a065] text-[#c6a065] font-semibold whitespace-nowrap hover:bg-[#c6a065] hover:text-white transition-colors text-sm"
            onClick={(e) => { e.stopPropagation(); trackClickButton({ content_name: `Send Message - ${company.name}` }); }}
          >
            <Mail className="w-4 h-4" />
            Send Message
          </Link>
          <Link
            to={`/companies/${company.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#c6a065] text-white font-medium hover:bg-[#a67c47] transition text-sm"
            onClick={() => trackClickButton({ content_name: `View - ${company.name}` })}
          >
            View
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Location info */}
        <div className="flex items-center gap-1.5 mt-2.5 text-xs text-[#6b6b6b]">
          <MapPin className="w-3.5 h-3.5 text-[#c6a065] flex-shrink-0" />
          <span>{company.projectCount}+ projects in the {company.city} area</span>
        </div>

        {/* Social links */}
        {(company.instagram || company.website) && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-stone-100">
            {company.instagram && (
              <a
                href={company.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#6b6b6b] hover:text-[#c6a065] transition"
                onClick={(e) => e.stopPropagation()}
              >
                <Instagram className="w-4 h-4" />
              </a>
            )}
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#6b6b6b] hover:text-[#c6a065] transition"
                onClick={(e) => e.stopPropagation()}
              >
                <Globe className="w-4 h-4" />
              </a>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
