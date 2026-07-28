'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { MegaCategory } from '@/lib/materialMacros';
import { MACRO_COVER, MACRO_DEDICATED_PAGE } from '@/lib/materialMacros';

export default function HubFeatured({ categories }: { categories: MegaCategory[] }) {
  const featured = categories.slice(0, 8);

  return (
    <div className="space-y-10">
      {/* Differentiator promo */}
      <section className="relative overflow-hidden rounded-3xl bg-[#1c1917] px-8 py-10 sm:px-12 sm:py-14">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c6a065]">
              Tarmeer Advantage
            </p>
            <h2 className="mt-3 font-serif text-3xl leading-tight text-white sm:text-4xl [text-wrap:balance]">
              See it in Dubai, source it from China
            </h2>
            <p className="mt-4 text-base leading-relaxed text-stone-300">
              Touch the newest materials at our Dubai selection center, then we source
              factory-direct from China and deliver across the UAE.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:shrink-0">
            <Link
              href="/materials/showroom"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#b8864a] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#a07640]"
            >
              Visit the selection center
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/for-designers/china-tour"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/40 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white/10"
            >
              See the study tour
            </Link>
          </div>
        </div>
      </section>

      {/* Featured categories */}
      <section>
        <h3 className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
          Browse by material
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {featured.map((c) => {
            const coverHref = MACRO_DEDICATED_PAGE[c.key] ?? '/materials/category/' + c.key;
            const cover = MACRO_COVER[c.key];
            return (
              <Link
                key={c.key}
                href={coverHref}
                className="group relative block overflow-hidden rounded-2xl"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-stone-100">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${cover}-medium.webp`}
                      srcSet={`${cover}-thumb.webp 600w, ${cover}-medium.webp 1200w`}
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      alt={c.label}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : null}
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-4">
                  <p className="font-serif text-lg leading-tight text-white [text-wrap:balance]">
                    {c.label}
                  </p>
                  <p className="mt-1 text-xs text-stone-200">
                    {c.productCount} products · {c.supplierCount} suppliers
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Directory hint */}
      <div className="border-t border-stone-200 pt-6">
        <Link
          href="/materials"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition-colors hover:text-[#b8864a]"
        >
          Looking for a specific supplier? Browse the full supplier directory
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
