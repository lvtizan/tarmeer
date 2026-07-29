'use client';

// L3 详情图廊：主图(锁 4:3 防跳动) + 缩略图；点主图或任一缩略图 → 全屏画廊弹层(共用 Lightbox)。
import { useState } from 'react';
import { ZoomIn } from 'lucide-react';
import type { FloorShot } from '@/lib/flooring';
import Lightbox from './Lightbox';

export default function FlooringGallery({ shots, alt }: { shots: FloorShot[]; alt: string }) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const cur = shots[active];

  const openAt = (i: number) => {
    setActive(i);
    setOpen(true);
  };

  return (
    <div>
      {/* 主图（可点击放大），锁 4:3 固定空间防止不同尺寸图切换跳动 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Enlarge ${alt}`}
        className="group relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-2xl border border-stone-200 bg-stone-100"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cur.src}
          alt={cur.alt}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur transition group-hover:bg-black/70">
          <ZoomIn className="h-3.5 w-3.5" /> Click to enlarge
        </span>
      </button>

      {/* 缩略图：点击=切主图 + 弹出画廊；每张右上角带放大镜 */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        {shots.map((s, i) => (
          <button
            key={s.kind}
            type="button"
            onClick={() => openAt(i)}
            aria-label={`Enlarge ${s.label}`}
            className={`group/thumb relative overflow-hidden rounded-xl border-2 bg-stone-100 transition ${
              i === active ? 'border-[#b8864a]' : 'border-transparent hover:border-stone-300'
            }`}
          >
            <div className="aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.src} alt={s.alt} loading="lazy" className="h-full w-full object-cover" />
            </div>
            <span className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition group-hover/thumb:bg-black/70">
              <ZoomIn className="h-3 w-3" />
            </span>
          </button>
        ))}
      </div>

      {open && (
        <Lightbox
          shots={shots}
          alt={alt}
          index={active}
          setIndex={setActive}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
