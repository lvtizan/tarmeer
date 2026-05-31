'use client';

import { useEffect, useState, lazy, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Helmet } from 'react-helmet-async';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import { adminApi } from '@/lib/adminApi';
import { useAdminT } from '@/hooks/useAdminLang';
import { labelCompanyType } from '@/lib/companyTypeLabel';

const UAEMapLeaflet = dynamic(() => import('@/components/admin/UAEMapLeaflet'), { ssr: false });

const PRIMARY = '#B8864A';
const ADMIN_TIME_CLS = 'text-[15px] tabular-nums text-stone-500';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function pct(a: number, b: number) {
  if (!b) return '0%';
  return `${((a / b) * 100).toFixed(1)}%`;
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <p className="text-sm font-medium text-stone-500">{label}</p>
      <p className="text-3xl font-bold text-[#2c2c2c] mt-1">{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── LeaderboardBars ───────────────────────────────────────────────────────────

function LeaderboardBars({ rows, labelKey, valueKey }: { rows: any[]; labelKey: string; valueKey: string }) {
  if (!rows?.length) return <p className="text-stone-400 text-sm py-4 text-center">No data</p>;
  const max = Math.max(...rows.map((r) => r[valueKey]));
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs w-4 text-stone-400 text-right">{i + 1}</span>
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="font-medium text-stone-700 truncate max-w-[160px]">{row[labelKey]}</span>
              <span className="text-stone-500 ml-2">{row[valueKey]}</span>
            </div>
            <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${(row[valueKey] / max) * 100}%`, background: PRIMARY }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── BackToAnalytics ───────────────────────────────────────────────────────────

function BackToAnalytics() {
  return (
    <a href="/admin/analytics" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
      ← Analytics
    </a>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <h2 className="text-base font-semibold text-[#2c2c2c] mb-4">{title}</h2>
      {children}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const { t } = useAdminT();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    setLoading(true);
    adminApi.getAnalyticsDashboard(period)
      .then(setData)
      .catch((err: any) => setError(err.message || 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) return <div className="py-20 text-center text-stone-400">{t('Loading...', '加载中...')}</div>;
  if (error) return <div className="py-20 text-center text-red-500">{error}</div>;
  if (!data) return null;

  const { kpi, registrations, visitors, cityBreakdown, companyTypes, topCities, topCompanies, signups } = data;

  return (
    <>
      <Helmet><title>注册分析 v2 (BETA) — Tarmeer Admin</title></Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-[#2c2c2c]">{t('Analytics', '数据分析')} <span className="text-xs text-stone-400 font-normal">BETA</span></h1>
          <div className="flex items-center gap-2">
            {(['7d', '30d', '90d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  period === p ? 'bg-[#b8864a] text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Row */}
        {kpi && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label={t('Total Users', '总用户')} value={fmtNum(kpi.totalUsers)} />
            <KpiCard label={t('Companies', '装企')} value={fmtNum(kpi.totalCompanies)} />
            <KpiCard label={t('Visitors', '访客')} value={fmtNum(kpi.totalVisitors)} />
            <KpiCard label={t('Inquiries', '询盘')} value={fmtNum(kpi.totalInquiries)} />
          </div>
        )}

        {/* Registrations chart */}
        {registrations?.length > 0 && (
          <Section title={t('Registrations Over Time', '注册趋势')}>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={registrations}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="count" fill={`${PRIMARY}20`} stroke={PRIMARY} strokeWidth={2} />
                <Line type="monotone" dataKey="cumulative" stroke="#64748b" strokeWidth={1.5} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </Section>
        )}

        {/* UAE Map */}
        {cityBreakdown?.length > 0 && (
          <Section title={t('Geographic Distribution', '地域分布')}>
            <Suspense fallback={<div className="h-48 flex items-center justify-center text-stone-400">Loading map…</div>}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <UAEMapLeaflet {...({ data: cityBreakdown } as any)} />
            </Suspense>
          </Section>
        )}

        {/* Two-column: company types + top cities */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {companyTypes?.length > 0 && (
            <Section title={t('Company Types', '公司类型')}>
              <LeaderboardBars rows={companyTypes.map((r: any) => ({ ...r, label: labelCompanyType(r.company_type) }))} labelKey="label" valueKey="count" />
            </Section>
          )}
          {topCities?.length > 0 && (
            <Section title={t('Top Cities', '热门城市')}>
              <LeaderboardBars rows={topCities} labelKey="city" valueKey="count" />
            </Section>
          )}
        </div>

        {/* Top companies */}
        {topCompanies?.length > 0 && (
          <Section title={t('Top Companies', '热门公司')}>
            <LeaderboardBars rows={topCompanies} labelKey="name_en" valueKey="views" />
          </Section>
        )}

        {/* Visitor stats */}
        {visitors?.length > 0 && (
          <Section title={t('Visitor Traffic', '访客流量')}>
            <div className="mb-2 text-right">
              <a href="/admin/visitors" className="text-xs text-[#b8864a] hover:underline">
                {t('View all visitors →', '查看全部访客 →')}
              </a>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={visitors}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill={PRIMARY} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>
        )}
      </div>
    </>
  );
}
