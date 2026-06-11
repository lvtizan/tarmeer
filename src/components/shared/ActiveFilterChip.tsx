'use client';

import { X } from 'lucide-react';

interface ActiveFilterChipProps {
  label: string;
  onRemove: () => void;
}

export default function ActiveFilterChip({ label, onRemove }: ActiveFilterChipProps) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 rounded-full text-sm text-[#1c1917]">
      {label}
      <button onClick={onRemove} className="hover:bg-stone-200 rounded-full p-0.5 transition">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
