'use client';

// 材料搜索 Hub（/materials AE 主页）：顶部 Products/Suppliers tab + 搜索条；
// 左侧类目目录(hover mega 浮层)；右侧未搜索=精选(HubFeatured)，搜索后=结果(HubSearchResults)。
import { useState, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { countryFromLang } from '@/lib/country';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import {
  fetchMegaMenu,
  searchMaterials,
  type MegaCategory,
  type SearchProduct,
  type SearchSupplier,
} from '@/lib/materialMacros';
import MegaMenuDirectory from './MegaMenuDirectory';
import HubSearchResults from './HubSearchResults';
import HubFeatured from './HubFeatured';

type Tab = 'products' | 'suppliers';

export default function MaterialsHub() {
  const country = countryFromLang(useSiteLocale().lang).code;
  const [tab, setTab] = useState<Tab>('products');
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [results, setResults] = useState<(SearchProduct | SearchSupplier)[]>([]);
  const [total, setTotal] = useState(0);
  const [searching, setSearching] = useState(false);
  const [mega, setMega] = useState<MegaCategory[]>([]);
  const [megaLoading, setMegaLoading] = useState(true);

  useEffect(() => {
    let on = true;
    setMegaLoading(true);
    fetchMegaMenu(country).then((m) => {
      if (on) {
        setMega(m);
        setMegaLoading(false);
      }
    });
    return () => {
      on = false;
    };
  }, [country]);

  const runSearch = useCallback(
    (query: string, type: Tab) => {
      const term = query.trim();
      setSubmitted(term);
      if (!term) {
        setResults([]);
        setTotal(0);
        return;
      }
      setSearching(true);
      searchMaterials(type, term, country).then((r) => {
        setResults(r.results);
        setTotal(r.total);
        setSearching(false);
      });
    },
    [country],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(q, tab);
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    if (submitted) runSearch(submitted, t);
  };

  const isSearching = submitted.length > 0;

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Hero：大标题 + tab + 大搜索 */}
      <section className="bg-[#2c2c2c]">
        <div className="mx-auto max-w-4xl px-4 py-8 text-center sm:px-6 lg:py-12">
          <h1 className="font-serif text-3xl font-bold leading-tight text-white [text-wrap:balance] sm:text-4xl">
            Materials &amp; Suppliers
          </h1>

          <div className="mt-6 mb-5 flex items-center justify-center gap-6">
            {(
              [
                { key: 'products', label: 'Products' },
                { key: 'suppliers', label: 'Suppliers' },
              ] as { key: Tab; label: string }[]
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => switchTab(t.key)}
                className={`relative pb-1 text-lg font-semibold transition ${
                  tab === t.key ? 'text-white' : 'text-white/50 hover:text-white/80'
                }`}
              >
                {t.label}
                {tab === t.key && (
                  <span className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-[#b8864a]" />
                )}
              </button>
            ))}
          </div>
          <form onSubmit={onSubmit} className="flex items-center gap-2 rounded-2xl border border-stone-300 bg-white p-2 shadow-sm">
            <Search className="ml-2 h-5 w-5 shrink-0 text-stone-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tab === 'products' ? 'Search materials & products…' : 'Search suppliers by name or category…'}
              className="w-full bg-transparent px-1 py-2 text-[15px] text-[#1c1917] outline-none placeholder:text-stone-400"
            />
            <button
              type="submit"
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[#b8864a] px-6 text-sm font-semibold text-white transition hover:bg-[#a07640]"
            >
              <Search className="h-4 w-4" /> Search
            </button>
          </form>
        </div>
      </section>

      {/* 左目录 + 右内容 */}
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[300px_1fr] lg:py-10">
        <div className="relative lg:z-20">
          <MegaMenuDirectory categories={mega} loading={megaLoading} />
        </div>
        <div>
          {isSearching ? (
            <HubSearchResults type={tab} results={results} total={total} query={submitted} loading={searching} />
          ) : (
            <HubFeatured />
          )}
        </div>
      </div>
    </div>
  );
}
