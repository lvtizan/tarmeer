// AE 首页「新材料」入口区（2026-07-24 新增，置于 Clients 区上方）。
// 用真实地板产品卡（FloorCard，带放大镜+跳详情）摆 2 行，作为新材料入口；CTA 进新材料页/地板页。
// server component（FloorCard 为 client 岛）。
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PRODUCTS, type FloorProduct } from '@/lib/flooring';
import FloorCard from '@/components/flooring/FloorCard';

// 8 款有代表性（深/浅/黑/柚木/异形/圆形/铜镶嵌）——桌面 4 列 × 2 行
const FEATURED_CODES = ['5106', '5973', '5975', '5977', 'MY001-1', 'MY009-1', 'MY-7501', '5983'];
const FEATURED: FloorProduct[] = FEATURED_CODES.map(
  (code) => PRODUCTS.find((p) => p.code === code),
).filter((p): p is FloorProduct => Boolean(p));

export default function HomeNewMaterials() {
  return (
    <section className="bg-white py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[#b8864a]">New Materials</p>
          <h2 className="mt-2 font-serif text-[26px] leading-tight tracking-[-0.01em] [text-wrap:balance] text-[#1c1917] sm:text-[34px]">
            The newest materials from China
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-stone-500 sm:text-base">
            The latest art flooring, surfaces and finishes — see every design, then specify it in the UAE.
          </p>
        </div>

        {/* 2 行产品卡（桌面 4×2） */}
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {FEATURED.map((p) => (
            <FloorCard key={p.code} product={p} />
          ))}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/materials/new-materials"
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#b8864a] px-6 text-sm font-semibold text-white transition hover:bg-[#a07640]"
          >
            Explore New Materials <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/materials/flooring"
            className="inline-flex h-12 items-center gap-2 rounded-lg border border-stone-300 px-6 text-sm font-semibold text-[#1c1917] transition hover:border-[#b8864a] hover:text-[#b8864a]"
          >
            All 93 flooring designs
          </Link>
        </div>
      </div>
    </section>
  );
}
