// AE 首页「What you can source」— 品类图卡网格（2026-07-20 重设计：只放图 + 品类名，零描述句）
// 高端场景美图做瓦片，点击进 /materials 对应场景筛选。server component（纯链接+图）。
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const TILES: { slug: string; label: string }[] = [
  { slug: 'feature-wall', label: 'Feature Walls' },
  { slug: 'flooring', label: 'Flooring' },
  { slug: 'countertop', label: 'Countertops & Surfaces' },
  { slug: 'kitchen-bath', label: 'Kitchen & Bath' },
  { slug: 'outdoor-garden', label: 'Outdoor & Facade' },
  { slug: 'furniture', label: 'Furniture & Décor' },
];

export default function HomeApplicationTiles() {
  return (
    <section className="bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#b8864a]">What You Can Source</p>
          <h2 className="mt-2 font-serif text-[26px] leading-tight tracking-[-0.01em] [text-wrap:balance] text-[#1c1917] sm:text-[34px]">
            Start with the look you want
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TILES.map((t) => (
            <Link
              key={t.slug}
              href={`/materials/new-materials?scene=${t.slug}`}
              className="group relative block aspect-[4/3] overflow-hidden rounded-2xl bg-stone-200 isolate"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/images/sourcing/scene-${t.slug}-medium.webp`}
                srcSet={`/images/sourcing/scene-${t.slug}-thumb.webp 600w, /images/sourcing/scene-${t.slug}-medium.webp 1200w, /images/sourcing/scene-${t.slug}.webp 2000w`}
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                alt={t.label}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
                <h3 className="font-serif text-xl text-white sm:text-2xl">{t.label}</h3>
                <span className="mb-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href="/materials/new-materials"
            className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-6 py-3 text-sm font-medium text-[#1c1917] transition hover:border-[#b8864a] hover:text-[#b8864a]"
          >
            Browse the Full Material Library <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
