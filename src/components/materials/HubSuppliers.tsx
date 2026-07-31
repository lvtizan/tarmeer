'use client';

// 供应商浏览列表（/materials Hub 的 Suppliers tab 未搜索时展示"全部供应商"）。
// 数据源：公开去标识后的 /api/suppliers（company_name 已星号，故显示层用品类通用名 supplierPublicTitle，不渲染真名）。
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supplierPublicTitle } from '@/lib/supplierConstants';
import { resolveVariantUrl, resolveImageUrl } from '@/lib/imageUrl';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';
const FALLBACK = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80';

interface HubSupplier {
  id: number;
  slug: string;
  company_name: string;
  categories: unknown;
  cover_image_url: string | null;
  first_product_image?: string | null;
  logo_url: string | null;
}

export default function HubSuppliers({ country }: { country: string }) {
  const [list, setList] = useState<HubSupplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    setLoading(true);
    // 国家隔离：带 ?country= + x-country（对齐 SSR fetchInitialSuppliers）
    fetch(`${API_BASE}/suppliers?limit=200&country=${country}`, { headers: { 'x-country': country } })
      .then((r) => (r.ok ? r.json() : { suppliers: [] }))
      .then((d) => {
        if (on) {
          setList(Array.isArray(d.suppliers) ? d.suppliers : []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (on) {
          setList([]);
          setLoading(false);
        }
      });
    return () => {
      on = false;
    };
  }, [country]);

  if (loading) return <div className="py-16 text-center text-stone-400">Loading suppliers…</div>;
  if (list.length === 0) return <div className="py-16 text-center text-stone-400">No suppliers found.</div>;

  return (
    <div>
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-stone-500">
        All Suppliers <span className="font-normal normal-case text-stone-400">· {list.length}</span>
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {list.map((s) => {
          const primary = s.cover_image_url || s.first_product_image || null;
          const img = s.cover_image_url
            ? resolveVariantUrl(s.cover_image_url, 'thumb')
            : s.first_product_image
              ? resolveVariantUrl(s.first_product_image, 'thumb')
              : FALLBACK;
          return (
            <Link
              key={s.id}
              href={`/materials/suppliers/${s.slug}`}
              className="group flex overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:shadow-md"
            >
              <div className="h-28 w-36 flex-shrink-0 overflow-hidden bg-stone-100">
                <img
                  src={img}
                  onError={(e) => {
                    const fb = resolveImageUrl(primary);
                    e.currentTarget.src = fb && e.currentTarget.src !== fb ? fb : FALLBACK;
                  }}
                  alt={supplierPublicTitle(s.categories)}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-1 flex-col justify-center p-4">
                <h3 className="text-[15px] font-semibold text-[#1c1917] transition-colors group-hover:text-[#b8864a]">
                  {supplierPublicTitle(s.categories)}
                </h3>
                <span className="mt-1 text-xs font-medium text-[#b8864a]">View Profile →</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
