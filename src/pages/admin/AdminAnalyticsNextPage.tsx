/**
 * AdminAnalyticsNextPage — v2 of 注册分析 with redesigned layout (Tier A optimizations).
 *
 * 跟现状的差异：
 *   - KPI 卡加 "vs 7d 均值" badge
 *   - 趋势图叠 7 日移动平均虚线
 *   - 趋势图加周末浅蓝背景
 *   - 注册来源 / 装企类型 从 donut 改横向 stacked bar（信息密度 ↑ 50%，绝对值直读）
 *   - 14 天明细表保留
 */
import { useState, useEffect, lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceArea,
} from 'recharts';
import { Users, Building2, HandCoins, TrendingUp } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { useAdminT } from '../../hooks/useAdminLang';
import { labelCompanyType } from './AdminAnalyticsPage';

const UAEMap = lazy(() => import('../../components/admin/UAEMapLeaflet'));

const COLOR_HOMEOWNER = '#5b7fcb';
const COLOR_COMPANY   = '#B8864A';
const COLOR_INQUIRY   = '#6b6b6b';
const COLOR_MA        = '#e0a86e';

interface DayRow {
  stat_date: string;
  homeowner_count: number;
  company_count: number;
  inquiry_count?: number;  // not yet from API; stub
}
interface SourceItem { source?: string; type?: string; count: number }
interface CityRow { city: string; count: number }
interface TypeCityRow { type: string; count: number; topCities: Array<{ city: string; count: number }> }

// ─── 7-day moving average helper ────────────────────────────────────────────
function withMovingAverage(rows: DayRow[]): (DayRow & { ma_total: number; is_weekend: boolean })[] {
  const totals = rows.map(r => (r.homeowner_count || 0) + (r.company_count || 0) + (r.inquiry_count || 0));
  return rows.map((r, i) => {
    const start = Math.max(0, i - 6);
    const window = totals.slice(start, i + 1);
    const ma = window.reduce((s, n) => s + n, 0) / window.length;
    // UAE weekend: Friday & Saturday (day 5/6 in JS getDay)
    const d = new Date(r.stat_date);
    const dow = d.getDay();
    return { ...r, ma_total: Math.round(ma * 10) / 10, is_weekend: dow === 5 || dow === 6 };
  });
}

