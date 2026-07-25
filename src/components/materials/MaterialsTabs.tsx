'use client';

// /materials 顶部「By Material | By Company」tab 切换（用户定：进来默认按材料大类，可切按公司）。
// By Material = 材料大类浏览(ByMaterialBrowse)；By Company = 既有供应商目录(MaterialsClient)。
import { useState } from 'react';
import { LayoutGrid, Building2 } from 'lucide-react';
import MaterialsClient, { type Supplier } from './MaterialsClient';
import ByMaterialBrowse from './ByMaterialBrowse';

type Tab = 'material' | 'company';

export default function MaterialsTabs({
  initialSuppliers,
  showNewMaterialsEntry,
}: {
  initialSuppliers: Supplier[];
  showNewMaterialsEntry?: boolean;
}) {
  const [tab, setTab] = useState<Tab>('material');

  const TABS: { key: Tab; label: string; icon: typeof LayoutGrid }[] = [
    { key: 'material', label: 'By Material', icon: LayoutGrid },
    { key: 'company', label: 'By Company', icon: Building2 },
  ];

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Tab 切换条 */}
      <div className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">
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

      {tab === 'material' ? (
        <ByMaterialBrowse />
      ) : (
        <MaterialsClient initialSuppliers={initialSuppliers} showNewMaterialsEntry={showNewMaterialsEntry} />
      )}
    </div>
  );
}
