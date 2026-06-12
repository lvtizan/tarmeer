'use client';

// 下拉复选（MultiSelectDropdown）— 全站多选原子组件
// 下拉面板 + 搜索 + 复选框；trigger 显示已选 chips（自适应换行，不溢出）。
// 选项多（如街区/服务类型）时用它，替代平铺 chip。
//
// 用法：
//   <MultiSelectDropdown options={['A','B']} value={sel} onChange={setSel}
//     placeholder="Select…" maxSelected={5} />
//   options 支持 string[] 或 {value,label}[]

import { useState, useRef, useEffect, useMemo } from 'react';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectDropdownProps {
  options: Array<MultiSelectOption | string>;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  /** 选满上限后禁止再选；不传则无限制 */
  maxSelected?: number;
  disabled?: boolean;
  error?: boolean;
  maxReachedHint?: string;
  noResultsText?: string;
  /** 选项少时可关闭搜索框 */
  searchable?: boolean;
}

export default function MultiSelectDropdown({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  maxSelected,
  disabled = false,
  error = false,
  maxReachedHint,
  noResultsText = 'No results',
  searchable = true,
}: MultiSelectDropdownProps) {
  const norm = useMemo<MultiSelectOption[]>(
    () => options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o)),
    [options]
  );
  const labelOf = (v: string) => norm.find((o) => o.value === v)?.label ?? v;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) { setSearch(''); return; }
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    return () => { document.removeEventListener('mousedown', handleOutside); clearTimeout(t); };
  }, [open]);

  const atMax = maxSelected != null && value.length >= maxSelected;
  const filtered = search
    ? norm.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : norm;

  function toggle(v: string) {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else if (!atMax) onChange([...value, v]);
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center justify-between gap-2 w-full min-h-[50px] py-2 px-4 rounded-2xl border bg-stone-50/80 text-left transition focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed ${
          error ? 'border-red-400 ring-2 ring-red-200/30' : 'border-stone-200'
        }`}
      >
        {value.length === 0 ? (
          <span className="text-[15px] text-stone-400 truncate">{placeholder}</span>
        ) : (
          <span className="flex flex-wrap gap-1.5 flex-1 min-w-0">
            {value.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-[#b8864a]/10 border border-[#b8864a]/20 text-[#b8864a] text-[13px] font-medium leading-none"
              >
                {labelOf(v)}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Remove"
                  onMouseDown={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== v)); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onChange(value.filter((x) => x !== v)); }
                  }}
                  className="flex items-center justify-center w-4 h-4 rounded-full cursor-pointer text-[#b8864a]/70 hover:text-white hover:bg-[#b8864a] transition leading-none"
                >
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </span>
              </span>
            ))}
          </span>
        )}
        <span className="flex items-center gap-1.5 flex-shrink-0 self-center">
          {value.length > 0 && (
            <span className="text-[11px] text-[#b8864a] font-medium whitespace-nowrap">
              {value.length}{maxSelected != null ? `/${maxSelected}` : ''}
            </span>
          )}
          <svg className={`w-4 h-4 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-stone-200 rounded-2xl shadow-lg overflow-hidden">
          {searchable && (
            <div className="px-3 py-2.5 border-b border-stone-100">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full h-9 pl-8 pr-3 text-sm border border-stone-200 rounded-xl bg-stone-50 focus:outline-none focus:border-[#b8864a] focus:bg-white transition"
                />
              </div>
              {atMax && maxReachedHint && (
                <p className="text-[11px] text-amber-600 mt-1.5 text-center">{maxReachedHint}</p>
              )}
            </div>
          )}
          <ul className="overflow-y-auto max-h-60">
            {filtered.length === 0 ? (
              <li className="px-5 py-3 text-sm text-stone-400 text-center">{noResultsText}</li>
            ) : (
              filtered.map((o) => {
                const isSelected = value.includes(o.value);
                const isDisabled = !isSelected && atMax;
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => toggle(o.value)}
                      className={`w-full flex items-center gap-3 px-5 py-3 text-[14px] text-left transition ${
                        isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-stone-50 cursor-pointer'
                      } ${isSelected ? 'text-[#b8864a] bg-[#b8864a]/5' : 'text-[#1c1917]'}`}
                    >
                      <span className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition ${
                        isSelected ? 'bg-[#b8864a] border-[#b8864a]' : 'border-stone-300 bg-white'
                      }`}>
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                          </svg>
                        )}
                      </span>
                      {o.label}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