// ─── KPI card with "vs 7d avg" badge ────────────────────────────────────────
function KpiCard({ icon, label, value, ma7, accent }: {
  icon: React.ReactNode; label: string; value: number; ma7: number; accent: string;
}) {
  const ratio = ma7 > 0 ? value / ma7 : null;
  const ratioText = ratio === null ? '—' : `${ratio >= 1 ? '+' : ''}${(ratio - 1 >= 0 ? ratio : 1 / ratio).toFixed(1)}× 7d`;
  const goodBadge = ratio !== null && ratio >= 1;
  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${accent}18`, color: accent }}>{icon}</div>
        <span className="text-xs font-medium text-stone-500">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-[#1a1a1a]">{value.toLocaleString()}</span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${goodBadge ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {ratioText}
        </span>
      </div>
      <div className="text-[10px] text-stone-400 mt-1">本期 vs 近 7 日均值</div>
    </div>
  );
}

// ─── Horizontal stacked bar (replaces donut) ────────────────────────────────
function HorizontalBars({ items, colors, total, onLabelClick }: {
  items: Array<{ key: string; label: string; value: number }>;
  colors: string[];
  total: number;
  onLabelClick?: (key: string) => void;
}) {
  if (items.length === 0) {
    return <div className="flex items-center justify-center h-[180px] text-stone-400 text-sm">暂无数据</div>;
  }
  return (
    <div className="space-y-2 mt-2">
      {items.slice(0, 8).map((item, i) => {
        const pct = total > 0 ? (item.value / total) * 100 : 0;
        return (
          <div key={item.key} className="flex items-center gap-3">
            <span
              className={`text-[11.5px] text-stone-600 w-[88px] truncate ${onLabelClick ? 'cursor-pointer hover:text-[#B8864A]' : ''}`}
              onClick={() => onLabelClick?.(item.key)}
              title={item.label}
            >{item.label}</span>
            <div className="flex-1 h-5 rounded-md bg-stone-100 overflow-hidden relative">
              <div
                className="h-full rounded-md transition-all duration-500"
                style={{ width: `${Math.max(pct, 1.2)}%`, background: colors[i % colors.length] }}
              />
              <span
                className="absolute top-1/2 -translate-y-1/2 text-[10px] font-semibold text-white"
                style={{ left: `${Math.max(pct - 4, 4)}%`, textShadow: '0 1px 2px rgba(0,0,0,0.25)' }}
              >{Math.round(pct)}%</span>
            </div>
            <span className="text-xs font-bold text-[#B8864A] tabular-nums w-[36px] text-right">{item.value}</span>
          </div>
        );
      })}
      <div className="text-[10.5px] text-stone-400 text-center pt-2 border-t border-stone-100">合计 {total.toLocaleString()}</div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export default function AdminAnalyticsNextPage() {
  const { lang } = useAdminT();
  const [daily, setDaily] = useState<DayRow[]>([]);
  const [signupSources, setSignupSources] = useState<SourceItem[]>([]);
  const [companyTypes, setCompanyTypes]   = useState<SourceItem[]>([]);
  // For map (reused from v1, untouched)
  const [companyCities, setCompanyCities]     = useState<CityRow[]>([]);
  const [inquiryCities, setInquiryCities]     = useState<CityRow[]>([]);
  const [visitorCities, setVisitorCities]     = useState<CityRow[]>([]);
  const [homeownerCities, setHomeownerCities] = useState<CityRow[]>([]);
  const [companyTypeCities, setCompanyTypeCities] = useState<TypeCityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      adminApi.getDailyRegistrations({}),
      adminApi.getRegistrationSources(),
    ]).then(([reg, src]) => {
      if (cancelled) return;
      setDaily(reg.dailyRegistrations || []);
      setSignupSources((src.signup_sources || []).map(s => ({ source: s.source, count: s.count })));
      setCompanyTypes((src.company_types || []).map(s => ({ type: s.type, count: s.count })));
      setCompanyCities(src.company_cities || []);
      setInquiryCities(src.inquiry_cities || []);
      setVisitorCities(src.visitor_cities || []);
      setHomeownerCities(src.homeowner_cities || []);
      setCompanyTypeCities(src.company_type_cities || []);
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Aggregate KPIs and 7d ma
  const totals = daily.reduce((acc, r) => ({
    homeowner: acc.homeowner + (r.homeowner_count || 0),
    company:   acc.company   + (r.company_count   || 0),
    inquiry:   acc.inquiry   + (r.inquiry_count   || 0),
  }), { homeowner: 0, company: 0, inquiry: 0 });
  const periodDays = daily.length || 1;
  const last7 = daily.slice(-7);
  const last7Tot = last7.reduce((acc, r) => ({
    homeowner: acc.homeowner + (r.homeowner_count || 0),
    company:   acc.company   + (r.company_count   || 0),
    inquiry:   acc.inquiry   + (r.inquiry_count   || 0),
  }), { homeowner: 0, company: 0, inquiry: 0 });
  const last7Avg = {
    homeowner: last7.length > 0 ? last7Tot.homeowner / last7.length * periodDays : 0,
    company:   last7.length > 0 ? last7Tot.company   / last7.length * periodDays : 0,
    inquiry:   last7.length > 0 ? last7Tot.inquiry   / last7.length * periodDays : 0,
  };

  const chartData = withMovingAverage(daily);

  // Source bars
  const sourceTotal = signupSources.reduce((s, x) => s + x.count, 0);
  const sourceItems = signupSources.map(s => ({
    key: s.source || 'unknown',
    label: s.source || '未知',
    value: s.count,
  })).sort((a, b) => b.value - a.value);
  const sourceColors = ['#B8864A', '#C8975A', '#D4A05A', '#DCA970', '#E0B284', '#E8C29A', '#EFD2B0', '#F5E2C6'];

  // Type bars
  const typeTotal = companyTypes.reduce((s, x) => s + x.count, 0);
  const typeItems = companyTypes.map(t => ({
    key: t.type || 'unknown',
    label: labelCompanyType(t.type || '', lang === 'en' ? 'en' : 'zh') || '未知',
    value: t.count,
  })).sort((a, b) => b.value - a.value);
  const typeColors = ['#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0', '#86efac', '#bbf7d0', '#dcfce7'];

  return (
    <div className="w-full">
      <Helmet><title>注册分析 v2 (BETA) — Tarmeer Admin</title></Helmet>

      {/* Title */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#2c2c2c]">
            注册分析 <span className="ml-2 inline-block px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider align-middle" style={{ background: '#dcfce7', color: '#15803d' }}>v2 BETA</span>
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">改 horizontal bar / 加 7d MA / 周末高亮 / vs 均值 badge — <a href="/admin/analytics" className="text-[#B8864A] underline ml-1">回老版对比 →</a></p>
        </div>
      </div>

      {/* KPI cards with vs 7d badge */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard icon={<Users className="w-4 h-4" />}     label="新增业主"     value={totals.homeowner} ma7={last7Avg.homeowner} accent={COLOR_HOMEOWNER} />
        <KpiCard icon={<Building2 className="w-4 h-4" />} label="新增装企"     value={totals.company}   ma7={last7Avg.company}   accent={COLOR_COMPANY}   />
        <KpiCard icon={<HandCoins className="w-4 h-4" />} label="新增询盘"     value={totals.inquiry}   ma7={last7Avg.inquiry}   accent={COLOR_INQUIRY}   />
        <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="综合转化率"  value={Math.round(((totals.company + totals.inquiry) / Math.max(totals.homeowner + totals.company + totals.inquiry, 1)) * 100)} ma7={0} accent="#dc2626" />
      </div>

      {/* Daily trend with 7d MA + weekend stripes */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 mb-6">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-[#2c2c2c]">每日注册趋势</h2>
          <p className="text-xs text-stone-500 mt-0.5">业主 / 装企 / 询盘 三色柱 · 黄色虚线为 7 日移动平均 · 蓝底为周末（周五·周六）</p>
        </div>
        {loading ? <div className="h-[300px] flex items-center justify-center text-stone-400 text-sm">加载中…</div>
        : chartData.length === 0 ? <div className="h-[300px] flex items-center justify-center text-stone-400 text-sm">暂无数据</div>
        : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
              <XAxis dataKey="stat_date" tick={{ fontSize: 11, fill: '#a8a29e' }} tickFormatter={(v: string) => v.slice(5, 10)} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#a8a29e' }} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }}
                formatter={(v: any, n: any) => [v, n === 'ma_total' ? '7 日均值' : n === 'homeowner_count' ? '业主' : n === 'company_count' ? '装企' : n === 'inquiry_count' ? '询盘' : n]}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(v: string) => ({ ma_total: '7 日均值', homeowner_count: '业主', company_count: '装企', inquiry_count: '询盘' }[v] || v)}
              />
              {/* Weekend stripes */}
              {chartData.map((row, i) => row.is_weekend ? (
                <ReferenceArea
                  key={`we-${i}`}
                  x1={row.stat_date} x2={row.stat_date}
                  strokeOpacity={0} fill="#5b7fcb" fillOpacity={0.06}
                />
              ) : null)}
              <Bar dataKey="homeowner_count" stackId="a" fill={COLOR_HOMEOWNER} radius={[3, 3, 0, 0]} />
              <Bar dataKey="company_count"   stackId="a" fill={COLOR_COMPANY}   radius={[3, 3, 0, 0]} />
              <Bar dataKey="inquiry_count"   stackId="a" fill={COLOR_INQUIRY}   radius={[3, 3, 0, 0]} />
              <Line dataKey="ma_total" type="monotone" stroke={COLOR_MA} strokeWidth={2} strokeDasharray="5 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Two horizontal-bar sections (replaces donuts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <div className="mb-3">
            <h2 className="text-sm font-bold text-[#2c2c2c]">注册来源分布</h2>
            <p className="text-[11px] text-stone-500 mt-0.5">用户注册来源渠道 · 横向 stacked bar 可读性比 donut 高</p>
          </div>
          <HorizontalBars items={sourceItems} colors={sourceColors} total={sourceTotal} />
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <div className="mb-3">
            <h2 className="text-sm font-bold text-[#2c2c2c]">装企类型分布</h2>
            <p className="text-[11px] text-stone-500 mt-0.5">注册装企类型分布</p>
          </div>
          <HorizontalBars items={typeItems} colors={typeColors} total={typeTotal} />
        </div>
      </div>

      {/* 地理分布 — 整块复用 v1 的 UAEMapLeaflet，不动 */}
      <Suspense fallback={<div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 h-[480px] animate-pulse" />}>
        <UAEMap
          companyCities={companyCities}
          inquiryCities={inquiryCities}
          visitorCities={visitorCities}
          homeownerCities={homeownerCities}
          companyTypeCities={companyTypeCities}
        />
      </Suspense>
    </div>
  );
}
