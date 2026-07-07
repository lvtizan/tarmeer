'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

/**
 * 页面访问上报器：每次路由变化向 `POST /api/stats/visit` 打一次访问日志（写入 visitor_logs）。
 * 恢复迁 Next.js SSR 时丢失的访问统计——总访问量 KPI 与「每日流量趋势」都读 visitor_logs。
 * 用 usePathname（不用 useSearchParams，避免 Suspense 要求）+ window.location.search 取完整路径。
 * 排除 /admin 后台，避免管理员自己刷高数据。
 */
export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pathname && pathname.startsWith('/admin')) return;

    const body = JSON.stringify({
      pagePath: `${window.location.pathname}${window.location.search || ''}`,
      referrer: document.referrer || null,
    });

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(`${API_BASE}/stats/visit`, new Blob([body], { type: 'application/json' }));
        return;
      }
    } catch {
      /* fall through to fetch */
    }

    fetch(`${API_BASE}/stats/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
