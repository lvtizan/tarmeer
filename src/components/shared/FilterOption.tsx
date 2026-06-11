'use client';

import { Check } from 'lucide-react';

interface FilterOptionProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  compact?: boolean;
}

export default function FilterOption({ selected, onClick, children, compact }: FilterOptionProps) {
  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-200 ${
          selected
            ? 'bg-[#b8864a] border-[#b8864a] text-white'
            : 'border-stone-200 text-stone-600 bg-white hover:bg-stone-50'
        }`}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-all duration-200 ${
        selected ? 'bg-[#f5f0e8] border border-[#d4c4a8] text-[#1c1917]' : 'text-stone-500 hover:bg-stone-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
          selected ? 'border-[#b8860b] bg-white' : 'border-stone-300'
        }`}>
          {selected && <Check className="w-3 h-3 text-[#b8860b]" strokeWidth={3} />}
        </div>
        {children}
      </div>
    </button>
  );
}
