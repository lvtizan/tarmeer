'use client';

import type { LucideIcon } from 'lucide-react';
import { PORTAL_BANNER_GRADIENT, PORTAL_GOLD_BUTTON_GRADIENT } from './tokens';

/**
 * 深色渐变强调横幅。左侧图标徽章 + 标题/副文，右侧可选金色 CTA 按钮。
 * 用于 portal dashboard 顶部的引导/激励横幅。
 */
export default function HighlightBanner({
  icon: Icon,
  title,
  subtitle,
  ctaLabel,
  onCta,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: React.ReactNode;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: PORTAL_BANNER_GRADIENT }}>
      <div className="px-5 py-4 sm:px-6 sm:py-5 flex items-center gap-4">
        <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#b8864a]/20 flex items-center justify-center">
          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-[#d4a96a]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] sm:text-[16px] font-semibold text-white leading-snug">{title}</p>
          <p className="text-[13px] sm:text-[14px] text-white/55 mt-0.5">{subtitle}</p>
        </div>
        {ctaLabel && onCta && (
          <button
            onClick={onCta}
            className="flex-shrink-0 h-9 px-4 rounded-xl text-[13px] font-semibold text-[#1a1208] transition hover:opacity-90 whitespace-nowrap"
            style={{ background: PORTAL_GOLD_BUTTON_GRADIENT }}
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}
