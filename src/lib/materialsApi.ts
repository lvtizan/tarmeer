// 新材料目录数据层 — 跨供应商产品 feed / 产品详情 / 应用场景字典
// 契约见 docs/plans/china-materials-revamp-spec.md（§2.3 / §3.1）
// SSR 与客户端解析方式对齐 publicApi.ts：country 同时走 query + x-country header。

const API_BASE =
  typeof window === 'undefined'
    // SSR 必须走内网直连后端(localhost:3002)，禁止用公网 NEXT_PUBLIC_API_URL 绕 nginx 回自己——
    // 否则 SSR 流量以服务器自身 IP 命中 publicReadLimiter(120/分)，一爆整站 SSR 429。对齐 publicApi.ts。
    ? (process.env.API_INTERNAL_URL?.trim() || 'http://localhost:3002/api')
    : (process.env.NEXT_PUBLIC_API_URL?.trim() || '/api');

/** 应用场景字典（slug 与后端 SCENE_CATEGORY_FALLBACK / partner-sync payload 共用，改动需三处同步） */
export const APPLICATION_SCENES: { slug: string; label: string; blurb: string }[] = [
  { slug: 'feature-wall', label: 'Feature Walls', blurb: 'Microcement, art paint & statement surfaces' },
  { slug: 'flooring', label: 'Flooring', blurb: 'Sintered stone, SPC & engineered floors' },
  { slug: 'countertop', label: 'Countertops & Surfaces', blurb: 'Sintered slabs & solid surfaces' },
  { slug: 'kitchen-bath', label: 'Kitchen & Bath', blurb: 'Cabinetry, sanitary ware & fittings' },
  { slug: 'lighting', label: 'Lighting', blurb: 'Architectural & decorative lighting' },
  { slug: 'furniture', label: 'Furniture', blurb: 'Curated designer furniture' },
  { slug: 'outdoor-garden', label: 'Outdoor & Garden', blurb: 'Landscape & exterior materials' },
  { slug: 'decor', label: 'Décor & Accents', blurb: 'Finishing touches that complete a space' },
];

export interface ProductSpec {
  label: string;
  value: string;
}

export interface PublicMaterialProduct {
  id: number;
  title: string | null;
  description: string | null;
  category: string | null;
  image_url: string;
  image_urls: string[];
  specs: ProductSpec[];
  certifications: string[];
  application_scenes: string[];
  price: number | null;
  price_unit: string | null;
  price_from: boolean;
  supplier_id: number;
  supplier_slug: string;
  supplier_name: string;
  supplier_origin: 'china' | 'dubai';
  supplier_logo: string | null;
}

export interface MaterialProductsPage {
  products: PublicMaterialProduct[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return (parsed ?? fallback) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function normalizeSpecs(value: unknown): ProductSpec[] {
  const raw = parseJsonColumn<unknown>(value, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      // 公开端点返回字符串形 "Label: Value"（如 "Material: SPC stone-plastic composite"）
      // → 拆成 {label,value}；无冒号则整串作 value。对象形保持原逻辑不变。
      if (typeof item === 'string') {
        const s = item.trim();
        if (!s) return null;
        const idx = s.indexOf(':');
        if (idx > 0) {
          const label = s.slice(0, idx).trim();
          const val = s.slice(idx + 1).trim();
          if (label && val) return { label, value: val };
        }
        return { label: '', value: s };
      }
      if (!item || typeof item !== 'object') return null;
      const label = String((item as Record<string, unknown>).label ?? '').trim();
      const val = String((item as Record<string, unknown>).value ?? '').trim();
      if (!label || !val) return null;
      return { label, value: val };
    })
    .filter(Boolean) as ProductSpec[];
}

function normalizeStringArray(value: unknown): string[] {
  const raw = parseJsonColumn<unknown>(value, []);
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item ?? '').trim()).filter(Boolean);
}

/**
 * 清洗合作方同步残留的出厂价/MOQ 片段（如 "Price: CN¥197.02-264.95 | MOQ: Min. Order: 2 pieces"）。
 * 业务口径：贸易价不对外显示（spec §6），价格只走 price 字段由业务决定何时展示。
 */
