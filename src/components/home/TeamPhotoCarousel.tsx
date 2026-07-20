'use client';

// 首页「中国接待团队」多图切换轮播（合影 + 真实看厂照，客户面部已脱敏）
// 自动切换 + 圆点 + 左右箭头 + hover 暂停。图片走 4 档 webp 变体。
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// 只保留有客户在场的镜头（tour-2 客户侧对墙无法脱敏，已移除）
const IMAGES = [
  { src: 'people-hero', alt: 'A Tarmeer consultant guiding Gulf clients through new building materials from China' },
  { src: 'team-clients', alt: 'Tarmeer team with overseas clients at a showroom in China' },
  { src: 'tour-1', alt: 'Tarmeer team walking Gulf clients through a tile showroom in China' },
  { src: 'tour-3', alt: 'Team presenting stone materials to visiting clients in China' },
];

export default function TeamPhotoCarousel() {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = IMAGES.length;

  const go = useCallback((n: number) => setIdx((i) => (i + n + count) % count), [count]);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % count), 4500);
    return () => clearInterval(t);
  }, [paused, count]);

  return (
    <div
      className="group relative aspect-video overflow-hidden rounded-2xl bg-stone-200 isolate"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {IMAGES.map((im, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={im.src}
          src={`/images/sourcing/${im.src}-medium.webp`}
          srcSet={`/images/sourcing/${im.src}-thumb.webp 600w, /images/sourcing/${im.src}-medium.webp 1200w`}
          sizes="(min-width: 1024px) 50vw, 100vw"
          alt={im.alt}
          loading={i === 0 ? 'eager' : 'lazy'}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            i === idx ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}

      {/* 左右箭头（hover 显示） */}
      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Previous photo"
        className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white opacity-0 backdrop-blur-sm transition hover:bg-black/55 group-hover:opacity-100"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="Next photo"
        className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white opacity-0 backdrop-blur-sm transition hover:bg-black/55 group-hover:opacity-100"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* 圆点 */}
      <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
        {IMAGES.map((im, i) => (
          <button
            key={im.src}
            type="button"
            onClick={() => setIdx(i)}
            aria-label={`Go to photo ${i + 1}`}
            className={`h-2 rounded-full transition-all ${
              i === idx ? 'w-6 bg-white' : 'w-2 bg-white/55 hover:bg-white/80'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
