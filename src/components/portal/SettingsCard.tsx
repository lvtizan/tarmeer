'use client';

import type { ReactNode } from 'react';

/**
 * Portal 设置页区块 —— 大写灰字小标题 + 行列表。装企/业主设置页共用。
 */
export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-[0_20px_60px_rgba(28,18,8,0.05)]">
      <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/**
 * 设置页单行 —— 图标 + 标题/描述 + 右侧操作按钮。
 */
export function SettingsRow({
  icon,
  title,
  desc,
  actionLabel,
  onAction,
  disabled,
  divider,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  /** 是否在底部显示分隔线（多行时除最后一行外设为 true） */
  divider?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-3 ${divider ? 'border-b border-stone-100' : ''}`}>
      <div className="flex items-center gap-3">
        <span className="text-stone-400">{icon}</span>
        <div>
          <p className="text-sm font-medium text-[#2c2c2c]">{title}</p>
          <p className="text-xs text-stone-400">{desc}</p>
        </div>
      </div>
      <button
        onClick={onAction}
        disabled={disabled}
        className="text-xs font-semibold text-[#b8864a] hover:underline disabled:opacity-50"
      >
        {actionLabel}
      </button>
    </div>
  );
}
