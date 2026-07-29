// By Material 大类浏览 —— 前端数据层（对接后端 /suppliers/macro-categories）。
// 大类 = 供应商标签归一后的 10 个干净材料类；Premium = 战略新材料主推线(暂无产品数据，占位引导询价)。
import { resolveImageUrl } from '@/lib/imageUrl';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

export type MacroCategory = {
  key: string;
  label: string;
  supplierCount: number;
  productCount: number;
  image: string | null;
};

export type MacroProduct = {
  id: number;
  title: string;
  image_url: string;
  image_urls: string[];
  supplier_slug: string | null;
  supplier_name: string | null;
};

// key → 英文标题（10 大类 + 4 Premium），供详情页 SSR 标题/校验用
export const MACRO_LABELS: Record<string, string> = {
  furniture: 'Furniture',
  lighting: 'Lighting',
  stone: 'Stone & Surfaces',
  flooring: 'Flooring',
  'kitchen-bath': 'Kitchen & Bath',
  'doors-windows': 'Doors & Windows',
  stairs: 'Stairs',
  plants: 'Plants & Landscaping',
  curtains: 'Curtains',
  decorative: 'Decorative Surfaces',
  wpc: 'WPC Board',
  'foamed-ceramic': 'Foamed Ceramic Tile',
  'art-paint': 'Art Paint',
  spc: 'SPC Flooring',
};

// 有专属精品页的大类 → 直接跳该页（不走通用 /materials/category/[key] 聚合页）
// flooring 指向我们扒图入库的 93 款 PARBRO 艺术地板目录
export const MACRO_DEDICATED_PAGE: Record<string, string> = {
  flooring: '/materials/flooring',
};

// 大类统一风格首图（Agnes 生成的编辑级室内图，覆盖供应商随机产品图，彰显专业）。
// 值为基名，组件按 `${base}-medium.webp` / `${base}-thumb.webp` 取。
export const MACRO_COVER: Record<string, string> = {
  furniture: '/images/materials/categories/furniture',
  lighting: '/images/materials/categories/lighting',
  stone: '/images/materials/categories/stone',
  flooring: '/images/materials/categories/flooring',
  'kitchen-bath': '/images/materials/categories/kitchen-bath',
  'doors-windows': '/images/materials/categories/doors-windows',
  stairs: '/images/materials/categories/stairs',
  plants: '/images/materials/categories/plants',
  curtains: '/images/materials/categories/curtains',
  decorative: '/images/materials/categories/decorative',
  spc: '/images/materials/categories/spc',
  wpc: '/images/materials/categories/wpc',
  'foamed-ceramic': '/images/materials/categories/foamed-ceramic',
  'art-paint': '/images/materials/categories/art-paint',
};

// 每个大类一句英文说明
export const MACRO_BLURB: Record<string, string> = {
  furniture: 'Living, bedroom, office & outdoor furniture',
  lighting: 'Architectural & decorative lighting',
  stone: 'Marble, sintered stone & surfaces',
  flooring: 'Parquet, wood & engineered flooring',
  'kitchen-bath': 'Cabinetry, sanitary ware & fittings',
  'doors-windows': 'Entry, interior doors & system windows',
  stairs: 'Staircases & railings',
  plants: 'Landscape & greenery',
  curtains: 'Curtains & soft furnishing',
  decorative: 'Wall coverings & decorative surfaces',
};

// 战略新材料主推线（优质：木塑板/发泡瓷砖/艺术漆）——暂无产品数据，作 Premium 占位引导询价
export const PREMIUM_MATERIALS: { key: string; label: string; blurb: string }[] = [
  { key: 'wpc', label: 'WPC Board', blurb: 'Wood-plastic composite wall & ceiling panels' },
  { key: 'foamed-ceramic', label: 'Foamed Ceramic Tile', blurb: 'Lightweight large-format foamed ceramic' },
  { key: 'art-paint', label: 'Art Paint', blurb: 'Decorative textured wall finishes' },
  { key: 'spc', label: 'SPC Flooring', blurb: 'Stone-plastic composite rigid flooring' },
];

