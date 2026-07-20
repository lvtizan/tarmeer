'use client';

// 首屏 Hero 背景轮播（带客视察中国大板展厅，Agnes 生成，全身入镜不切头）。
// 自动 crossfade；object-[center_30%] 头部优先不切；首图 eager 其余 lazy。文案/渐变由 HomeMaterialsHero 叠在上层。
import { useState, useEffect } from 'react';

// Hero 轮播图：hero-real-1=用户 GPT 生成宽幅图(2172px)，hero-real-2=真拍指板近景(2560px)。
// 都是"中方 + 2-3 中东客、着装多样、全身不切头"，清晰。
const SLIDES = [
  { src: '/images/sourcing/hero-real-1', w: 2172, alt: 'Chinese hosts guiding Gulf clients on a walk-through of a large-format stone slab showroom in China' },
  { src: '/images/sourcing/hero-real-3', w: 2172, alt: 'Chinese staff hosting Gulf clients touring a modern kitchen and stone showroom in China' },
  { src: '/images/sourcing/hero-real-4', w: 2172, alt: 'Chinese staff showing bathroom fittings and finishes to Gulf clients at a showroom in China' },
  { src: '/images/sourcing/hero-real-2', w: 2560, alt: 'A Chinese consultant showing new stone materials to Gulf clients at a showroom in China' },
];

export default function HeroSlides() {
  const [idx, setIdx] = useState(0);
  const count = SLIDES.length;

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % count), 5000);
    return () => clearInterval(t);
  }, [count]);

  return (
    <div className="absolute inset-0 -z-10">
      {SLIDES.map((s, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={s.src}
          src={`${s.src}.webp`}
          srcSet={`${s.src}-thumb.webp 600w, ${s.src}-medium.webp 1200w, ${s.src}.webp ${s.w}w`}
          sizes="100vw"
          alt={s.alt}
          loading={i === 0 ? 'eager' : 'lazy'}
          fetchPriority={i === 0 ? 'high' : 'low'}
          className={`absolute inset-0 h-full w-full object-cover object-[center_30%] transition-opacity duration-1000 ${
            i === idx ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}

      {/* 圆点指示（底部居中，可点） */}
      <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.src}
            type="button"
            onClick={() => setIdx(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-2 rounded-full transition-all ${
              i === idx ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
