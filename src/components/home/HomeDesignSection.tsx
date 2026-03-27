import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, MapPin } from 'lucide-react';
import type { Company } from '../../lib/companyData';
import { fetchPublicCompanies } from '../../lib/publicApi';
import { getNextRenderableImageIndex } from '../../lib/imageCleanup';

// Hero Carousel for Home
function HeroCarousel({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  const [failedIndices, setFailedIndices] = useState<number[]>([]);

  const activeIndex = getNextRenderableImageIndex(images, index, failedIndices);
  const currentSrc = activeIndex === -1 ? '' : images[activeIndex];

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [images.length]);

  if (!currentSrc) return null;

  return (
    <div className="relative w-full h-full">
      <img
        src={currentSrc}
        alt="Interior design portfolio"
        className="w-full h-full object-cover"
        onError={() => {
          if (activeIndex !== -1) {
            setFailedIndices((prev) => [...prev, activeIndex]);
          }
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
    </div>
  );
}

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

  const heroImages = companies.flatMap(c => c.projectImages).slice(0, 5);
  const featured = companies
    .filter(c => c.projectCount >= 30)
    .sort((a, b) => b.projectCount - a.projectCount)
    .slice(0, 4);

  const stats = {
    companies: companies.length,
    cities: new Set(companies.map(c => c.city)).size,
    projects: companies.reduce((sum, c) => sum + c.projectCount, 0),
  };

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 bg-stone-100 rounded-full text-xs text-stone-500 mb-4">
            Across the UAE
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#1c1917] mb-4">
            Interior Design & Renovation
          </h2>
          <p className="text-lg text-stone-500 max-w-2xl mx-auto">
            Discover curated interior designers for your dream home
          </p>
        </div>

        {/* Hero Split */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {/* Left - Content */}
          <div className="flex flex-col justify-center">
            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="text-center">
                <div className="font-serif text-3xl text-[#1c1917] mb-1">{stats.companies}+</div>
                <div className="text-xs text-stone-400">Designers</div>
              </div>
              <div className="text-center">
                <div className="font-serif text-3xl text-[#1c1917] mb-1">{stats.cities}</div>
                <div className="text-xs text-stone-400">Cities</div>
              </div>
              <div className="text-center">
                <div className="font-serif text-3xl text-[#1c1917] mb-1">{stats.projects}+</div>
                <div className="text-xs text-stone-400">Projects</div>
              </div>
            </div>
            <p className="text-stone-500 leading-relaxed mb-6">
              Browse verified interior design companies across Dubai, Abu Dhabi, and the Emirates.
              View portfolios, compare styles, and find the perfect match for your project.
            </p>
            <Link
              to="/companies"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#1c1917] text-white font-medium rounded-full hover:bg-[#b8860b] transition"
            >
              Explore Designers
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

          {/* Right - Image */}
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-stone-100">
            {heroImages.length > 0 ? (
              <HeroCarousel images={heroImages} />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200">
                <Building2 className="w-16 h-16 text-stone-300" />
              </div>
            )}
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