export function sanitizeDescription(value: unknown): string | null {
  if (value == null) return null;
  const cleaned = String(value)
    .replace(/price\s*:\s*[^|\n]*/gi, '')
    .replace(/moq\s*:\s*[^|\n]*/gi, '')
    .replace(/min\.?\s*order\s*:?\s*[^|\n]*/gi, '')
    .replace(/(?:CN¥|US\$|¥)\s*[\d.,]+(?:\s*[-–~]\s*[\d.,]+)?/g, '')
    .replace(/\s*\|\s*(?=\||$)/gm, '') // 清掉残留的空竖线分隔
    .replace(/^[\s|]+|[\s|]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned || null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function toMaterialProduct(row: any): PublicMaterialProduct {
  const imageUrls = normalizeStringArray(row.image_urls);
  return {
    id: Number(row.id),
    title: row.title ?? null,
    description: sanitizeDescription(row.description),
    category: row.category ?? null,
    image_url: String(row.image_url || imageUrls[0] || ''),
    image_urls: imageUrls.length ? imageUrls : row.image_url ? [String(row.image_url)] : [],
    specs: normalizeSpecs(row.specs),
    certifications: normalizeStringArray(row.certifications),
    application_scenes: normalizeStringArray(row.application_scenes),
    price: row.price != null && Number.isFinite(Number(row.price)) ? Number(row.price) : null,
    price_unit: row.price_unit ?? null,
    price_from: Boolean(row.price_from),
    supplier_id: Number(row.supplier_id),
    supplier_slug: String(row.supplier_slug || ''),
    supplier_name: String(row.supplier_name || ''),
    supplier_origin: row.supplier_origin === 'dubai' ? 'dubai' : 'china',
    supplier_logo: row.supplier_logo ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function request<T>(endpoint: string, country?: string): Promise<T> {
  let url = `${API_BASE}${endpoint}`;
  if (country) {
    url += (endpoint.includes('?') ? '&' : '?') + `country=${country}`;
  }
  const response = await fetch(url, country ? { headers: { 'x-country': country } } : undefined);
  if (!response.ok) {
    let message = 'Request failed';
    try {
      const body = await response.json();
      message = body.error || message;
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }
  return response.json();
}

export async function fetchMaterialProducts(
  params: { page?: number; limit?: number; category?: string; scene?: string; q?: string },
  country: string
): Promise<MaterialProductsPage> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.category) qs.set('category', params.category);
  if (params.scene) qs.set('scene', params.scene);
  if (params.q) qs.set('q', params.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  try {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const result = await request<{ products: any[]; pagination: MaterialProductsPage['pagination'] }>(
      `/suppliers/products/public${suffix}`,
      country
    );
    return {
      products: (result.products || []).map(toMaterialProduct),
      pagination: result.pagination || { page: 1, limit: 24, total: 0, totalPages: 0 },
    };
  } catch {
    return { products: [], pagination: { page: 1, limit: 24, total: 0, totalPages: 0 } };
  }
}

/** 供应商图册（PDF）。供应商上传即入库；材料页据此渲染电子书阅读器，无 catalog 则不展示。 */
export interface SupplierCatalog {
  id: number;
  title: string;
  file_url: string;
  file_size: number | null;
}

/** 拉某供应商的图册列表（slug 定位）。失败/无则返回空数组 → 阅读器模块自动隐藏。 */
export async function fetchSupplierCatalogs(slug: string, country: string): Promise<SupplierCatalog[]> {
  if (!slug) return [];
  try {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const result = await request<{ catalogs: any[] }>(
      `/suppliers/detail/${encodeURIComponent(slug)}/catalogs`,
      country
    );
    return (result.catalogs || [])
      .map((c) => ({
        id: Number(c.id),
        title: String(c.title || 'Catalog'),
        file_url: String(c.file_url || ''),
        file_size: c.file_size != null ? Number(c.file_size) : null,
      }))
      .filter((c) => c.file_url);
  } catch {
    return [];
  }
}

/** 产品详情。不存在/错国家返回 null（页面据此走 notFound()，禁止软 404）。 */
export async function fetchMaterialProduct(
  id: string | number,
  country: string
): Promise<{ product: PublicMaterialProduct; related: PublicMaterialProduct[] } | null> {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return null;
  try {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const result = await request<{ product: any; related: any[] }>(
      `/suppliers/products/public/${numericId}`,
      country
    );
    if (!result?.product) return null;
    return {
      product: toMaterialProduct(result.product),
      related: (result.related || []).map(toMaterialProduct),
    };
  } catch {
    return null;
  }
}
