'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/**
 * 二级列表页（从数据分析 KPI 卡穿透下来的）顶部的返回链接。
 */
export default function BackToAnalytics() {
  return (
    <Link
      href="/admin"
      className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-[#B8864A] transition mb-3"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      返回数据分析
    </Link>
  );
}
