'use client';

import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Globe, Eye, RefreshCw } from 'lucide-react';
import { adminApi, type VisitorRecord } from '@/lib/adminApi';
import { formatAdminDateTime, ADMIN_TIME_CLS } from '@/lib/formatTime';
import BackToAnalytics from '@/components/admin/BackToAnalytics';
import AdminPagination from '@/components/admin/AdminPagination';

const PAGE_SIZE = 50;

export default function AdminVisitorsPage() {
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [overview, setOverview] = useState<{ totalVisits: number; uniqueIpCount: number } | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterPublic, setFilterPublic] = useState<'all' | 'public' | 'internal'>('all');

  const load = async () => {
    setLoading(true);
    try {
      const [vRes, oRes] = await Promise.all([
        adminApi.getVisitors({ page, limit: PAGE_SIZE }),
        adminApi.getVisitorOverview(),
      ]);
      setVisitors(vRes.visitors || []);
      setPages(vRes.pagination?.pages || 1);
      setTotal(vRes.pagination?.total || 0);
      setOverview(oRes);
    } catch {
      setVisitors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page]);

  const filtered = visitors.filter(v => {
    if (filterPublic === 'public') return v.isPublicIp;
    if (filterPublic === 'internal') return !v.isPublicIp;
    return true;
  });

  return (
    <div className="w-full">
      <Helmet><title>访客列表 — Tarmeer Admin</title></Helmet>

      <BackToAnalytics />

      {/* Title bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#2c2c2c]">访客列表</h1>
          <p className="text-xs text-stone-500 mt-0.5">visitor_logs 按 IP 聚合 · 共 {total.toLocaleString()} 条独立访客</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-600"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> 刷新
        </button>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#5b7fcb18', color: '#5b7fcb' }}>
              <Globe className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-stone-500">独立访客（公网 IP）</span>
          </div>
          <div className="text-2xl font-bold text-[#1a1a1a]">{(overview?.uniqueIpCount ?? 0).toLocaleString()}</div>
          <div className="text-[10px] text-stone-400 mt-1">visitor_logs · 累计</div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#2c6e4918', color: '#2c6e49' }}>
              <Eye className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-stone-500">总访问次数</span>
          </div>
          <div className="text-2xl font-bold text-[#1a1a1a]">{(overview?.totalVisits ?? 0).toLocaleString()}</div>
          <div className="text-[10px] text-stone-400 mt-1">所有 IP · 包含重复访问</div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
          <div className="text-xs font-medium text-stone-500 mb-2">人均访问次数</div>
          <div className="text-2xl font-bold text-[#1a1a1a]">
            {(overview && overview.uniqueIpCount > 0)
              ? (overview.totalVisits / overview.uniqueIpCount).toFixed(1)
              : '—'}
          </div>
          <div className="text-[10px] text-stone-400 mt-1">总访问 / 独立访客</div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 mb-4">
        {([
          { key: 'all',      label: '全部' },
          { key: 'public',   label: '仅公网' },
          { key: 'internal', label: '仅内网' },
        ] as const).map(c => (
          <button
            key={c.key}
            onClick={() => setFilterPublic(c.key)}
            className={`px-3 py-1.5 text-xs rounded-full transition ${
              filterPublic === c.key
                ? 'bg-[#B8864A] text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {c.label}
          </button>
        ))}
        <span className="text-[11px] text-stone-400 ml-auto">第 {page} / {pages} 页</span>
      </div>

      {/* Visitor table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50 text-[11px] uppercase tracking-wider text-stone-500">
              <th className="text-left px-5 py-3 font-semibold">IP</th>
              <th className="text-left px-5 py-3 font-semibold">位置</th>
              <th className="text-right px-5 py-3 font-semibold">访问次数</th>
              <th className="text-left px-5 py-3 font-semibold">最近访问</th>
              <th className="text-center px-5 py-3 font-semibold">类型</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12 text-stone-400 text-sm">加载中…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-stone-400 text-sm">暂无数据</td></tr>
            ) : filtered.map((v, i) => (
              <tr key={`${v.ip}-${i}`} className="border-t border-stone-100 hover:bg-stone-50/60">
                <td className="px-5 py-3 font-mono text-[12.5px] text-[#1a1a1a]">{v.ip}</td>
                <td className="px-5 py-3 text-[12.5px] text-stone-600">{v.location || '—'}</td>
                <td className="px-5 py-3 text-right tabular-nums font-semibold text-[#B8864A]">{v.visitCount}</td>
                <td className={`px-5 py-3 ${ADMIN_TIME_CLS}`}>{formatAdminDateTime(v.lastVisitedAt)}</td>
                <td className="px-5 py-3 text-center">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${v.isPublicIp ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                    {v.isPublicIp ? '公网' : '内网'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminPagination
        page={page}
        totalPages={pages}
        onPageChange={setPage}
        labels={['上一页', '下一页']}
        formatInfo={(p, tp) => `第 ${p} / ${tp} 页`}
      />
    </div>
  );
}
