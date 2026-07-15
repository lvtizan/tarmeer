// 采购/担保页共用 Hero — 服务端组件（无 'use client'）。
// 图片契约：/images/sourcing/{base}.webp + -blur/-thumb/-medium 四档变体
//（见 docs/plans/china-materials-revamp-spec.md §4，图片由图片 agent 产出）。
// 渐进加载：容器背景铺 -blur 档（无 JS 占位），<img srcSet> 按视口取档。
// isolate：防止 hero 内 z-index 泄漏盖住导航下拉（AGENTS.md 已知坑）。

import type { ReactNode } from 'react';

const IMAGE_DIR = '/images/sourcing';

interface SourcingHeroProps {
  /** 图片基名，如 'hero-sourcing'（不含目录与扩展名） */
  imageBase: string;
  imageAlt: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** CTA 按钮行 */
  children?: ReactNode;
}

export default function SourcingHero({ imageBase, imageAlt, eyebrow, title, subtitle, children }: SourcingHeroProps) {
  return (
    <section className="relative isolate overflow-hidden bg-[#1c1917]">
      {/* blur 档兜底背景：img 未加载完成时的即时占位 */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url('${IMAGE_DIR}/${imageBase}-blur.webp')` }}
      />
      <img
        src={`${IMAGE_DIR}/${imageBase}-medium.webp`}
        srcSet={`${IMAGE_DIR}/${imageBase}-thumb.webp 600w, ${IMAGE_DIR}/${imageBase}-medium.webp 1200w, ${IMAGE_DIR}/${imageBase}.webp 2000w`}
        sizes="100vw"
        alt={imageAlt}
        loading="eager"
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* 自下而上渐变，保证标题可读且不压住画面主体 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1c1917]/90 via-[#1c1917]/45 to-[#1c1917]/15"
      />
      <div className="relative mx-auto flex min-h-[420px] max-w-7xl flex-col justify-end px-4 pb-14 pt-28 sm:min-h-[520px] sm:px-6 sm:pb-20">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#d8b98c]">{eyebrow}</p>
        <h1 className="max-w-3xl font-serif text-3xl font-bold leading-tight text-white sm:text-5xl sm:leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">{subtitle}</p>
        )}
        {children && <div className="mt-8 flex flex-wrap items-center gap-3">{children}</div>}
      </div>
    </section>
  );
}
