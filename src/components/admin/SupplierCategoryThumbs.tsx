'use client';

// 上架统计报表「品类」列：每个品类名后配一张"该品类首个有图产品"的缩略图，hover 放大。
// 数据源：admin 详情接口 GET /admin/suppliers/:id 的 products（含 category / image_url），
// 按 category 取首个有图产品建映射，懒加载 + 模块级缓存，不改后端。
// 注意：档案 categories 与产品 category 可能错位(FA-16)，只有真有对应品类产品的才出图，空品类只显示名字。

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { adminApi } from '@/lib/adminApi';
import { resolveImageUrl } from '@/lib/imageUrl';

// supplierId → { category: 首个有图产品的 image_url }
const cache = new Map<number, Record<string, string>>();
const inflight = new Map<number, Promise<Record<string, string>>>();

type RawProduct = { category?: string | null; image_url?: string | null; image_urls?: unknown };

function firstImage(p: RawProduct): string {
  if (p.image_url) return p.image_url;
  const iu = p.image_urls;
  if (Array.isArray(iu)) return typeof iu[0] === 'string' ? iu[0] : '';
  if (typeof iu === 'string') {
    try {
      const a = JSON.parse(iu);
      return Array.isArray(a) && typeof a[0] === 'string' ? a[0] : '';
    } catch {
      return '';
    }
  }
  return '';
}

function loadMap(supplierId: number): Promise<Record<string, string>> {
  const cached = cache.get(supplierId);
  if (cached) return Promise.resolve(cached);
  const running = inflight.get(supplierId);
  if (running) return running;
  const pr = (async () => {
    try {
      const data = await adminApi.request(`/suppliers/${supplierId}`);
      const map: Record<string, string> = {};
      const products = Array.isArray(data?.products) ? (data.products as RawProduct[]) : [];
      for (const p of products) {
        const cat = (p.category || '').trim();
        if (!cat || map[cat]) continue; // 每个品类只留首个有图
        const img = firstImage(p);
        if (img) map[cat] = img;
      }
      cache.set(supplierId, map);
      return map;
    } catch {
      cache.set(supplierId, {}); // 失败也缓存空，避免反复打
      return {};
    } finally {
      inflight.delete(supplierId);
    }
  })();
  inflight.set(supplierId, pr);
  return pr;
}

interface Props {
  supplierId: number;
  categories: string[];
}

export default function SupplierCategoryThumbs({ supplierId, categories }: Props) {
  const [map, setMap] = useState<Record<string, string> | null>(cache.get(supplierId) ?? null);
  const [hover, setHover] = useState<{ url: string; left: number; top: number } | null>(null);

  useEffect(() => {
    let on = true;
    loadMap(supplierId).then((m) => { if (on) setMap(m); });
    return () => { on = false; };
  }, [supplierId]);

  if (!categories.length) return <span className="text-stone-400">—</span>;

  const onEnter = (e: React.MouseEvent, url: string) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const w = typeof window !== 'undefined' ? window.innerWidth : 1920;
    setHover({ url, left: Math.min(r.left, w - 304), top: r.bottom + 6 }); // clamp 防右溢出（大图 288+边距）
  };
  const onLeave = () => setHover(null);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {categories.map((cat) => {
        const img = map?.[cat];
        return (
          <span key={cat} className="inline-flex items-center gap-1.5">
            <span className="text-stone-600">{cat}</span>
            {img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveImageUrl(img)}
                alt=""
                onMouseEnter={(e) => onEnter(e, img)}
                onMouseLeave={onLeave}
                className="h-7 w-7 cursor-zoom-in rounded border border-stone-200 bg-stone-100 object-cover"
                loading="lazy"
              />
            )}
          </span>
        );
      })}
      {hover && typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{ position: 'fixed', left: hover.left, top: hover.top, zIndex: 60 }}
            className="pointer-events-none rounded-xl border border-stone-200 bg-white p-1.5 shadow-2xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolveImageUrl(hover.url)} alt="" className="h-72 w-72 rounded-lg bg-stone-50 object-contain" />
          </div>,
          document.body,
        )}
    </div>
  );
}
