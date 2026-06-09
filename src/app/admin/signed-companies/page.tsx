'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, RefreshCw } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import { formatAdminDateTime, ADMIN_TIME_CLS } from '@/lib/formatTime';
import BackToAnalytics from '@/components/admin/BackToAnalytics';
import { labelCompanyType } from '@/lib/companyTypeLabel';
import { useAdminCountry } from '@/contexts/AdminCountryContext';

type Row = Awaited<ReturnType<typeof adminApi.getSignedCompanies>>['companies'][number];

export default function AdminSignedCompaniesPage() {
  const router = useRouter();
  const { country } = useAdminCountry();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApi.getSignedCompanies(country);
      setRows(data.companies || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [country]);

  useEffect(() => { document.title = '已签约装企 — Tarmeer Admin'; }, []);
  useEffect(() => { load(); }, [load]);

  const goDetail = (r: Row) => {
    if (r.source === 'profile') router.push(`/admin/profile-companies/${r.id}`);
    else router.push(`/admin/companies/${r.id}`);
  };

  return (
    <div className="w-full">
      <BackToAnalytics />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#2c2c2c]">已签约装企</h1>
          <p className="text-xs text-stone-500 mt-0.5">已开启「已签约」开关的装企，共 {rows.length.toLocaleString()} 家</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-600"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> 刷新
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50 text-[11px] uppercase tracking-wider text-stone-500">
              <th className="text-left px-5 py-3 font-semibold">公司</th>
              <th className="text-left px-5 py-3 font-semibold">类型</th>
              <th className="text-left px-5 py-3 font-semibold">城市</th>
              <th className="text-right px-5 py-3 font-semibold">权重</th>
              <th className="text-left px-5 py-3 font-semibold">签约时间（注册）</th>
              <th className="text-center px-5 py-3 font-semibold">来源</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-stone-400 text-sm">加载中…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-stone-400 text-sm">暂无已签约装企</td></tr>
            ) : rows.map((r) => (
              <tr
                key={`${r.source}-${r.id}`}
                onClick={() => goDetail(r)}
                className="border-t border-stone-100 hover:bg-stone-50/60 cursor-pointer transition"
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    {r.logo_url ? (
                      <img src={r.logo_url} alt="" className="w-9 h-9 rounded-lg object-cover bg-stone-100 shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-[#B8864A]/10 text-[#B8864A] flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                    )}
                    <span className="font-medium text-[#1a1a1a]">{r.company_name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-stone-600">{labelCompanyType(r.company_type || '', 'zh') || '—'}</td>
                <td className="px-5 py-3 text-stone-600">{r.city || '—'}</td>
                <td className="px-5 py-3 text-right tabular-nums font-semibold text-[#B8864A]">{r.weight_score ?? 0}</td>
                <td className={`px-5 py-3 ${ADMIN_TIME_CLS}`}>{formatAdminDateTime(r.created_at)}</td>
                <td className="px-5 py-3 text-center">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${r.source === 'profile' ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>
                    {r.source === 'profile' ? '注册' : '目录'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
