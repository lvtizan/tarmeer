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
  creator_id: number | null; creator_name: string | null; creator_email: string | null;
}
interface CreatorStat { creator_id: number | null; creator_name: string | null; creator_email: string | null; count: number }
interface Report { from: string; to: string; country: string; total: number; byDay: { date: string; count: number }[]; byCreator: CreatorStat[]; suppliers: Supplier[] }

const DAILY_LISTING_CAPACITY = 5;

function todayStr() { return new Date().toISOString().slice(0, 10); }
function validDate(v: string | null): string | null { return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null; }

function datesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const last = new Date(`${to}T00:00:00`);
  while (cursor <= last) {
    dates.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function DailyListingBarChart({ byDay, from, to, zh }: Pick<Report, 'byDay' | 'from' | 'to'> & { zh: boolean }) {
  const counts = new Map(byDay.map(day => [day.date, Number(day.count) || 0]));
  const days = datesInRange(from, to);
  if (!days.length) return null;

  return (
    <div className="mt-4 overflow-x-auto pb-1" aria-label={zh ? '每日供应商上架数量柱状图' : 'Daily supplier listing bar chart'}>
      <div className="relative min-w-[720px] rounded-lg bg-stone-50/70 px-3 pt-4" style={{ minWidth: Math.max(720, days.length * 27) }}>
        <div className="pointer-events-none absolute inset-x-3 top-4 h-[104px] border-b border-dashed border-stone-200" />
        <div className="pointer-events-none absolute inset-x-3 top-[51px] border-t border-dashed border-stone-200/80" />
        <div className="pointer-events-none absolute inset-x-3 top-[77px] border-t border-dashed border-stone-200/80" />
        <div className="grid h-[151px] items-end gap-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(22px, 1fr))` }}>
          {days.map(date => {
            const count = counts.get(date) || 0;
            const height = `${Math.min(count, DAILY_LISTING_CAPACITY) / DAILY_LISTING_CAPACITY * 100}%`;
            return (
              <div key={date} className="relative flex h-full min-w-0 flex-col items-center justify-end pb-[35px]">
                {count > 0 && (
                  <div className="relative w-3 min-h-[3px] rounded-t-sm bg-[#c38b48] shadow-[0_2px_4px_rgba(184,134,74,0.2)]" style={{ height }} title={`${date}: ${count}`}>
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-semibold leading-none text-[#8d602e]">{count}</span>
                  </div>
                )}
                <span className="absolute bottom-[8px] whitespace-nowrap text-[9px] leading-none text-stone-400" style={{ transform: 'rotate(-62deg)' }}>
                  {date.slice(5).replace('-', '/')}
                </span>
              </div>
            );
          })}
        </div>
        <div className="absolute right-3 top-2 text-[10px] text-stone-400">{zh ? `满柱 ${DAILY_LISTING_CAPACITY} 家` : `Full bar ${DAILY_LISTING_CAPACITY}`}</div>
      </div>
    </div>
  );
}

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
  const [creatorSort, setCreatorSort] = useState<'asc' | 'desc' | null>(null);

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
  const creatorLabel = (creator: Pick<Supplier, 'creator_id' | 'creator_name' | 'creator_email'>) => {
    if (creator.creator_id === -1) return zh ? '蓝鲸' : 'Blue Whale';
    if (creator.creator_name && creator.creator_email) return `${creator.creator_name} (${creator.creator_email})`;
    if (creator.creator_id) return zh ? '创建者已删除' : 'Deleted administrator';
    return creator.creator_name || creator.creator_email || (zh ? '未记录/系统导入' : 'Unattributed / import');
  };
  const displaySuppliers = data ? [...data.suppliers].sort((a, b) => {
    if (!creatorSort) return 0;
    const diff = creatorLabel(a).localeCompare(creatorLabel(b), undefined, { numeric: true });
    return creatorSort === 'asc' ? diff : -diff;
  }) : [];

  return (
    <div className="space-y-5">
      <button onClick={() => router.push('/admin/suppliers')} className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft className="w-4 h-4" />
        {zh ? '返回供应商列表' : 'Back to Suppliers'}
      </button>
      <div>
        <h1 className="text-xl font-bold text-[#1c1917]">{zh ? '供应商上架统计' : 'Supplier Listing Report'}</h1>
        <p className="mt-1 text-sm text-stone-500">
          {zh ? '按日期查看供应商首个商品上传、账号及创建者；汇总为每位创建者开始上传的供应商数。统计时间＝首个商品上传时间。' : 'View first product uploads by date, account, and creator. The summary counts suppliers that started uploading per creator.'}
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
        <button type="button" onClick={() => setLastDays(30)} className="h-10 rounded-lg border border-stone-200 px-4 text-sm text-stone-600 hover:bg-stone-50">{zh ? '近1个月' : '30 days'}</button>
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
            <DailyListingBarChart byDay={data.byDay} from={data.from} to={data.to} zh={zh} />
            {data.byCreator.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.byCreator.map(creator => (
                  <span key={creator.creator_id ?? 'unattributed'} className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800">
                    {creatorLabel(creator)}: <b>{creator.count}</b>{zh ? ' 家' : ''}
                  </span>
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
                    <th
                      className="cursor-pointer select-none px-4 py-3 hover:text-stone-800"
                      title={zh ? '点击按创建者归并统计' : 'Click to group by creator'}
                      onClick={() => setCreatorSort(value => value === 'asc' ? 'desc' : 'asc')}
                    >
                      {zh ? '创建者' : 'Creator'} {creatorSort === 'asc' ? '↑' : creatorSort === 'desc' ? '↓' : <span className="text-stone-300">↕</span>}
                    </th>
                    <th className="px-4 py-3">{zh ? '状态' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {displaySuppliers.map(s => (
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
                      <td className="whitespace-nowrap px-4 py-2.5 text-stone-600">{creatorLabel(s)}</td>
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
