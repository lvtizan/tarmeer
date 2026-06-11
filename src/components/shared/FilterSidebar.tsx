'use client';

import { X, SlidersHorizontal } from 'lucide-react';

interface FilterSidebarProps {
  hasActiveFilters: boolean;
  onClearAll: () => void;
  renderFilters: (compact: boolean) => React.ReactNode;
  filtersLabel?: string;
  clearLabel?: string;
}

export default function FilterSidebar({
  hasActiveFilters,
  onClearAll,
  renderFilters,
  filtersLabel = 'Filters',
  clearLabel = 'Clear filters',
}: FilterSidebarProps) {
  return (
    <>
      {/* Mobile trigger button — rendered inline, caller positions it */}
      <div className="lg:hidden mb-3">
        <MobileFilterTrigger
          hasActiveFilters={hasActiveFilters}
          label={filtersLabel}
          renderFilters={renderFilters}
          clearLabel={clearLabel}
          onClearAll={onClearAll}
        />
      </div>

      {/* Desktop sticky sidebar */}
      <aside className="w-60 flex-shrink-0 hidden lg:block">
        <div className="lg:sticky lg:top-24 max-h-[calc(100vh-7rem)] overflow-y-auto custom-scrollbar">
          <div className="bg-white rounded-[22px] border border-stone-100 p-5 shadow-sm shadow-stone-100/50 space-y-6">
            {renderFilters(false)}
          </div>
        </div>
      </aside>

      <style>{`
        .custom-scrollbar { scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: transparent; border-radius: 2px; }
        .custom-scrollbar:hover { scrollbar-width: thin; scrollbar-color: #d6d3d1 transparent; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: #d6d3d1; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb:hover { background: #a8a29e; }
      `}</style>
    </>
  );
}

function MobileFilterTrigger({
  hasActiveFilters,
  label,
  renderFilters,
  clearLabel,
  onClearAll,
}: {
  hasActiveFilters: boolean;
  label: string;
  renderFilters: (compact: boolean) => React.ReactNode;
  clearLabel: string;
  onClearAll: () => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-600 hover:bg-stone-50 transition"
      >
        <SlidersHorizontal className="w-4 h-4" />
        {label}
        {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-[#b8864a]" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-[85vw] max-w-sm bg-white overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-stone-200 sticky top-0 bg-white z-10">
              <h3 className="text-base font-semibold text-[#1c1917]">{label}</h3>
              <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-stone-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-6">{renderFilters(true)}</div>
            {hasActiveFilters && (
              <div className="sticky bottom-0 bg-white border-t border-stone-200 p-4">
                <button
                  onClick={() => { onClearAll(); setOpen(false); }}
                  className="w-full py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50"
                >
                  {clearLabel}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// React import needed for useState in nested component
import React from 'react';
