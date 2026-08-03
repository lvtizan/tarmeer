'use client';

// 上架统计报表「品类」列的可视化：
//  1) 每个品类名后配一张"该品类首个有图产品"的缩略图，hover 放大；
//  2) 供应商有 PDF 目录(supplier_catalogs)时，末尾追加红色 PDF 徽标(带数量)，hover 列出目录标题——
//     覆盖"只上传了 PDF 目录、没有产品图"的供应商(如 topspot)，让其在列表里也有可视线索。
// 数据源：admin 详情接口 GET /admin/suppliers/:id（products + catalogs），懒加载 + 模块级缓存，不改后端。
// 注意：档案 categories 与产品 category 可能错位(FA-16)，只有真有对应品类产品的才出图；PDF 徽标按整家(目录不分品类)。

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { adminApi } from '@/lib/adminApi';
import { resolveImageUrl } from '@/lib/imageUrl';
import { FileText } from 'lucide-react';

type Catalog = { title: string; file_url: string };
type SupplierMedia = { thumbs: Record<string, string>; catalogs: Catalog[] };

const cache = new Map<number, SupplierMedia>();
const inflight = new Map<number, Promise<SupplierMedia>>();

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

function loadMedia(supplierId: number): Promise<SupplierMedia> {
  const cached = cache.get(supplierId);
  if (cached) return Promise.resolve(cached);
  const running = inflight.get(supplierId);
  if (running) return running;
  const pr = (async () => {
    try {
      const data = await adminApi.request(`/suppliers/${supplierId}`);
      const thumbs: Record<string, string> = {};
      const products = Array.isArray(data?.products) ? (data.products as RawProduct[]) : [];
      for (const p of products) {
        const cat = (p.category || '').trim();
        if (!cat || thumbs[cat]) continue; // 每个品类只留首个有图
        const img = firstImage(p);
        if (img) thumbs[cat] = img;
      }
      const catalogs: Catalog[] = (Array.isArray(data?.catalogs) ? data.catalogs : [])
        .filter((c: { file_url?: string }) => c && typeof c.file_url === 'string' && c.file_url)
        .map((c: { title?: string; file_url: string }) => ({ title: (c.title || 'PDF').trim(), file_url: c.file_url }));
      const media: SupplierMedia = { thumbs, catalogs };
      cache.set(supplierId, media);
      return media;
    } catch {
      const empty: SupplierMedia = { thumbs: {}, catalogs: [] };
      cache.set(supplierId, empty); // 失败也缓存，避免反复打
      return empty;
    } finally {
      inflight.delete(supplierId);
    }
  })();
  inflight.set(supplierId, pr);
  return pr;
}

type Preview =
  | { kind: 'img'; url: string; left: number; top: number }
  | { kind: 'pdf'; titles: string[]; left: number; top: number };

interface Props {
  supplierId: number;
  categories: string[];
}

export default function SupplierCategoryThumbs({ supplierId, categories }: Props) {
  const [media, setMedia] = useState<SupplierMedia | null>(cache.get(supplierId) ?? null);
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    let on = true;
    loadMedia(supplierId).then((m) => { if (on) setMedia(m); });
    return () => { on = false; };
  }, [supplierId]);

  const anchor = (e: React.MouseEvent, boxW: number) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const w = typeof window !== 'undefined' ? window.innerWidth : 1920;
    return { left: Math.min(r.left, w - boxW), top: r.bottom + 6 };
  };
  const onLeave = () => setPreview(null);

  const catalogs = media?.catalogs ?? [];
  const hasContent = categories.length > 0 || catalogs.length > 0;
  if (!hasContent) return <span className="text-stone-400">—</span>;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {categories.map((cat) => {
        const img = media?.thumbs?.[cat];
        return (
          <span key={cat} className="inline-flex items-center gap-1.5">
            <span className="text-stone-600">{cat}</span>
            {img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveImageUrl(img)}
                alt=""
                onMouseEnter={(e) => setPreview({ kind: 'img', url: img, ...anchor(e, 304) })}
                onMouseLeave={onLeave}
                className="h-7 w-7 cursor-zoom-in rounded border border-stone-200 bg-stone-100 object-cover"
                loading="lazy"
              />
            )}
          </span>
        );
      })}

      {catalogs.length > 0 && (
        <span
          onMouseEnter={(e) => setPreview({ kind: 'pdf', titles: catalogs.map((c) => c.title), ...anchor(e, 260) })}
          onMouseLeave={onLeave}
          className="inline-flex cursor-default items-center gap-1 rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[12px] font-medium text-red-500"
          title={`${catalogs.length} PDF`}
        >
          <FileText className="h-3.5 w-3.5" /> PDF·{catalogs.length}
        </span>
      )}

      {preview && typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{ position: 'fixed', left: preview.left, top: preview.top, zIndex: 60 }}
            className="pointer-events-none rounded-xl border border-stone-200 bg-white shadow-2xl"
          >
            {preview.kind === 'img' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveImageUrl(preview.url)} alt="" className="h-72 w-72 rounded-lg bg-stone-50 object-contain p-1.5" />
            ) : (
              <div className="min-w-[220px] max-w-[320px] p-3">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-400">目录 {preview.titles.length}</div>
                <div className="flex flex-col gap-1">
                  {preview.titles.map((tt, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[13px] text-stone-700">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-red-400" />
                      <span className="truncate">{tt}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
