import { useEffect, useState, useRef } from 'react';
import { adminApi } from '../../lib/adminApi';
import { useAdminT } from '../../hooks/useAdminLang';

interface DetailItem {
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  projects?: number;
  company?: string;
}

interface DayRow {
  date: string;
  new_homeowners: number;
  new_companies: number;
  new_inquiries: number;
  homeowner_list?: DetailItem[];
  company_list?: DetailItem[];
  inquiry_list?: DetailItem[];
}

interface StatsData {
  data: DayRow[];
  totals: { new_homeowners: number; new_companies: number; new_inquiries: number };
  days: number;
}

const COLORS = {
  homeowners: '#b8864a',
  companies: '#2c6e49',
  inquiries: '#5b7fcb',
};

const DAYS_OPTIONS = [7, 30, 90] as const;
type DaysOption = typeof DAYS_OPTIONS[number];

type TooltipType = 'homeowners' | 'companies' | 'inquiries';
interface TooltipData { x: number; y: number; type: TooltipType; items: DetailItem[]; date: string }

function BarChart({ data, maxVal }: { data: DayRow[]; maxVal: number }) {
  const { t } = useAdminT();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(800);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([entry]) => setContainerW(entry.contentRect.width));
    obs.observe(containerRef.current);
    setContainerW(containerRef.current.clientWidth);
    return () => obs.disconnect();
  }, []);

  if (data.length === 0) return <div ref={containerRef} className="flex items-center justify-center h-[260px] text-stone-400 text-sm">{t('No data', '暂无数据')}</div>;

  const PL = 40;
  const chartW = containerW - PL - 16;
  const chartH = 220;
  const groupW = chartW / data.length;
  const barW = Math.max(4, Math.min(18, groupW / 4.5));
  const barGap = Math.max(1, barW * 0.15);
  const totalBarGroupW = barW * 3 + barGap * 2;

  return (
    <div ref={containerRef} className="w-full relative">
      <svg width="100%" height={chartH + 50} className="overflow-visible">
        {/* Y grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((r) => {
          const y = 10 + chartH - r * chartH;
          return (
            <g key={r}>
              <line x1={PL} x2={containerW - 16} y1={y} y2={y} stroke="#e7e5e4" strokeWidth={0.5} />
              <text x={PL - 6} y={y + 3.5} textAnchor="end" fontSize={10} fill="#a8a29e">
                {Math.round(r * maxVal)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const groupCenter = PL + i * groupW + groupW / 2;
          const x0 = groupCenter - totalBarGroupW / 2;
          const vals: { val: number; color: string; type: TooltipType; items: DetailItem[] }[] = [
            { val: d.new_homeowners, color: COLORS.homeowners, type: 'homeowners', items: d.homeowner_list || [] },
            { val: d.new_companies, color: COLORS.companies, type: 'companies', items: d.company_list || [] },
            { val: d.new_inquiries, color: COLORS.inquiries, type: 'inquiries', items: d.inquiry_list || [] },
          ];

          return (
            <g key={d.date}>
              {vals.map((v, j) => {
                const barH = maxVal > 0 ? (v.val / maxVal) * chartH : 0;
                const bx = x0 + j * (barW + barGap);
                const by = 10 + chartH - barH;

                return (
                  <g key={j}>
                    <rect
                      x={bx}
                      y={by}
                      width={barW}
                      height={Math.max(barH, 0)}
                      rx={2}
                      fill={v.color}
                      opacity={0.85}
                      className="cursor-pointer"
                      onMouseEnter={(e) => {
                        if (v.val > 0 && v.items.length > 0) {
                          const rect = (e.target as SVGRectElement).getBoundingClientRect();
                          const containerRect = containerRef.current?.getBoundingClientRect();
                          setTooltip({
                            x: rect.left - (containerRect?.left || 0) + barW / 2,
                            y: rect.top - (containerRect?.top || 0) - 8,
                            type: v.type,
                            items: v.items,
                            date: d.date,
                          });
                        }
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    />
                    {v.val > 0 && (
                      <text
                        x={bx + barW / 2}
                        y={by - 4}
                        textAnchor="middle"
                        fontSize={9}
                        fontWeight={600}
                        fill={v.color}
                      >
                        {v.val}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* X label */}
              <text
                x={groupCenter}
                y={10 + chartH + 16}
                fontSize={10}
                fill="#a8a29e"
                textAnchor="middle"
              >
                {d.date.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-50 bg-white border border-stone-200 rounded-lg shadow-lg px-3 py-2 text-xs pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            maxWidth: 320,
            minWidth: 180,
          }}
        >
          <div className="font-semibold text-stone-700 mb-1.5 border-b border-stone-100 pb-1">
            {tooltip.date} · {{ homeowners: t('Homeowners', '业主'), companies: t('Companies', '装企'), inquiries: t('Inquiries', '询盘') }[tooltip.type]}
          </div>
          {tooltip.items.slice(0, 15).map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 py-0.5 text-stone-600">
              <span className="truncate flex-1">{item.name}</span>
              {item.city && <span className="text-stone-400 shrink-0">{item.city}</span>}
              {tooltip.type === 'companies' && item.projects !== undefined && (
                <span className="text-[#2c6e49] font-medium shrink-0">{item.projects} {t('projects', '项目')}</span>
              )}
              {tooltip.type === 'inquiries' && item.phone && (
                <span className="text-stone-400 shrink-0">{item.phone}</span>
              )}
            </div>
          ))}
          {tooltip.items.length > 15 && (
            <div className="text-stone-400 mt-1">+{tooltip.items.length - 15} more</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminStatsPage() {
  const { t } = useAdminT();
  const [days, setDays] = useState<DaysOption>(30);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (adminApi.getDailyStats(days) as Promise<StatsData>)
      .then((res) => setStats(res))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  const data = stats?.data || [];
  const totals = stats?.totals || { new_homeowners: 0, new_companies: 0, new_inquiries: 0 };

  const maxVal = Math.max(
    1,
    ...data.map((d) => Math.max(d.new_homeowners, d.new_companies, d.new_inquiries))
  );

  const recentRows = [...data].reverse().slice(0, 14);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-800">{t('Registration Reports', '注册报表')}</h1>
          <p className="text-xs text-stone-400 mt-0.5">{t('Data is automatically collected daily at 02:00 Dubai time. Today\'s registrations are visible in real-time.', '数据每天迪拜深夜 02:00 自动统计一次，实时注册今日数据实时可见')}</p>
        </div>
        <div className="flex items-center gap-1 bg-stone-100 rounded-lg p-1">
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                days === d
                  ? 'bg-white text-stone-800 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {t(`Last ${d} days`, `近${d}天`)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: t('New Homeowners', '新业主'), value: totals.new_homeowners, color: COLORS.homeowners },
          { label: t('New Companies', '新装企'), value: totals.new_companies, color: COLORS.companies },
          { label: t('New Inquiries', '新询盘'), value: totals.new_inquiries, color: COLORS.inquiries },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-stone-200 p-5">
            <div className="text-xs font-medium text-stone-400 mb-1">{c.label}</div>
            <div className="text-3xl font-bold" style={{ color: c.color }}>
              {loading ? '—' : c.value.toLocaleString()}
            </div>
            <div className="text-xs text-stone-400 mt-1">{t(`Last ${days} days total`, `近${days}天合计`)}</div>
          </div>
        ))}
      </div>

      {/* Bar Chart */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        <div className="flex items-center gap-5 mb-4 text-[11px]">
          {[
            { label: t('Homeowner Signups', '业主注册'), color: COLORS.homeowners },
            { label: t('Company Signups', '装企注册'), color: COLORS.companies },
            { label: t('Inquiries', '询盘'), color: COLORS.inquiries },
          ].map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: l.color, opacity: 0.85 }} />
              <span className="text-stone-500">{l.label}</span>
            </span>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-[260px] text-stone-400 text-sm">{t('Loading...', '加载中...')}</div>
        ) : (
          <BarChart data={data} maxVal={maxVal} />
        )}
      </div>

      {/* Recent data table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <span className="text-sm font-medium text-stone-700">{t('Last 14 Days Detail', '近14天明细')}</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-stone-400 border-b border-stone-100">
              <th className="text-left px-5 py-2.5 font-medium">{t('Date', '日期')}</th>
              <th className="text-right px-5 py-2.5 font-medium" style={{ color: COLORS.homeowners }}>{t('New Homeowners', '新业主')}</th>
              <th className="text-right px-5 py-2.5 font-medium" style={{ color: COLORS.companies }}>{t('New Companies', '新装企')}</th>
              <th className="text-right px-5 py-2.5 font-medium" style={{ color: COLORS.inquiries }}>{t('Inquiries', '询盘')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-8 text-stone-400">{t('Loading...', '加载中...')}</td></tr>
            ) : recentRows.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-8 text-stone-400">{t('No data', '暂无数据')}</td></tr>
            ) : recentRows.map((row) => (
              <tr key={row.date} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                <td className="px-5 py-2.5 text-stone-600 font-mono text-xs">{row.date}</td>
                <td className="px-5 py-2.5 text-right font-medium" style={{ color: row.new_homeowners > 0 ? COLORS.homeowners : '#d1cec9' }}>
                  {row.new_homeowners || '—'}
                </td>
                <td className="px-5 py-2.5 text-right font-medium" style={{ color: row.new_companies > 0 ? COLORS.companies : '#d1cec9' }}>
                  {row.new_companies || '—'}
                </td>
                <td className="px-5 py-2.5 text-right font-medium" style={{ color: row.new_inquiries > 0 ? COLORS.inquiries : '#d1cec9' }}>
                  {row.new_inquiries || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
