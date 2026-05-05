import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * 二级列表页（从数据分析 KPI 卡穿透下来的）顶部的返回链接。
 * 统一组件 → 一处样式，多处复用，避免每个页面各自重写。
 */
export default function BackToAnalytics() {
  return (
    <Link
      to="/admin"
      className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-[#B8864A] transition mb-3"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      返回数据分析
    </Link>
  );
}
