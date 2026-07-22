'use client';

// 艺术地板产品网格 + 前端搜索（按型号/材种/工艺过滤）。点卡片进 L3 详情。
import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import type { FloorProduct } from '@/lib/flooring';
import FloorCard from './FloorCard';

export default function FlooringGrid({ products }: { products: FloorProduct[] }) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products;
    return products.filter(
      (p) =>
        p.code.toLowerCase().includes(s) ||
        p.wood.toLowerCase().includes(s) ||
        p.finish.toLowerCase().includes(s),
    );
  }, [q, products]);

  return (
    <div>
      <div className="mx-auto mt-8 flex max-w-md items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2.5 focus-within:border-[#b8864a]">
        <Search className="h-4 w-4 shrink-0 text-stone-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by model, wood or finish…"
          className="w-full bg-transparent text-sm text-[#1c1917] outline-none placeholder:text-stone-400"
        />
      </div>
      <p className="mt-3 text-center text-[13px] text-stone-400">{filtered.length} designs</p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((p) => (
          <FloorCard key={p.code} product={p} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="mt-12 text-center text-sm text-stone-400">No designs match “{q}”.</p>
      )}
    </div>
  );
}
