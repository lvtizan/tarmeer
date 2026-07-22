'use client';

// 艺术地板产品卡（网格 + 详情页「同系列推荐」共用）。
// 卡片主体链到详情页；右上角放大镜按钮 → 就地弹出该产品的全屏画廊（不跳转）。
import { useState } from 'react';
import Link from 'next/link';
import { ZoomIn } from 'lucide-react';
import type { FloorProduct } from '@/lib/flooring';
import { BRAND, imgOf, shotsOf, altOf } from '@/lib/flooring';
import Lightbox from './Lightbox';

export default function FloorCard({ product: p }: { product: FloorProduct }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const shots = shotsOf(p);
  const alt = altOf(p, 'board');
  const galleryAlt = `${BRAND.nameEn} ${p.code} ${p.wood} art flooring from China`;

  return (
    <>
      <div className="group relative overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-[#b8864a]/40 hover:shadow-sm">
        <Link href={`/materials/flooring/${p.series}/${p.code}`} className="block">
          <div className="aspect-square overflow-hidden bg-stone-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgOf(p, 'board')}
              alt={alt}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          </div>
          <div className="p-3">
            <p className="font-serif text-sm font-bold text-[#1c1917]">{p.code}</p>
            <p className="mt-0.5 truncate text-[12px] text-stone-500">{p.wood}</p>
          </div>
        </Link>

        {/* 放大镜：就地弹出画廊，不跳转 */}
        <button
          type="button"
          onClick={() => {
            setIndex(0);
            setOpen(true);
          }}
          aria-label={`Enlarge ${p.code}`}
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/70"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
      </div>

      {open && (
        <Lightbox shots={shots} alt={galleryAlt} index={index} setIndex={setIndex} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
