'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { countryFromLang } from '@/lib/country';
import { useSiteLocale } from '@/contexts/SiteLocaleContext';
import { fetchMegaMenu, searchMaterials, type MegaCategory, type SearchProduct, type SearchSupplier } from '@/lib/materialMacros';
import { mergeProcurementFilters, PROCUREMENT_FILTER_KEYS, readProcurementFilters, type ProcurementFilters as Filters } from '@/lib/materialsProcurement';
import MegaMenuDirectory from './MegaMenuDirectory';
import HubSearchResults from './HubSearchResults';
import HubFeatured from './HubFeatured';
import MaterialsClient from './MaterialsClient';
import { trackMaterialEvent } from '@/lib/materialsAnalytics';
import ProcurementFilters from './ProcurementFilters';

export default function MaterialsHub() {
  const country = countryFromLang(useSiteLocale().lang).code;
  const searchParams = useSearchParams();
  useEffect(() => { trackMaterialEvent('materials_directory_view', country); }, [country]);
  const tab = searchParams.get('tab') === 'suppliers' ? 'suppliers' : 'products';
  const filters = readProcurementFilters(searchParams);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const categoryToggle = useRef<HTMLButtonElement>(null);
  const [q, setQ] = useState(filters.q || '');
  const [mega, setMega] = useState<MegaCategory[]>([]);
  const [megaLoading, setMegaLoading] = useState(true);
  const [search, setSearch] = useState<{ results: (SearchProduct | SearchSupplier)[]; total: number; loading: boolean }>({ results: [], total: 0, loading: false });
  const selectedCategory = mega.find(c => c.key === filters.category) || (filters.category ? { key: filters.category, label: filters.category.replace(/_/g, ' ') } as MegaCategory : null);
  useEffect(() => { setQ(filters.q || ''); }, [filters.q]);
  useEffect(() => { let active = true; setMega([]); setMegaLoading(true); fetchMegaMenu(country).then(value => { if (active) { setMega(value); setMegaLoading(false); } }); return () => { active = false; }; }, [country]);
  useEffect(() => { let active = true; setSearch({ results: [], total: 0, loading: tab === 'suppliers' && !!filters.q }); if (tab === 'suppliers' && filters.q) searchMaterials('suppliers', filters.q, country).then(value => { if (active) setSearch({ ...value, loading: false }); }); return () => { active = false; }; }, [tab, filters.q, country]);
  const update = (changes: Filters & { tab?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    const next = mergeProcurementFilters(filters, changes);
    for (const key of PROCUREMENT_FILTER_KEYS) { if (next[key]) params.set(key, next[key]); else params.delete(key); }
    if (changes.tab) params.set('tab', changes.tab);
    window.history.pushState(null, '', `/materials?${params}`);
  };
  const clear = () => { setQ(''); window.history.pushState(null, '', '/materials?tab=products'); };
  return <div className="min-h-screen bg-[#faf9f7]">
    <section className="relative overflow-hidden bg-[#221d19]">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(/images/materials/suppliers-hero.webp)' }} aria-hidden="true" />
      <div className="absolute inset-0 bg-black/75" aria-hidden="true" />
      <div className="relative mx-auto max-w-5xl px-4 py-5 text-center sm:px-6 lg:py-6">
        <div className="flex items-center justify-between gap-3"><h1 className="font-serif text-2xl font-bold text-white sm:text-3xl">Materials &amp; Suppliers</h1><Link href="/supplier/auth" className="shrink-0 text-xs text-white underline underline-offset-4">Supplier login</Link></div>
        <p className="mt-1 text-left text-xs text-white/90">Compare materials and request a quote through Tarmeer. <Link href="/mall" className="underline">Mall</Link> showcases curated collections for sourcing.</p>
        <div className="mt-3 flex items-center gap-5" aria-label="Directory view">{(['products', 'suppliers'] as const).map(value => <button key={value} onClick={() => update({ tab: value })} aria-pressed={tab === value} className={`border-b-2 pb-1 text-sm font-semibold capitalize ${tab === value ? 'border-[#d9ae75] text-white' : 'border-transparent text-white/80'}`}>{value}</button>)}</div>
        <form onSubmit={e => { e.preventDefault(); update({ q: q.trim() }); }} className="mt-3 flex items-center gap-2 rounded-xl bg-white p-1.5">
          <Search className="ml-2 h-4 w-4 shrink-0 text-stone-600" /><input aria-label={tab === 'products' ? 'Search product name, category or model' : 'Search supplier category or reference'} value={q} onChange={e => setQ(e.target.value)} placeholder={tab === 'products' ? 'Search product, category or model…' : 'Search category or supplier reference…'} className="min-w-0 flex-1 bg-white px-1 py-2 text-sm text-stone-900 outline-none" />
          <button className="rounded-lg bg-[#b8864a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a07640]">Search</button>
        </form>
      </div>
    </section>
    {tab === 'suppliers' && !filters.q ? <MaterialsClient initialSuppliers={[]} embedded /> : <div className="mx-auto grid w-full max-w-[1920px] gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[210px_minmax(0,1fr)] lg:px-8">
      <div className="min-w-0 lg:sticky lg:top-24 lg:z-20 lg:self-start">
        <button ref={categoryToggle} type="button" aria-expanded={mobileCategoriesOpen} aria-controls="materials-categories" onClick={() => setMobileCategoriesOpen(open => !open)} className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-left text-sm font-semibold text-stone-800 lg:hidden">Categories{selectedCategory ? ` · ${selectedCategory.label}` : ''} <span aria-hidden="true">{mobileCategoriesOpen ? '−' : '+'}</span></button>
        <div id="materials-categories" className={mobileCategoriesOpen ? 'mt-2 lg:mt-0' : 'hidden lg:block'}><MegaMenuDirectory categories={mega} loading={megaLoading} selectedKey={filters.category || null} onSelectCategory={category => { update({ category: category.key, spec: '', tab: 'products' }); setMobileCategoriesOpen(false); if (window.matchMedia('(max-width: 1023px)').matches) categoryToggle.current?.focus(); }} /></div>
      </div>
      <div className="min-w-0" id="products-results">{tab === 'suppliers' ? <HubSearchResults type="suppliers" results={search.results} total={search.total} query={filters.q || ''} loading={search.loading} /> : <>
        <ProcurementFilters filters={filters} onChange={update} onClear={clear} />
        <HubFeatured selectedCategory={selectedCategory} filters={filters} returnTo={`/materials?${searchParams}`} onShowAll={clear} />
      </>}</div>
    </div>}
  </div>;
}
