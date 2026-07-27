'use client';

// By Material 大类浏览网格：进来即材料大类；点大类 → /materials/category/[key] 产品展示 → 穿透公司。
// Premium 战略新材料(WPC/发泡瓷砖/艺术漆/SPC)暂无产品数据，占位引导询价。
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { countryFromLang } from '@/lib/country';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import {
  fetchMacroCategories,
  MACRO_BLURB,
  MACRO_COVER,
  MACRO_DEDICATED_PAGE,
  type MacroCategory,
} from '@/lib/materialMacros';

export default function ByMaterialBrowse() {
  const country = countryFromLang(useSiteLocale().lang).code;
  const [macros, setMacros] = useState<MacroCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    setLoading(true);
    fetchMacroCategories(country).then((m) => {
      if (on) {
        setMacros(m);
        setLoading(false);
      }
    });
    return () => {
      on = false;
    };
  }, [country]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
      {/* 材料大类 */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#b8864a]">Browse by Material</h2>
        {!loading && <span className="text-[13px] text-stone-400">{macros.length} categories</span>}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#b8864a]/30 border-t-[#b8864a]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {macros.map((m) => (
            <Link
              key={m.key}
              href={MACRO_DEDICATED_PAGE[m.key] ?? `/materials/category/${m.key}`}
              className="group relative block aspect-[4/3] overflow-hidden rounded-2xl bg-stone-200 isolate"
            >
              {MACRO_COVER[m.key] ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`${MACRO_COVER[m.key]}-medium.webp`}
                  srcSet={`${MACRO_COVER[m.key]}-thumb.webp 600w, ${MACRO_COVER[m.key]}-medium.webp 1200w`}
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  alt={`${m.label} materials from China, available in the UAE through Tarmeer`}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              ) : m.image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={m.image}
                  alt={`${m.label} materials from China, available in the UAE through Tarmeer`}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-stone-200 to-stone-300" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <h3 className="font-serif text-xl text-white sm:text-2xl">{m.label}</h3>
                <p className="mt-0.5 text-[12px] text-white/70">{MACRO_BLURB[m.key] ?? ''}</p>
                <p className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-white/90">
                  {m.productCount} products · {m.supplierCount} suppliers
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
