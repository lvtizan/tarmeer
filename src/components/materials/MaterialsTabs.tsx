'use client';

// /materials 顶部「By Material | By Company」tab 切换（用户定：进来默认按材料大类，可切按公司）。
// By Material = 材料大类浏览(ByMaterialBrowse)；By Company = 既有供应商目录(MaterialsClient)。
import { useState } from 'react';
import { LayoutGrid, Building2, Search, X } from 'lucide-react';
import MaterialsClient, { type Supplier } from './MaterialsClient';
import ByMaterialBrowse from './ByMaterialBrowse';
import MaterialSearchResults from './MaterialSearchResults';

type Tab = 'material' | 'company';

export default function MaterialsTabs({
  initialSuppliers,
  showNewMaterialsEntry,
}: {
  initialSuppliers: Supplier[];
  showNewMaterialsEntry?: boolean;
}) {
  const [tab, setTab] = useState<Tab>('material');
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;

  const TABS: { key: Tab; label: string; icon: typeof LayoutGrid }[] = [
    { key: 'material', label: 'By Material', icon: LayoutGrid },
    { key: 'company', label: 'By Company', icon: Building2 },
  ];

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* 顶部搜索条 */}
      <div className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <div className="relative">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 1,000,000+ products, materials & brands"
              className="w-full rounded-full border border-stone-300 bg-stone-50 py-3.5 pl-5 pr-12 text-sm text-[#1c1917] transition placeholder:text-stone-400 focus:border-[#b8864a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#b8864a]/15"
            />
            {searching ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-4 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 hover:text-[#1c1917]"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <Search className="pointer-events-none absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
            )}
          </div>
        </div>
      </div>

      {searching && <MaterialSearchResults query={query} />}

      {/* Tab 切换条 */}
      <div className={`sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur${searching ? ' hidden' : ''}`}>
        <div className="mx-auto flex max-w-6xl gap-1 px-4 sm:px-6">
          {TABS.map((t) => {
            const active = tab === t.key;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`relative flex items-center gap-2 px-4 py-4 text-sm font-semibold transition ${
                  active ? 'text-[#b8864a]' : 'text-stone-500 hover:text-[#1c1917]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
                {active && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#b8864a]" />}
              </button>
            );
          })}
        </div>
      </div>

      {!searching &&
        (tab === 'material' ? (
          <ByMaterialBrowse />
        ) : (
          <MaterialsClient initialSuppliers={initialSuppliers} showNewMaterialsEntry={showNewMaterialsEntry} />
        ))}
    </div>
  );
}
