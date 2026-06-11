'use client';

import type { ReactNode } from 'react';

/**
 * Portal 快捷入口卡片 —— 图标徽章 + 标题 + 描述。可点击跳转。
 */
export default function QuickAction({
  icon,
  label,
  desc,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  desc: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3.5 text-left hover:border-[#b8864a]/40 hover:shadow-sm transition group"
    >
      <div className="w-8 h-8 rounded-lg bg-[#b8864a]/10 flex items-center justify-center text-[#b8864a] flex-shrink-0 group-hover:bg-[#b8864a]/20 transition">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-[#2c2c2c]">{label}</p>
        <p className="text-xs text-stone-400">{desc}</p>
      </div>
    </button>
  );
}