export async function fetchMacroCategories(country: string): Promise<MacroCategory[]> {
  try {
    const res = await fetch(`${API_BASE}/suppliers/macro-categories?country=${country}`, {
      headers: { 'x-country': country },
    });
    if (!res.ok) return [];
    const d = await res.json();
    return (d.macros || []).map((m: MacroCategory) => ({
      ...m,
      image: m.image ? resolveImageUrl(m.image) : null,
    }));
  } catch {
    return [];
  }
}

export async function fetchMacroProducts(
  key: string,
  country: string,
  page = 1,
): Promise<{ label: string; products: MacroProduct[]; total: number }> {
  try {
    const res = await fetch(
      `${API_BASE}/suppliers/macro-categories/${encodeURIComponent(key)}/products?country=${country}&page=${page}&limit=24`,
      { headers: { 'x-country': country } },
    );
    if (!res.ok) return { label: '', products: [], total: 0 };
    const d = await res.json();
    return {
      label: d.label || '',
      products: (d.products || []).map((p: MacroProduct) => ({
        ...p,
        image_url: resolveImageUrl(p.image_url),
        image_urls: (p.image_urls || []).map(resolveImageUrl),
      })),
      total: d.pagination?.total || 0,
    };
  } catch {
    return { label: '', products: [], total: 0 };
  }
}

// ── 搜索 Hub 数据层（mega-menu 左目录/浮层 + 全文搜索）──
export type MegaSub = { tag: string; label: string; count: number };
export type MegaSupplier = { slug: string; name: string; image: string };
export type MegaCategory = {
  key: string;
  label: string;
  productCount: number;
  supplierCount: number;
  subcategories: MegaSub[];
  featuredSuppliers: MegaSupplier[];
};

export async function fetchMegaMenu(country: string): Promise<MegaCategory[]> {
  try {
    const res = await fetch(`${API_BASE}/suppliers/mega-menu?country=${country}`, {
      headers: { 'x-country': country },
    });
    if (!res.ok) return [];
    const d = await res.json();
    return (d.macros || []).map((m: MegaCategory) => ({
      ...m,
      featuredSuppliers: (m.featuredSuppliers || []).map((s) => ({ ...s, image: resolveImageUrl(s.image) })),
    }));
  } catch {
    return [];
  }
}

export type PopularProduct = {
  id: number;
  title: string;
  image_url: string;
  supplier_slug: string | null;
  supplier_name: string | null;
};

export async function fetchPopularProducts(country: string, limit = 16): Promise<PopularProduct[]> {
  try {
    const res = await fetch(`${API_BASE}/suppliers/popular-products?country=${country}&limit=${limit}`, {
      headers: { 'x-country': country },
    });
    if (!res.ok) return [];
    const d = await res.json();
    return (d.products || []).map((p: PopularProduct) => ({ ...p, image_url: resolveImageUrl(p.image_url) }));
  } catch {
    return [];
  }
}

export type SearchProduct = {
  id: number;
  title: string;
  image_url: string;
  category: string | null;
  supplier_slug: string | null;
  supplier_name: string | null;
};
export type SearchSupplier = {
  id: number;
  slug: string;
  company_name: string;
  origin: 'china' | 'dubai';
  cover_image_url: string | null;
  logo_url: string | null;
  first_product_image: string | null;
};

export async function searchMaterials(
  type: 'products' | 'suppliers',
  q: string,
  country: string,
  page = 1,
): Promise<{ type: 'products' | 'suppliers'; results: (SearchProduct | SearchSupplier)[]; total: number }> {
  try {
    const res = await fetch(
      `${API_BASE}/suppliers/search?type=${type}&q=${encodeURIComponent(q)}&country=${country}&page=${page}&limit=24`,
      { headers: { 'x-country': country } },
    );
    if (!res.ok) return { type, results: [], total: 0 };
    const d = await res.json();
    const results = (d.results || []).map((r: SearchProduct & SearchSupplier) =>
      type === 'products'
        ? { ...r, image_url: resolveImageUrl(r.image_url) }
        : {
            ...r,
            cover_image_url: r.cover_image_url ? resolveImageUrl(r.cover_image_url) : null,
            logo_url: r.logo_url ? resolveImageUrl(r.logo_url) : null,
            first_product_image: r.first_product_image ? resolveImageUrl(r.first_product_image) : null,
          },
    );
    return { type, results, total: d.pagination?.total || 0 };
  } catch {
    return { type, results: [], total: 0 };
  }
}
