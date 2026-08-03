'use client';

// 供应商上架统计：按日期筛选 → 扁平表格(一行一家)：上架日期 / 公司 / 中文名 / 品类 / 号 / 状态。
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import { useAdminCountry } from '@/contexts/AdminCountryContext';
import { useAdminT } from '@/hooks/useAdminLang';
import SupplierCategoryThumbs from '@/components/admin/SupplierCategoryThumbs';

interface Supplier {
  id: number; company_name: string; name_zh: string | null; categories: string[];
  status: string; is_published: number; listed_at: string;
  account_id: number | null; account_email: string | null; account_name: string | null;
}
interface Report { from: string; to: string; country: string; total: number; byDay: { date: string; count: number }[]; suppliers: Supplier[] }

function todayStr() { return new Date().toISOString().slice(0, 10); }
function validDate(v: string | null): string | null { return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; }

function StatusBadge({ status, published, zh }: { status: string; published: boolean; zh: boolean }) {
  const ok = status === 'approved' && published;
  const cls = ok ? 'bg-green-50 text-green-600' : status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-stone-100 text-stone-500';
  const label = ok ? (zh ? '已上架' : 'Live') : status === 'pending' ? (zh ? '待审' : 'Pending') : status === 'rejected' ? (zh ? '已拒' : 'Rejected') : (zh ? '未发布' : 'Unpublished');
  return <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

export default function SupplierReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { country } = useAdminCountry();
  const { lang } = useAdminT();
  const zh = lang === 'zh';
  // 从详情页返回时(?rf=&rt=)恢复上次筛选日期，否则默认今天
  const [from, setFrom] = useState(() => validDate(searchParams.get('rf')) || todayStr());
  const [to, setTo] = useState(() => validDate(searchParams.get('rt')) || todayStr());
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const r = await adminApi.getSupplierReport(from, to, country) as Report;
      setData(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load report');
    } finally { setLoading(false); }
  }, [from, to, country]);

  useEffect(() => { load(); }, [load]);

  const setToday = () => { const d = todayStr(); setFrom(d); setTo(d); };
  const setLastDays = (n: number) => {
    const t = new Date(); const f = new Date(); f.setDate(f.getDate() - (n - 1));
    setTo(t.toISOString().slice(0, 10)); setFrom(f.toISOString().slice(0, 10));
  };

  return (
    <div className="space-y-5">
      <button onClick={() => router.push('/admin/suppliers')} className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft className="w-4 h-4" />
        {zh ? '返回供应商列表' : 'Back to Suppliers'}
      </button>
      <div>
        <h1 className="text-xl font-bold text-[#1c1917]">{zh ? '供应商上架统计' : 'Supplier Listing Report'}</h1>
        <p className="mt-1 text-sm text-stone-500">
          {zh ? '按日期看当天上架了哪几家供应商、哪个号传的。上架时间＝发布/最后更新时间。' : 'Suppliers listed per date and which account uploaded them. Listing time = publish/last-updated time.'}
        </p>
      </div>

      {/* 日期筛选 */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-500">
          {zh ? '起始日期' : 'From'}
          <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
            className="h-10 rounded-lg border border-stone-200 bg-white px-3 text-sm text-[#1c1917] focus:border-[#b8864a] focus:outline-none" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-stone-500">
          {zh ? '结束日期' : 'To'}
          <input type="date" value={to} min={from} max={todayStr()} onChange={e => setTo(e.target.value)}
            className="h-10 rounded-lg border border-stone-200 bg-white px-3 text-sm text-[#1c1917] focus:border-[#b8864a] focus:outline-none" />
        </label>
        <button type="button" onClick={setToday} className="h-10 rounded-lg border border-stone-200 px-4 text-sm text-stone-600 hover:bg-stone-50">{zh ? '今天' : 'Today'}</button>
        <button type="button" onClick={() => setLastDays(7)} className="h-10 rounded-lg border border-stone-200 px-4 text-sm text-stone-600 hover:bg-stone-50">{zh ? '近7天' : '7 days'}</button>
        <button type="button" onClick={load} className="h-10 rounded-lg bg-[#b8864a] px-5 text-sm font-medium text-white transition hover:bg-[#a07640]">{zh ? '查询' : 'Search'}</button>
      </div>

      {err && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{err}</p>}

      {loading ? (
        <div className="py-16 text-center text-stone-400">{zh ? '加载中…' : 'Loading…'}</div>
      ) : data && (
        <>
          {/* 汇总 */}
          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#b8864a]">{data.total}</span>
              <span className="text-sm text-stone-500">
                {zh ? `家供应商上架（${data.from}${data.from !== data.to ? ' ~ ' + data.to : ''}）` : `suppliers listed (${data.from}${data.from !== data.to ? ' ~ ' + data.to : ''})`}
              </span>
            </div>
            {data.byDay.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.byDay.map(d => (
                  <span key={d.date} className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">{d.date}: <b>{d.count}</b></span>
                ))}
              </div>
            )}
          </div>

          {/* 扁平表格 */}
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
            {data.suppliers.length === 0 ? (
              <p className="py-16 text-center text-sm text-stone-400">{zh ? '该时间段没有上架记录。' : 'No listings in this period.'}</p>
            ) : (
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs font-semibold uppercase tracking-wider text-stone-500">
                    <th className="px-4 py-3">{zh ? '上架日期' : 'Listed'}</th>
                    <th className="px-4 py-3">{zh ? '供应商全称' : 'Company'}</th>
                    <th className="px-4 py-3">{zh ? '中文名' : 'Chinese Name'}</th>
                    <th className="px-4 py-3">{zh ? '品类' : 'Category'}</th>
                    <th className="px-4 py-3">{zh ? '号（账号）' : 'Account'}</th>
                    <th className="px-4 py-3">{zh ? '状态' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {data.suppliers.map(s => (
                    <tr key={s.id} className="hover:bg-stone-50/60">
                      <td className="whitespace-nowrap px-4 py-2.5 text-stone-500">{String(s.listed_at).slice(0, 10)}</td>
                      <td className="px-4 py-2.5">
                        <a href={`/admin/suppliers/${s.id}?from=report&rf=${encodeURIComponent(data.from)}&rt=${encodeURIComponent(data.to)}`} className="font-medium text-[#1c1917] hover:text-[#b8864a]">{s.company_name}</a>
                      </td>
                      <td className="px-4 py-2.5 text-stone-500">{s.name_zh || '—'}</td>
                      <td className="px-4 py-2.5 text-stone-500"><SupplierCategoryThumbs supplierId={s.id} categories={s.categories} /></td>
                      <td className="px-4 py-2.5">
                        {s.account_email
                          ? <span className="text-stone-600">{s.account_email}</span>
                          : <span className="text-stone-400">{zh ? '系统导入/无归属' : 'Unattributed'}</span>}
                      </td>
                      <td className="px-4 py-2.5"><StatusBadge status={s.status} published={!!s.is_published} zh={zh} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
