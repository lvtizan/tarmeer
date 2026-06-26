'use client';

// 带搜索的筛选清单（全局组件）— 一个 title + 搜索框 + 可过滤的单选清单。
// 选项多时（> searchThreshold）自动显示搜索框。AE/VN 通用（文案由 props 传入）。
// 复用于专家/公司/材料等任意筛选侧栏。

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import FilterOption from './FilterOption';

interface SearchableFilterListProps {
  title: string;
  options: string[];
  /** 当前选中值（''=未选）。单选，点击已选项即取消（由 onToggle 处理） */
  selected: string;
  onToggle: (value: string) => void;
  searchPlaceholder?: string;
  /** 选项数超过该值才显示搜索框（默认 6） */
  searchThreshold?: number;
  /** 有搜索框时清单滚动区高度 */
  maxHeightClass?: string;
  noResultsText?: string;
  /** 显示标签映射（值=筛选 key 不变，仅改展示，如 VN 翻译）。默认恒等。搜索同时匹配值和译文。 */
  labelFor?: (value: string) => string;
}

export default function SearchableFilterList({
  title,
  options,
  selected,
  onToggle,
  searchPlaceholder = 'Search…',
  searchThreshold = 6,
  maxHeightClass = 'max-h-72',
  noResultsText = 'No results',
  labelFor = (v) => v,
}: SearchableFilterListProps) {
  const [q, setQ] = useState('');
  if (options.length === 0) return null;

  const showSearch = options.length > searchThreshold;
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.toLowerCase().includes(s) || labelFor(o).toLowerCase().includes(s)) : options;
  }, [q, options, labelFor]);

  return (
    <div>
      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">{title}</p>
      {showSearch && (
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" strokeWidth={2.5} />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-9 pl-8 pr-3 text-sm border border-stone-200 rounded-lg bg-white focus:outline-none focus:border-[#b8864a] focus:ring-2 focus:ring-[#b8864a]/15 transition"
          />
        </div>
      )}
      <div className={`space-y-0.5 ${showSearch ? `${maxHeightClass} overflow-y-auto pr-1` : ''}`}>
        {filtered.length === 0 ? (
          <p className="px-4 py-2 text-xs text-stone-400">{noResultsText}</p>
        ) : (
          filtered.map((opt) => (
            <FilterOption key={opt} selected={selected === opt} onClick={() => onToggle(opt)}>
              {labelFor(opt)}
            </FilterOption>
          ))
        )}
      </div>
    </div>
  );
}
