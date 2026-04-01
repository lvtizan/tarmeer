import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import type { Company } from '../../lib/companyData';
import { fetchPublicCompanies } from '../../lib/publicApi';
import { getNextRenderableImageIndex } from '../../lib/imageCleanup';

// Featured Card
function FeaturedCard({ company }: { company: Company }) {
  const [imgIndex, setImgIndex] = useState(0);
  const [failedIndices, setFailedIndices] = useState<number[]>([]);
  const images = company.projectImages;
  const activeIndex = getNextRenderableImageIndex(images, imgIndex, failedIndices);
  const currentSrc = activeIndex === -1 ? '' : images[activeIndex];

  return (
    <Link
      to={`/companies/${company.id}`}
      className="group"
    >
      <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-stone-100 mb-3">
        {currentSrc ? (
          <img
            src={currentSrc}
            alt={company.name}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
            onError={() => {
              if (activeIndex !== -1) {
                setFailedIndices((prev) => [...prev, activeIndex]);
                const next = getNextRenderableImageIndex(images, activeIndex + 1, [...failedIndices, activeIndex]);
                if (next !== -1) setImgIndex(next);
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200">
            <span className="font-serif text-4xl text-stone-300">{company.name.charAt(0)}</span>
          </div>
        )}
      </div>
      <h3 className="font-serif text-lg text-[#1c1917] group-hover:text-[#b8860b] transition mb-1">
        {company.name}
      </h3>
      <p className="text-stone-500 text-sm mb-2">{company.shortDescription}</p>
      <div className="flex items-center gap-3 text-xs text-stone-400">
        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{company.city}</span>
        <span>{company.projectCount}+ projects</span>
      </div>
    </Link>
  );
}

export default function HomeDesignSection() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [heroImageIndex, setHeroImageIndex] = useState(0);

  useEffect(() => {
    let active = true;
    fetchPublicCompanies(12)
      .then((items) => {
        if (!active) return;
        setCompanies(items.slice(0, 8));
      })
      .catch((error) => {
        console.error('Failed to load home companies:', error);
      });
    return () => { active = false; };
  }, []);

  const heroImages = [
    '/images/uae-companies/portfolio/antonovich-design/office/3.jpg',
    '/images/uae-companies/portfolio/antonovich-design/office/2.jpg',
    '/images/uae-companies/portfolio/antonovich-design/hotel/5.jpg',
    '/images/uae-companies/portfolio/antonovich-design/restaurant/10.jpg',
    '/images/uae-companies/portfolio/algedra/4.jpg',
  ];
  const featured = companies
    .filter(c => c.projectCount >= 30)
    .sort((a, b) => b.projectCount - a.projectCount)
    .slice(0, 4);

  const activeHeroImage = heroImages[heroImageIndex] || heroImages[0];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-[44fr_56fr] gap-8 lg:gap-10 mb-16 items-stretch">
          <div className="rounded-[28px] bg-[#141311] border border-[#2d2a24] px-7 sm:px-10 py-10 sm:py-12 flex flex-col justify-center">
            <p className="text-[10px] sm:text-[11px] tracking-[0.18em] uppercase text-[#c9b58f] mb-6">
              Curated Interior Designers in the UAE
            </p>
            <h2 className="font-serif text-[35px] sm:text-[48px] lg:text-[56px] leading-[1.04] tracking-[-0.015em] text-[#f6f2ea] max-w-[13ch]">
              Find the Right Designer
              <br />
              for Your Home
            </h2>
            <p className="text-[#d2ccc2]/75 text-[15px] sm:text-[16px] leading-relaxed max-w-[40ch] mt-6">
              Browse verified studios, compare styles, and explore portfolios across Dubai and Abu Dhabi.
            </p>
            <Link
              to="/companies"
              className="inline-flex w-fit items-center gap-2 mt-8 px-7 py-3.5 rounded-full border border-[#bfa67e]/55 text-[#f2eadb] text-sm tracking-[0.08em] uppercase hover:bg-[#bfa67e]/12 transition"
            >
              Explore Designers
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="relative rounded-[28px] overflow-hidden min-h-[420px] bg-[#0f0f0d] border border-[#27241f]">
            <img
              src={activeHeroImage}
              alt="Luxury interior design space"
              className="w-full h-full object-cover"
              onError={() => setHeroImageIndex((idx) => (idx + 1) % heroImages.length)}
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,10,10,0.30)_0%,rgba(10,10,10,0.05)_42%,rgba(10,10,10,0.2)_100%)]" />
            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
              <p className="text-[10px] sm:text-[11px] tracking-[0.14em] uppercase text-white/72">
                Large elegant interior image
              </p>
            </div>
          </div>
        </div>

        {/* Featured Designers */}
        {featured.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-2xl text-[#1c1917]">Featured Designers</h3>
              <Link
                to="/companies"
                className="hidden sm:flex items-center gap-1 text-sm text-stone-400 hover:text-[#b8860b] transition"
              >
                View all
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featured.map((company) => (
                <FeaturedCard key={company.id} company={company} />
              ))}
            </div>
            <div className="sm:hidden text-center mt-6">
              <Link
                to="/companies"
                className="inline-flex items-center gap-1 text-sm text-stone-400 hover:text-[#b8860b]"
              >
                View all designers
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
