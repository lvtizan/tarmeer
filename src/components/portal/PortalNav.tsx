'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface PortalNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** true = 精确匹配（仅当前路径完全相等才高亮，用于 dashboard 首页） */
  end?: boolean;
}

function isActive(href: string, pathname: string, end?: boolean): boolean {
  return end ? pathname === href : pathname.startsWith(href);
}

export function portalNavCls(active: boolean): string {
  return `flex items-center gap-3 px-4 py-3 rounded-full transition cursor-pointer ${
    active ? 'bg-[#b8864a]/10 text-[#2c2c2c] font-semibold' : 'text-stone-600 hover:bg-stone-50'
  }`;
}

export function portalMobileNavCls(active: boolean): string {
  return `flex flex-col items-center gap-0.5 px-3 py-2 min-h-[44px] justify-center rounded-lg text-[11px] ${
    active ? 'text-[#b8864a] font-semibold' : 'text-stone-500'
  }`;
}

/**
 * 桌面侧边栏导航 —— 圆角导航项列表。footer 用于注入门户特有内容（CRM/切换账号）。
 */
export function PortalDesktopNav({ items, footer }: { items: PortalNavItem[]; footer?: ReactNode }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={portalNavCls(isActive(it.href, pathname, it.end))}>
          <it.icon className="w-5 h-5" />
          <span className="text-sm font-medium">{it.label}</span>
        </Link>
      ))}
      {footer}
    </nav>
  );
}

/**
 * 移动端底部导航条。extra 用于注入门户特有项（CRM 等）。
 */
export function PortalMobileNav({ items, extra }: { items: PortalNavItem[]; extra?: ReactNode }) {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-stone-200 flex items-center justify-around px-2 py-2 safe-area-pb pb-[env(safe-area-inset-bottom)]">
      {items.map((it) => (
        <Link key={it.href} href={it.href} className={portalMobileNavCls(isActive(it.href, pathname, it.end))}>
          <it.icon className="w-5 h-5" />
          {it.label}
        </Link>
      ))}
      {extra}
    </nav>
  );
}
