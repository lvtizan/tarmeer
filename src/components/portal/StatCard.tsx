'use client';

import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Portal 统计卡片 —— 图标 + 数值 + 标签 + 提示。可点击跳转。
 */
export default function StatCard({
  icon,
  label,
  value,
  hint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  hint?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-stone-200 bg-white p-3 sm:p-4 text-left hover:shadow-md transition group"
    >
      <div className="flex items-center justify-between mb-1.5">
        {icon}
        <ArrowRight className="w-3.5 h-3.5 text-stone-300 group-hover:text-[#b8864a] transition" />
      </div>
      <p className="text-xl sm:text-2xl font-bold text-[#2c2c2c]">{value}</p>
      <p className="text-[11px] sm:text-xs font-medium text-stone-600 mt-0.5">{label}</p>
      {hint && <p className="text-[10px] sm:text-[11px] text-stone-400 mt-0.5 hidden sm:block">{hint}</p>}
    </button>
  );
}
