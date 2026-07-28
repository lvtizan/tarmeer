'use client';

// 供应商上架统计：日期筛选 → 当天上架几家 + 按「号」(supplier 账号) 统计哪个号传了哪几家。
import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/adminApi';
import { useAdminCountry } from '@/contexts/AdminCountryContext';
import { useAdminT } from '@/hooks/useAdminLang';

interface Company { id: number; company_name: string; name_zh: string | null; status: string; is_published: number; source: string | null; created_at: string }
interface Account { account_id: number | null; email: string | null; name: string | null; count: number; companies: Company[] }
interface Report { from: string; to: string; country: string; total: number; byDay: { date: string; count: number }[]; byAccount: Account[] }

function todayStr() { return new Date().toISOString().slice(0, 10); }

function StatusBadge({ status, published, zh }: { status: string; published: boolean; zh: boolean }) {
  const ok = status === 'approved' && published;
  const cls = ok ? 'bg-green-50 text-green-600' : status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-stone-100 text-stone-500';
  const label = ok ? (zh ? '已上架' : 'Live') : status === 'pending' ? (zh ? '待审' : 'Pending') : status === 'rejected' ? (zh ? '已拒' : 'Rejected') : (zh ? '未发布' : 'Unpublished');
  return <span className={`rounded px-1.5 py-0.5 font-medium ${cls}`}>{label}</span>;
}

export default function SupplierReportPage() {
  const { country } = useAdminCountry();
  const { lang } = useAdminT();
  const zh = lang === 'zh';
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1c1917]">{zh ? '供应商上架统计' : 'Supplier Listing Report'}</h1>
        <p className="mt-1 text-sm text-stone-500">
          {zh ? '按日期统计上架了几家供应商，以及哪个号（供应商账号）传了哪几家。上架时间按创建时间计。' : 'Suppliers listed per date and which account uploaded which companies. Listing time = creation time.'}
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

          {/* 按号统计 */}
          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-stone-700">{zh ? '按号统计（哪个号传了哪几家）' : 'By Account (who uploaded what)'}</h2>
            {data.byAccount.length === 0 ? (
              <p className="py-8 text-center text-sm text-stone-400">{zh ? '该时间段没有上架记录。' : 'No listings in this period.'}</p>
            ) : (
              <div className="space-y-4">
                {data.byAccount.map((a, i) => (
                  <div key={a.account_id ?? `null-${i}`} className="overflow-hidden rounded-lg border border-stone-100">
                    <div className="flex items-center justify-between bg-stone-50 px-4 py-2.5">
                      <span className="min-w-0 truncate text-sm font-medium text-[#1c1917]">
                        {a.email || (zh ? '系统导入 / 无归属' : 'System import / unattributed')}
                        {a.name && a.name !== a.email && <span className="ml-2 text-xs text-stone-400">{a.name}</span>}
                      </span>
                      <span className="ml-2 shrink-0 rounded-full bg-[#b8864a]/10 px-2.5 py-0.5 text-xs font-bold text-[#b8864a]">{a.count}{zh ? ' 家' : ''}</span>
                    </div>
                    <ul className="divide-y divide-stone-100">
                      {a.companies.map(c => (
                        <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                          <span className="min-w-0 truncate">
                            <a href={`/admin/suppliers/${c.id}`} className="text-[#1c1917] hover:text-[#b8864a]">{c.company_name}</a>
                            {c.name_zh && <span className="ml-2 text-xs text-stone-400">{c.name_zh}</span>}
                          </span>
                          <span className="flex shrink-0 items-center gap-2 text-xs">
                            <StatusBadge status={c.status} published={!!c.is_published} zh={zh} />
                            <span className="text-stone-400">{String(c.created_at).slice(0, 10)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
