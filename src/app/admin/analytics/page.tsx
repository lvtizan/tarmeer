'use client';

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
import { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceArea,
} from 'recharts';
import { Users, Building2, HandCoins, TrendingUp, Globe, Eye, BadgeCheck, Package } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import { useAdminT } from '@/hooks/useAdminLang';
import { labelCompanyType } from '@/lib/companyTypeLabel';
import { useAdminCountry } from '@/contexts/AdminCountryContext';

const UAEMap = dynamic(() => import('@/components/admin/UAEMapLeaflet'), { ssr: false });

const COLOR_HOMEOWNER = '#5b7fcb';
const COLOR_COMPANY   = '#B8864A';
const COLOR_INQUIRY   = '#6b6b6b';

interface DayRow {
  date: string;
  new_homeowners: number;
  new_companies: number;
  new_inquiries: number;
  new_suppliers?: number;
}
interface SourceItem { source?: string; type?: string; count: number }
interface CityRow { city: string; count: number }
interface TypeCityRow { type: string; count: number; topCities: Array<{ city: string; count: number }> }
interface CompanyVisitorRow {
  page_path: string;
  company_name: string;
  slug: string;
  unique_visitors: number;
  total_views: number;
  cities: Array<{ city: string; visitors: number }>;
}

function withTotalsAndMA(rows: DayRow[]): (DayRow & { total: number; ma_total: number; is_weekend: boolean })[] {
  const totals = rows.map(r => (r.new_homeowners || 0) + (r.new_companies || 0) + (r.new_inquiries || 0));
  return rows.map((r, i) => {
    const start = Math.max(0, i - 6);
    const window = totals.slice(start, i + 1);
    const ma = window.reduce((s, n) => s + n, 0) / window.length;
    const d = new Date(r.date);
    const dow = d.getDay();
    return {
      ...r,
      total: totals[i],
      ma_total: Math.round(ma * 10) / 10,
      is_weekend: dow === 5 || dow === 6,
    };
  });
}

