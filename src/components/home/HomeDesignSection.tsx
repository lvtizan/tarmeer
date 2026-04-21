import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import type { Company } from '../../lib/companyData';
import { fetchPublicCompanies } from '../../lib/publicApi';
import { getImageFallbackCandidates, getNextRenderableImageIndex } from '../../lib/imageCleanup';
import { resolveImageUrl, resolveVariantUrl } from '../../lib/imageUrl';

const HERO_IMAGES = [
  '/images/uae-companies/portfolio/hba-hirsch-bedner/general/6.jpg',
  '/images/uae-companies/portfolio/hba-hirsch-bedner/general/11.jpg',
  '/images/uae-companies/portfolio/hba-hirsch-bedner/general/12.jpg',
  '/images/uae-companies/portfolio/hba-hirsch-bedner/general/14.jpg',
];

function StudioImage({ company, className }: { company: Company; className: string }) {
  const [imgIndex, setImgIndex] = useState(0);
  const [imgRetryIndex, setImgRetryIndex] = useState(0);
  const [failedIndices, setFailedIndices] = useState<number[]>([]);
  const images = company.projectImages;
  const activeIndex = getNextRenderableImageIndex(images, imgIndex, failedIndices);
  const currentSrc = activeIndex === -1 ? '' : resolveImageUrl(images[activeIndex]);
  const thumbSrc = activeIndex === -1 ? '' : resolveVariantUrl(images[activeIndex], 'medium');
  const currentCandidates = [thumbSrc, ...getImageFallbackCandidates(currentSrc)].filter(Boolean);
  const displaySrc = currentCandidates[imgRetryIndex] || currentSrc;

  useEffect(() => {
    setImgRetryIndex(0);
  }, [activeIndex]);

  return (
    <div className={`relative overflow-hidden bg-stone-100 ${className}`}>
      {currentSrc ? (
        <img
          src={displaySrc}
          alt={company.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          onError={() => {
            if (imgRetryIndex < currentCandidates.length - 1) {
              setImgRetryIndex((prev) => prev + 1);
              return;
            }
            if (activeIndex !== -1) {
              setFailedIndices((prev) => [...prev, activeIndex]);
              const next = getNextRenderableImageIndex(images, activeIndex + 1, [...failedIndices, activeIndex]);
              if (next !== -1) setImgIndex(next);
            }
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200">
          <span className="font-serif text-4xl text-stone-300">{company.name.charAt(0)}</span>
        </div>
      )}
    </div>
  );
}

function FeaturedCompanyGrid({ companies }: { companies: Company[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {companies.map((company) => (
        <Link
          key={company.id}
          to={`/companies/${company.id}`}
          className="group grid min-h-[184px] grid-cols-[116px_1fr] gap-4 rounded-[24px] border border-stone-200 bg-white p-4 transition hover:border-stone-300 hover:shadow-[0_18px_40px_rgba(28,25,23,0.08)] sm:min-h-[196px] sm:grid-cols-[124px_1fr] sm:p-4.5"
        >
          <StudioImage company={company} className="aspect-[4/5] rounded-[20px]" />
          <div className="min-w-0 flex flex-col py-1">
            <p className="text-[10px] uppercase tracking-[0.22em] text-stone-400">{company.city}</p>
            <h4 className="mt-2 font-serif text-[23px] leading-tight text-[#1c1917] transition group-hover:text-[#b8864a] sm:text-[26px] line-clamp-2">
              {company.name}
            </h4>
            <p className="mt-2.5 line-clamp-2 text-[13px] leading-6 text-stone-500 sm:text-[14px]">
              {company.shortDescription}
            </p>
            <div className="mt-auto pt-2 flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] text-stone-400 sm:text-[10px]">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {company.city}
              </span>
              <span>{company.projectCount}+ Projects</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function HomeDesignSection() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [heroImageIndex, setHeroImageIndex] = useState(0);

  useEffect(() => {
    let active = true;
    fetchPublicCompanies(24, 'home')
      .then((items) => {
        if (!active) return;
        setCompanies(items);
      })
      .catch((error) => {
        console.error('Failed to load home companies:', error);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroImageIndex((current) => (current + 1) % HERO_IMAGES.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  // Keep backend-provided order (operations-managed display order), do not re-sort on frontend.
  const featured = companies.slice(0, 6);
  const hasMoreCompanies = companies.length > 6;

  return (
    <section className="bg-white py-10 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="relative mb-7 overflow-hidden rounded-[28px] border border-stone-200 bg-[#0f0f0d] min-h-[210px] sm:mb-8 sm:min-h-[240px]">
          <img
            src={resolveImageUrl(HERO_IMAGES[heroImageIndex])}
            alt="Premium design and build spaces across the Middle East"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,7,6,0.82)_0%,rgba(8,7,6,0.58)_34%,rgba(8,7,6,0.16)_68%,rgba(8,7,6,0.12)_100%)]" />
          <div className="relative z-10 flex min-h-[210px] items-end px-5 py-5 sm:min-h-[240px] sm:px-6 sm:py-6 lg:px-8 lg:py-7">
            <div className="max-w-[420px]">
              <p className="mb-2 text-[9px] font-medium uppercase tracking-[0.2em] text-[#d0bc93] sm:text-[10px]">
                For Homeowners Across the Region
              </p>
              <h2 className="max-w-[10ch] font-serif text-[24px] leading-[0.94] tracking-[-0.02em] text-[#f6f2ea] sm:text-[29px] lg:text-[36px]">
                The Middle East&apos;s Design &amp; Build Collective
              </h2>
              <p className="mt-2.5 max-w-[40ch] whitespace-nowrap text-[11px] leading-5 text-[#e0d8cb]/88 sm:text-[12px]">
                Bringing trusted designers, contractors, suppliers and fit-out partners onto one platform.
              </p>
              <Link
                to="/companies"
                className="mt-3 inline-flex w-fit items-center gap-2 rounded-full border border-[#bfa67e]/55 px-4 py-2 text-[10px] uppercase tracking-[0.08em] text-[#f2eadb] transition hover:bg-[#bfa67e]/12 sm:text-[11px]"
              >
                Explore Companies
                <ArrowRight className="w-4 h-4" />
              </Link>
              <div className="mt-2.5 flex items-center gap-2">
                {HERO_IMAGES.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    aria-label={`Show hero image ${index + 1}`}
                    onClick={() => setHeroImageIndex(index)}
                    className={`h-2.5 rounded-full transition-all ${
                      heroImageIndex === index
                        ? 'w-8 bg-[#d0bc93]'
                        : 'w-2.5 bg-white/35 hover:bg-white/55'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {featured.length > 0 && (
          <div>
            <FeaturedCompanyGrid companies={featured} />
            {hasMoreCompanies && (
              <div className="mt-5 flex justify-center">
                <Link
                  to="/companies"
                  className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-5 py-2.5 text-sm font-medium text-[#1c1917] transition hover:border-[#b8864a] hover:text-[#b8864a]"
                >
                  View More
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
