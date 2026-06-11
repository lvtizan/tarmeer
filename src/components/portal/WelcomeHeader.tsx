'use client';

import type { ReactNode } from 'react';

/**
 * Portal 页面顶部欢迎标题。标题 + 副标题，右侧可选 action 区（按钮、保存状态等）。
 */
export default function WelcomeHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-[#2c2c2c]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
