'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, MapPin, BadgeCheck } from 'lucide-react';
import type { Company } from '../../lib/companyData';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import { getImageFallbackCandidates, getNextRenderableImageIndex } from '../../lib/imageCleanup';
import { resolveImageUrl, resolveVariantUrl } from '../../lib/imageUrl';

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

  useEffect(() => { setImgRetryIndex(0); }, [activeIndex]);

  return (
    <div className={`relative overflow-hidden bg-stone-100 ${className}`}>
      {currentSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displaySrc}
          alt={company.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          onError={() => {
            if (imgRetryIndex < currentCandidates.length - 1) { setImgRetryIndex((p) => p + 1); return; }
            if (activeIndex !== -1) {
              setFailedIndices((p) => [...p, activeIndex]);
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

function toDisplayName(name: string): string {
  const letters = name.replace(/[^a-zA-Z]/g, '');
  const upperRatio = letters.length > 0 ? (name.match(/[A-Z]/g) || []).length / letters.length : 0;
  return upperRatio > 0.6 ? name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : name;
}

function FeaturedCompanyGrid({ companies }: { companies: Company[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {companies.map((company) => (
        <Link key={company.id} href={`/companies/${company.slug || company.id}`}
          className="group flex flex-col overflow-hidden rounded-[20px] border border-stone-200 bg-white transition hover:border-stone-300 hover:shadow-[0_18px_40px_rgba(28,25,23,0.08)]">
          <StudioImage company={company} className="aspect-video w-full" />
          <div className="flex flex-col p-4">
            <h4 className="flex items-center gap-1.5 font-serif font-semibold text-[18px] leading-tight text-[#1c1917] transition group-hover:text-[#b8864a]">
              {company.isSigned && (
                <span className="shrink-0 inline-flex items-center px-1.5 py-[2px] rounded bg-gradient-to-b from-[#d4a853] to-[#b8864a] text-white text-[10px] font-bold tracking-wider leading-none">Gold</span>
              )}
              {company.isCertified && (
                <span className="shrink-0 inline-flex items-center px-1.5 py-[2px] rounded bg-blue-500 text-white text-[10px] font-bold tracking-wider leading-none">✓</span>
              )}
              {!company.isSigned && company.isClaimed && (
                <BadgeCheck className="h-[18px] w-[18px] shrink-0 text-[#b8864a]/70" />
              )}
              <span className="line-clamp-1">{toDisplayName(company.name)}</span>
            </h4>
            <div className="mt-2 flex flex-nowrap gap-1.5 overflow-hidden">
              {(company.services ?? []).slice(0, 3).map((svc) => (
                <span key={svc} className="shrink-0 inline-block px-2.5 py-0.5 rounded-full border border-stone-200 text-[11px] text-stone-500">{svc}</span>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-stone-400">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{company.city}</span>
              <span>·</span>
              <span>{company.projectCount}+ Projects</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

const SERVICE_TABS = [
  { label: 'All', services: [], to: '/companies' },
  { label: 'Design & Planning', services: ['Interior Design', 'Architecture', 'Project Management'], to: '/companies?service=Interior+Design' },
  { label: 'Construction', services: ['Construction', 'Fit-Out'], to: '/companies?service=Construction' },
  { label: 'Design & Build', services: ['Design & Build', 'Turnkey Solutions'], to: '/companies?service=Design+%26+Build' },
  { label: 'Renovation', services: ['Renovation'], to: '/companies?service=Renovation' },
  { label: 'Outdoor & Pools', services: ['Landscape', 'Pools'], to: '/companies?service=Landscape' },
  { label: 'Home Systems', services: ['MEP', 'Smart Home & Automation', 'HVAC & Ducting'], to: '/companies?service=MEP' },
  { label: 'Interiors & Furniture', services: ['Furniture', 'Joinery', 'Curtains & Blinds'], to: '/companies?service=Furniture' },
  { label: 'Maintenance', services: ['Maintenance'], to: '/companies?service=Maintenance' },
];

function filterByTab(companies: Company[], tab: typeof SERVICE_TABS[number]): Company[] {
  if (!tab.services.length) return companies;
  return companies.filter((c) =>
    (c.services ?? []).some((s) => tab.services.some((t) => s.toLowerCase().includes(t.toLowerCase())))
  );
}

export default function HomeDesignSection({ initialCompanies }: { initialCompanies: Company[] }) {
  const { tr } = useSiteLocale();
  const [activeTabIdx, setActiveTabIdx] = useState(0);

  if (initialCompanies.length === 0) return null;

  const activeTab = SERVICE_TABS[activeTabIdx];
  const filtered = filterByTab(initialCompanies, activeTab);
  const featured = filtered.slice(0, 15);
  const hasMore = filtered.length > 15;

  return (
    <section className="bg-white py-10 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-[#b8864a]">{tr.home.curatedTag}</p>
            <h2 className="font-serif text-[26px] leading-tight text-[#1c1917] sm:text-[32px]">{tr.home.topCompanies}</h2>
          </div>
          <Link href={activeTab.to} className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-[#b8864a] hover:text-[#a07540] transition">
            {tr.home.viewAll} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex gap-2 flex-wrap mb-7">
          {SERVICE_TABS.map((tab, idx) => (
            <button key={tab.label} onClick={() => setActiveTabIdx(idx)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${idx === activeTabIdx ? 'bg-[#b8864a] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
              {tr.home.serviceTabs[tab.label as keyof typeof tr.home.serviceTabs] ?? tab.label}
            </button>
          ))}
        </div>

        {featured.length > 0 ? (
          <>
            <FeaturedCompanyGrid companies={featured} />
            {hasMore && (
              <div className="mt-5 flex justify-center">
                <Link href={activeTab.to} className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-5 py-2.5 text-sm font-medium text-[#1c1917] transition hover:border-[#b8864a] hover:text-[#b8864a]">
                  View More <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </>
        ) : (
          <div className="py-12 text-center text-stone-400 text-sm">No companies found for this category yet.</div>
        )}
      </div>
    </section>
  );
}
