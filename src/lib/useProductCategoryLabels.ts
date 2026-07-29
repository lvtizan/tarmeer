'use client';

// 产品分类 value→label 的共享映射(单一数据源 product_categories,经 /api/public/product-categories)。
// 所有买家/供应商界面显示 supplier_products.category 时都用它,避免直接渲染原始 value(如 NEW_MATERIALS)。
// 模块级缓存 + 单飞(inflight)去重,多个组件同时挂载只发一次请求。
import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

let cache: Record<string, string> | null = null;
let inflight: Promise<Record<string, string>> | null = null;

function loadLabels(): Promise<Record<string, string>> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = fetch(`${API_BASE}/public/product-categories`)
    .then((r) => r.json())
    .then((d: { groups?: { categories?: { value: string; label: string }[] }[]; ungrouped?: { value: string; label: string }[] }) => {
      const map: Record<string, string> = {};
      (d.groups || []).forEach((g) => (g.categories || []).forEach((c) => { map[c.value] = c.label; }));
      (d.ungrouped || []).forEach((c) => { map[c.value] = c.label; });
      cache = map;
      return map;
    })
    .catch(() => ({} as Record<string, string>))
    .finally(() => { inflight = null; });
  return inflight;
}

/** 返回一个把 category value 映射成 label 的函数；未加载完或找不到时回退原值。 */
export function useProductCategoryLabels(): (v?: string | null) => string {
  const [labels, setLabels] = useState<Record<string, string>>(cache || {});
  useEffect(() => {
    let alive = true;
    loadLabels().then((m) => { if (alive) setLabels(m); });
    return () => { alive = false; };
  }, []);
  return (v?: string | null) => (v ? labels[v] || v : '');
}
