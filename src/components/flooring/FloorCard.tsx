// 艺术地板产品卡（网格 + 详情页「同系列推荐」共用，消除重复）。
import Link from 'next/link';
import type { FloorProduct } from '@/lib/flooring';
import { BRAND, imgOf } from '@/lib/flooring';

export default function FloorCard({ product: p }: { product: FloorProduct }) {
  return (
    <Link
      href={`/materials/flooring/${p.series}/${p.code}`}
      className="group overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-[#b8864a]/40 hover:shadow-sm"
    >
      <div className="aspect-square overflow-hidden bg-stone-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgOf(p, 'board')}
          alt={`${BRAND.nameEn} ${p.code} ${p.wood}`}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="p-3">
        <p className="font-serif text-sm font-bold text-[#1c1917]">{p.code}</p>
        <p className="mt-0.5 truncate text-[12px] text-stone-500">{p.wood}</p>
      </div>
    </Link>
  );
}