function KpiCard({ icon, label, value, ma7, sub, accent, valueOverride, href, week7Count }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  ma7?: number | null;
  sub?: React.ReactNode;
  accent: string;
  valueOverride?: string;
  href?: string;
  week7Count?: number;
}) {
  let diffPct: number | null = null;
  if (typeof ma7 === 'number' && ma7 > 0) {
    diffPct = Math.round(((value - ma7) / ma7) * 100);
  }
  const showBadge = diffPct !== null;
  const isUp = (diffPct ?? 0) >= 0;
  const baseClass = 'bg-white rounded-2xl border border-stone-200 shadow-sm p-5 transition relative';
  const linkClass = href ? ' cursor-pointer hover:border-[#B8864A]/40 hover:shadow-md group' : '';
  const Wrapper: any = href ? 'a' : 'div';
  const wrapperProps = href ? { href, className: baseClass + linkClass } : { className: baseClass };
  return (
    <Wrapper {...wrapperProps}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${accent}18`, color: accent }}>{icon}</div>
        <span className="text-xs font-medium text-stone-500">{label}</span>
        {href && (
          <span className="ml-auto text-stone-400 group-hover:text-[#B8864A] text-[13px] transition" aria-hidden>→</span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-[#1a1a1a]">{valueOverride ?? value.toLocaleString()}</span>
        {showBadge && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5 ${isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
            <span>{isUp ? '↑' : '↓'}</span>
            <span>{Math.abs(diffPct as number)}%</span>
          </span>
        )}
      </div>
      <div className="text-[10px] text-stone-400 mt-1 flex items-center gap-2 flex-wrap">
        <span>{sub ?? '相比近 7 日均值'}</span>
        {typeof week7Count === 'number' && (
          <span className="text-stone-500 font-medium" style={{ color: accent }}>近7天 · {week7Count}</span>
        )}
      </div>
    </Wrapper>
  );
}

interface LBItem {
  key: string;
  primary: string;
  secondary?: string;
  href?: string;
  value: number;
}
const MULTI_PALETTE: string[] = [
  '#B8864A', '#7C95B3', '#7B9266', '#9C7194',
  '#A47158', '#5F7A75', '#A8845D', '#8F687A',
];
const BAR_ALPHA = 'D9';
const TINT_ALPHA = '1F';

function LeaderboardBars({ items, labelWidth = 148, max = 10, colors }: {
  items: LBItem[];
  labelWidth?: number;
  max?: number;
  colors?: 'gold' | 'multi';
}) {
  if (items.length === 0) {
    return <div className="flex items-center justify-center h-[180px] text-stone-400 text-sm">暂无数据</div>;
  }
  const maxV = Math.max(...items.map(it => it.value), 1);
  const useMulti = colors === 'multi';
  return (
    <div className="flex-1 flex flex-col justify-around mt-2 gap-1">
      {items.slice(0, max).map((item, i) => {
        const barPct = Math.max(2.5, (item.value / maxV) * 75);
        const baseColor = useMulti ? MULTI_PALETTE[i % MULTI_PALETTE.length] : '#B8864A';
        const barBg = `${baseColor}${BAR_ALPHA}`;
        return (
          <div key={item.key} className="flex items-center gap-3" style={{ minHeight: 38 }}>
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold tabular-nums shrink-0"
              style={useMulti
                ? { background: `${baseColor}${TINT_ALPHA}`, color: baseColor }
                : { background: '#f5f5f4', color: '#78716c' }}
            >{i + 1}</span>
            <div style={{ width: labelWidth }} className="shrink-0 flex flex-col min-w-0">
              {item.href ? (
                <a href={item.href} target="_blank" rel="noopener noreferrer"
                   className="text-[13px] font-semibold text-[#1c1917] truncate hover:underline hover:text-[#B8864A]"
                   title={item.primary}>{item.primary}</a>
              ) : (
                <span className="text-[13px] font-semibold text-[#1c1917] truncate" title={item.primary}>{item.primary}</span>
              )}
              {item.secondary && <span className="text-[12px] font-semibold text-stone-500 truncate">{item.secondary}</span>}
            </div>
            <div className="flex-1 flex items-center gap-3 min-w-0">
              <div
                className="h-[18px] transition-all duration-500"
                style={{ width: `${barPct}%`, background: barBg, borderRadius: 3 }}
              />
              <span className="text-[14px] font-bold text-[#1c1917] tabular-nums">{item.value}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminAnalyticsNextPage() {
  const { lang } = useAdminT();
  const { country } = useAdminCountry();
  const [daily, setDaily] = useState<DayRow[]>([]);
  const [signupSources, setSignupSources] = useState<SourceItem[]>([]);
  const [companyTypes, setCompanyTypes]   = useState<SourceItem[]>([]);
  const [topCompanies, setTopCompanies]   = useState<CompanyVisitorRow[]>([]);
  const [pageViewsTotal, setPageViewsTotal]   = useState(0);
  const [pageViews30d, setPageViews30d]       = useState(0);
  const [pageViewMode, setPageViewMode]       = useState<'total' | '30d'>('total');
  const pageViews = pageViewMode === 'total' ? pageViewsTotal : pageViews30d;
  const [uniqueIps, setUniqueIps]         = useState(0);
  const [signedCount, setSignedCount]     = useState(0);
  const [companyCities, setCompanyCities]     = useState<CityRow[]>([]);
  const [inquiryCities, setInquiryCities]     = useState<CityRow[]>([]);
  const [visitorCities, setVisitorCities]     = useState<CityRow[]>([]);
  const [homeownerCities, setHomeownerCities] = useState<CityRow[]>([]);
  const [companyTypeCities, setCompanyTypeCities] = useState<TypeCityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const num = (v: any) => Number(v) || 0;
    Promise.allSettled([
      adminApi.getDailyStats(30, country) as Promise<any>,
      adminApi.getRegistrationSources(country),
      adminApi.getCompanyVisitors({ country }) as Promise<any>,
      adminApi.getVisitorOverview() as Promise<any>,
      adminApi.getSignedCompanies(country) as Promise<any>,
    ]).then((results) => {
      if (cancelled) return;
      const labels = ['getDailyStats', 'getRegistrationSources', 'getCompanyVisitors', 'getVisitorOverview', 'getSignedCompanies'];
      const ok = (i: number): any => {
        const r = results[i];
        if (r.status === 'fulfilled') return r.value;
        console.error(`[analytics] ${labels[i]} failed:`, r.reason);
        return null;
      };
      const reg    = ok(0);
      const src    = ok(1) || {};
      const vis    = ok(2) || {};
      const vov    = ok(3) || {};
      const signed = ok(4) || {};
      const rows: any[] = reg?.data || [];
      setDaily(rows.map((r: any) => ({
        date: r.date || r.stat_date,
        new_homeowners: num(r.new_homeowners ?? r.homeowner_count),
        new_companies:  num(r.new_companies  ?? r.company_count),
        new_inquiries:  num(r.new_inquiries  ?? r.inquiry_count),
      })));
      setSignupSources((src.signup_sources || []).map((s: any) => ({ source: s.source, count: num(s.count) })));
      setCompanyTypes((src.company_types || []).map((s: any) => ({ type: s.type, count: num(s.count) })));
      setCompanyCities((src.company_cities || []).map((c: any) => ({ city: c.city, count: num(c.count) })));
      setInquiryCities((src.inquiry_cities || []).map((c: any) => ({ city: c.city, count: num(c.count) })));
      setVisitorCities((src.visitor_cities || []).map((c: any) => ({ city: c.city, count: num(c.count) })));
      setHomeownerCities((src.homeowner_cities || []).map((c: any) => ({ city: c.city, count: num(c.count) })));
      setCompanyTypeCities((src.company_type_cities || []).map((t: any) => ({ ...t, count: num(t.count) })));
      const companies: CompanyVisitorRow[] = (vis?.companies || []).slice(0, 10).map((c: any) => ({
        ...c,
        unique_visitors: num(c.unique_visitors),
        total_views: num(c.total_views),
      }));
      setTopCompanies(companies);
      setPageViewsTotal(num(vov?.totalVisits));
      setPageViews30d(num(vov?.visitsLast30d));
      setUniqueIps(num(vov?.uniqueIpCount));
      setSignedCount(num(signed?.total));
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [country]);

  const totals = daily.reduce((acc, r) => ({
    homeowner: acc.homeowner + (r.new_homeowners || 0),
    company:   acc.company   + (r.new_companies  || 0),
    inquiry:   acc.inquiry   + (r.new_inquiries  || 0),
  }), { homeowner: 0, company: 0, inquiry: 0 });
  const periodDays = daily.length || 1;
  const last7 = daily.slice(-7);
  const last7Tot = last7.reduce((acc, r) => ({
    homeowner: acc.homeowner + (r.new_homeowners || 0),
    company:   acc.company   + (r.new_companies  || 0),
    inquiry:   acc.inquiry   + (r.new_inquiries  || 0),
    supplier:  acc.supplier  + (r.new_suppliers  || 0),
  }), { homeowner: 0, company: 0, inquiry: 0, supplier: 0 });
  const last7Avg = {
    homeowner: last7.length > 0 ? last7Tot.homeowner / last7.length * periodDays : 0,
    company:   last7.length > 0 ? last7Tot.company   / last7.length * periodDays : 0,
    inquiry:   last7.length > 0 ? last7Tot.inquiry   / last7.length * periodDays : 0,
  };

  const chartData = withTotalsAndMA(daily);

  const companyItems: LBItem[] = topCompanies.map(c => {
    const displayName = c.company_name.includes('-')
      ? c.company_name.replace(/-/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())
      : c.company_name;
    const cityText = c.cities && c.cities.length > 0
      ? c.cities.slice(0, 3).map(ci => `${ci.city || '—'} (${ci.visitors})`).join(' · ')
      : '';
    return {
      key: c.slug,
      primary: displayName,
      secondary: cityText,
      href: `/companies/${c.slug}`,
      value: c.unique_visitors,
    };
  });

  const typeTotal = companyTypes.reduce((s, x) => s + x.count, 0);
  const typeItems: LBItem[] = companyTypes.map(t => ({
    key: t.type || 'unknown',
    primary: labelCompanyType(t.type || '', lang === 'en' ? 'en' : 'zh') || '未知',
    secondary: typeTotal > 0 ? `${Math.round((t.count / typeTotal) * 100)}%` : undefined,
    value: t.count,
  })).sort((a, b) => b.value - a.value);

  const SOURCE_LABEL: Record<string, string> = {
    company_form:          '装企表单（谷歌）',
    company_auth:          '装企登录页（谷歌）',
    homeowner_auth:        '业主登录页（谷歌）',
    'google-oauth-company':'谷歌 OAuth（旧装企）',
    'google-oauth':        '谷歌 OAuth（旧）',
    'one-tap':             '谷歌 One Tap',
    direct:                '邮箱直接注册',
    'for-companies-landing': '装企落地页',
  };
  const sourceTotal = signupSources.reduce((s, x) => s + x.count, 0);
  const sourceItems: LBItem[] = signupSources.map(s => ({
    key: s.source || 'direct',
    primary: SOURCE_LABEL[s.source || 'direct'] || s.source || '未知',
    secondary: sourceTotal > 0 ? `${Math.round((s.count / sourceTotal) * 100)}%` : undefined,
    value: s.count,
  }));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#2c2c2c]">数据分析</h1>
          <p className="text-xs text-stone-500 mt-0.5">注册趋势 / 流量来源 / 装企地理分布 — 点 KPI 卡可穿透到对应列表</p>
        </div>
        <div className="flex items-center gap-4">
          <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="text-sm text-[#B8864A] hover:underline">谷歌收录 ↗</a>
          <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="text-sm text-[#B8864A] hover:underline">Google Analytics ↗</a>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
        <KpiCard icon={<Globe className="w-4 h-4" />}      label="独立访客"    value={uniqueIps}        accent="#5b7fcb"          sub="visitor_logs · 累计" href="/admin/visitors" />
        <KpiCard
          icon={<Eye className="w-4 h-4" />}
          label="页面浏览"
          value={pageViews}
          accent="#2c6e49"
          href="/admin/visitors"
          sub={
            <span className="inline-flex items-center gap-1">
              {(['total', '30d'] as const).map((m) => (
                <button
                  key={m}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPageViewMode(m); }}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${pageViewMode === m ? 'bg-[#2c6e49] text-white' : 'text-stone-500 hover:bg-stone-100'}`}
                >{m === 'total' ? '累计' : '近30天'}</button>
              ))}
            </span>
          }
        />
        <KpiCard icon={<Users className="w-4 h-4" />}      label="新增业主"    value={totals.homeowner} ma7={last7Avg.homeowner} week7Count={last7Tot.homeowner} accent={COLOR_HOMEOWNER} href="/admin/users" />
        <KpiCard icon={<Building2 className="w-4 h-4" />}  label="新增装企"    value={totals.company}   ma7={last7Avg.company}   week7Count={last7Tot.company}   accent={COLOR_COMPANY}   href="/admin/companies" />
        <KpiCard icon={<BadgeCheck className="w-4 h-4" />} label="已签约装企"  value={signedCount}      accent="#0d7c54"          sub="is_signed=1"               href="/admin/signed-companies" />
        <KpiCard icon={<HandCoins className="w-4 h-4" />}  label="新增询盘"    value={totals.inquiry}   ma7={last7Avg.inquiry}   week7Count={last7Tot.inquiry}   accent={COLOR_INQUIRY}   href="/admin/inquiries" />
        <KpiCard icon={<Package className="w-4 h-4" />}    label="新增供应商"  value={last7Tot.supplier} week7Count={last7Tot.supplier} accent="#0ea5e9" sub="近7天" href="/admin/suppliers" />
        <KpiCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="综合转化率"
          value={0}
          accent="#dc2626"
          valueOverride={`${(() => { const tot = totals.homeowner + totals.company + totals.inquiry; return tot > 0 ? Math.round(((totals.company + totals.inquiry) / tot) * 100) : 0; })()}%`}
          sub="（装企+询盘）/ 总注册"
        />
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 mb-6">
        <div className="mb-4">
          <h2 className="text-sm font-bold text-[#2c2c2c]">每日注册趋势</h2>
          <p className="text-xs text-stone-500 mt-0.5">合计（蓝色面积）+ 业主 / 装企 / 询盘 分线 · 蓝底为周末</p>
        </div>
        {loading ? <div className="h-[320px] flex items-center justify-center text-stone-400 text-sm">加载中…</div>
        : chartData.length === 0 ? <div className="h-[320px] flex items-center justify-center text-stone-400 text-sm">暂无数据</div>
        : (
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="totalArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5b7fcb" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#5b7fcb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0eeec" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a8a29e' }} tickFormatter={(v: string) => v.slice(5, 10)} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#a8a29e' }} allowDecimals={false} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 12 }} formatter={(v: any, n: any) => [v, ({ total: '合计', new_homeowners: '业主', new_companies: '装企', new_inquiries: '询盘' } as Record<string, string>)[n] || n]} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" formatter={(v: string) => ({ total: '合计', new_homeowners: '业主', new_companies: '装企', new_inquiries: '询盘' } as Record<string, string>)[v] || v} />
              {chartData.map((row, i) => row.is_weekend ? (
                <ReferenceArea key={`we-${i}`} x1={row.date} x2={row.date} strokeOpacity={0} fill="#5b7fcb" fillOpacity={0.05} />
              ) : null)}
              <Area type="linear" dataKey="total" stroke="#3b6ec0" strokeWidth={2} fill="url(#totalArea)" dot={false} activeDot={{ r: 4, stroke: '#3b6ec0', strokeWidth: 2, fill: '#fff' }} />
              <Line type="linear" dataKey="new_homeowners" stroke={COLOR_HOMEOWNER} strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
              <Line type="linear" dataKey="new_companies"  stroke={COLOR_COMPANY}   strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
              <Line type="linear" dataKey="new_inquiries"  stroke={COLOR_INQUIRY}   strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 flex flex-col">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#2c2c2c]">最受关注的 10 家公司</h2>
              <p className="text-[11px] text-stone-500 mt-0.5">独立访客数 · 点击公司名查看详情</p>
            </div>
            <div className="text-[11px] text-stone-500 tabular-nums shrink-0">共 <span className="font-bold text-[#1c1917] text-[14px]">{companyItems.length}</span> 家</div>
          </div>
          <LeaderboardBars items={companyItems} max={10} labelWidth={180} />
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 flex flex-col">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#2c2c2c]">装企类型分布</h2>
              <p className="text-[11px] text-stone-500 mt-0.5">注册装企类型分布</p>
            </div>
            <div className="text-[11px] text-stone-500 tabular-nums shrink-0">合计 <span className="font-bold text-[#1c1917] text-[14px]">{typeTotal.toLocaleString()}</span></div>
          </div>
          <LeaderboardBars items={typeItems} max={10} labelWidth={148} colors="multi" />
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 flex flex-col">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#2c2c2c]">注册来源分布</h2>
              <p className="text-[11px] text-stone-500 mt-0.5">用户从哪个入口完成注册</p>
            </div>
            <div className="text-[11px] text-stone-500 tabular-nums shrink-0">合计 <span className="font-bold text-[#1c1917] text-[14px]">{sourceTotal.toLocaleString()}</span></div>
          </div>
          <LeaderboardBars items={sourceItems} max={10} labelWidth={160} colors="multi" />
        </div>
      </div>

      <Suspense fallback={<div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 h-[480px] animate-pulse" />}>
        <UAEMap
          companyCities={companyCities}
          inquiryCities={inquiryCities}
          visitorCities={visitorCities}
          homeownerCities={homeownerCities}
          companyTypeCities={companyTypeCities}
          country={country}
        />
      </Suspense>
    </div>
  );
}
