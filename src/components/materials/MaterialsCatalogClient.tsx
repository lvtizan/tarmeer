'use client';

// /materials 新材料策展区：Browse by Application 场景瓦片 + Curated New Materials 产品流
// 首屏产品由 server page SSR 预取（fetchMaterialProducts limit=24）；
// 客户端切换场景重新拉取——country 从 useSiteLocale().lang 经 countryFromLang 取（国家隔离铁律）。
// 契约见 docs/plans/china-materials-revamp-spec.md §1/§2.3。

import { useEffect, useRef, useState } from 'react';
import {
  Palette, LayoutGrid, Layers, Bath, Lamp, Armchair, TreePine, Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { APPLICATION_SCENES, fetchMaterialProducts, type PublicMaterialProduct } from '@/lib/materialsApi';
import { countryFromLang } from '@/lib/country';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import MaterialProductCard from './MaterialProductCard';

// 场景代表图标（slug 与 APPLICATION_SCENES 对齐；新增场景需补图标，缺省回退 Sparkles）
const SCENE_ICONS: Record<string, LucideIcon> = {
  'feature-wall': Palette,
  flooring: LayoutGrid,
  countertop: Layers,
  'kitchen-bath': Bath,
  lighting: Lamp,
  furniture: Armchair,
  'outdoor-garden': TreePine,
  decor: Sparkles,
};

interface MaterialsCatalogClientProps {
  initialProducts: PublicMaterialProduct[];
}

export default function MaterialsCatalogClient({ initialProducts }: MaterialsCatalogClientProps) {
  const { lang } = useSiteLocale();
  const country = countryFromLang(lang).code;
  const [scene, setScene] = useState('');
  const [products, setProducts] = useState<PublicMaterialProduct[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  // 首帧直接用 SSR 预取数据，不重复请求；之后场景/国家变化才重新拉取
  const skippedFirstFetch = useRef(false);

  useEffect(() => {
    if (!skippedFirstFetch.current) {
      skippedFirstFetch.current = true;
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchMaterialProducts({ limit: 24, ...(scene ? { scene } : {}) }, country)
      .then((page) => {
        if (!cancelled) setProducts(page.products);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scene, country]);

  const toggleScene = (slug: string) => setScene((prev) => (prev === slug ? '' : slug));
  const activeScene = APPLICATION_SCENES.find((s) => s.slug === scene);

  return (
    <section className="relative isolate bg-white border-b border-stone-200/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* ===== Browse by Application ===== */}
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-sm font-semibold text-[#b8864a] uppercase tracking-wider">
            Browse by Application
          </p>
          <h2 className="font-serif text-[24px] sm:text-[30px] text-[#1c1917] font-medium leading-tight mt-2">
            New Materials, Curated by Space
          </h2>
          <p className="text-stone-500 text-[15px] mt-2">
            The latest surfaces, fittings and finishes from China — organised the way designers
            actually work: by where they live in a project.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8">
          {APPLICATION_SCENES.map((s) => {
            const Icon = SCENE_ICONS[s.slug] ?? Sparkles;
            const selected = scene === s.slug;
            return (
              <button
                key={s.slug}
                type="button"
                onClick={() => toggleScene(s.slug)}
                aria-pressed={selected}
                className={`group text-left rounded-2xl border p-4 sm:p-5 transition-all duration-200 ${
                  selected
                    ? 'border-[#b8864a] bg-[#f5f0e8] shadow-sm'
                    : 'border-stone-200 bg-white hover:border-[#b8864a]/50 hover:shadow-sm'
                }`}
              >
                <span
                  className={`inline-flex w-10 h-10 rounded-xl items-center justify-center transition-colors ${
                    selected ? 'bg-[#b8864a] text-white' : 'bg-[#f5f0e8] text-[#b8864a] group-hover:bg-[#b8864a]/15'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </span>
                <p className="text-sm font-semibold text-[#1c1917] mt-3">{s.label}</p>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed line-clamp-2">{s.blurb}</p>
              </button>
            );
          })}
        </div>

        {/* ===== Curated New Materials ===== */}
        <div className="flex flex-wrap items-end justify-between gap-3 mt-14 mb-6">
          <div>
            <p className="text-sm font-semibold text-[#b8864a] uppercase tracking-wider">
              Curated New Materials
            </p>
            <h3 className="font-serif text-[20px] sm:text-[24px] text-[#1c1917] font-medium mt-1">
              {activeScene ? activeScene.label : 'Fresh from the Source'}
            </h3>
          </div>
          {scene && (
            <button
              type="button"
              onClick={() => setScene('')}
              className="text-sm text-[#b8864a] hover:underline font-medium"
            >
              View all materials
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="w-8 h-8 border-2 border-[#b8864a]/30 border-t-[#b8864a] rounded-full animate-spin" />
          </div>
        ) : products.length === 0 ? (
          <div className="py-14 text-center border border-dashed border-stone-200 rounded-2xl">
            <p className="text-stone-500 text-[15px]">
              {activeScene
                ? `No materials curated for ${activeScene.label} yet — new arrivals land every month.`
                : 'New materials are being curated — check back soon.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8">
            {products.map((p) => (
              <MaterialProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
