'use client';

// 后台供应商列表：hover 公司名 → 浮层预览该供应商前若干张产品图（类似前台供应商页 POPULAR PRODUCTS 效果）。
// 数据源：admin 详情接口 GET /admin/suppliers/:id（返回 { products }），懒加载 + 模块级缓存，不改后端。
// 表格容器 overflow-x-auto 会裁剪绝对定位浮层，故用 fixed + portal 定位。

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { adminApi } from '@/lib/adminApi';
import { resolveImageUrl } from '@/lib/imageUrl';
import { Package } from 'lucide-react';
import { useAdminT } from '@/hooks/useAdminLang';

const MAX_THUMBS = 6;
const HOVER_DELAY = 180;

// 供应商 id → 前若干张产品图 URL（空数组=已查过但无图），跨行/跨次 hover 复用，避免重复请求
const cache = new Map<number, string[]>();
const inflight = new Set<number>();

type RawProduct = { image_url?: string | null; image_urls?: unknown };

// 取产品首图：优先 image_url，兜底 image_urls（可能是数组或 JSON 字符串）
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

interface Props {
  supplierId: number;
  productCount: number;
  children: React.ReactNode;
}

export default function SupplierThumbsPreview({ supplierId, productCount, children }: Props) {
  const { t } = useAdminT();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [thumbs, setThumbs] = useState<string[] | null>(cache.get(supplierId) ?? null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const load = useCallback(async () => {
    const cached = cache.get(supplierId);
    if (cached) { setThumbs(cached); return; }
    if (inflight.has(supplierId)) return;
    inflight.add(supplierId);
    try {
      const data = await adminApi.request(`/suppliers/${supplierId}`);
      const imgs = (Array.isArray(data?.products) ? (data.products as RawProduct[]) : [])
        .map(firstImage)
        .filter((u): u is string => typeof u === 'string' && u.length > 0)
        .slice(0, MAX_THUMBS);
      cache.set(supplierId, imgs);
      setThumbs(imgs);
    } catch {
      cache.set(supplierId, []); // 失败也缓存空，避免反复打接口
      setThumbs([]);
    } finally {
      inflight.delete(supplierId);
    }
  }, [supplierId]);

  const onEnter = (e: React.MouseEvent) => {
    if (productCount <= 0) return; // 无产品不预览
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setPos({ left: rect.left, top: rect.bottom + 8 });
      setOpen(true);
      void load();
    }, HOVER_DELAY);
  };

  const onLeave = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <span onMouseEnter={onEnter} onMouseLeave={onLeave} className="inline-block">
      {children}
      {open && pos && productCount > 0 && typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{ position: 'fixed', left: pos.left, top: pos.top, zIndex: 60 }}
            className="pointer-events-none rounded-xl border border-stone-200 bg-white p-2.5 shadow-xl"
          >
            {thumbs === null ? (
              <div className="flex h-16 w-40 items-center justify-center text-xs text-stone-400">{t('Loading…', '加载中…')}</div>
            ) : thumbs.length === 0 ? (
              <div className="flex h-16 w-40 items-center justify-center gap-1.5 text-xs text-stone-400">
                <Package className="h-4 w-4" /> {t('No product images', '暂无产品图')}
              </div>
            ) : (
              <div className="flex gap-1.5">
                {thumbs.map((u, i) => (
                  <img
                    key={i}
                    src={resolveImageUrl(u)}
                    alt=""
                    className="h-16 w-16 rounded-lg bg-stone-100 object-cover"
                    loading="lazy"
                  />
                ))}
              </div>
            )}
          </div>,
          document.body,
        )}
    </span>
  );
}
