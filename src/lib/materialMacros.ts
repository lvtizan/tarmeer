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
      })),
      total: d.pagination?.total || 0,
    };
  } catch {
    return { label: '', products: [], total: 0 };
  }
}
