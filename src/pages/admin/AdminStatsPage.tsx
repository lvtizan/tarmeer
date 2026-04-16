import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../lib/adminApi';
import { useAdmin } from '../../contexts/AdminContext';
import { PageSpinner } from '../../components/ui/Spinner';
import AdminSelect from '../../components/ui/AdminSelect';

interface DailyStatsRow {
  date: string;
  new_homeowners: number;
  new_companies: number;
  new_inquiries: number;
  homeowner_list: Array<{ name: string; email: string | null; city: string | null }>;
  company_list: Array<{ name: string; email: string | null; city: string | null; projects: number }>;
  inquiry_list: Array<{ name: string; phone: string | null; city: string | null; company: string | null }>;
}

interface DailyStatsResponse {
  data: DailyStatsRow[];
  totals: { new_homeowners: number; new_companies: number; new_inquiries: number };
  days: number;
}

type RangeDays = '7' | '30' | '90';

const RANGE_OPTIONS: { value: RangeDays; label: string }[] = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

const SERIES = [
  { key: 'new_homeowners' as const, label: 'Homeowners', color: '#b8864a' },
  { key: 'new_companies' as const, label: 'Companies', color: '#2c7da0' },
  { key: 'new_inquiries' as const, label: 'Inquiries', color: '#6a994e' },
];

export default function AdminStatsPage() {
  const { hasPermission } = useAdmin();
  const [range, setRange] = useState<RangeDays>('30');
  const [isLoading, setIsLoading] = useState(true);
  const [report, setReport] = useState<DailyStatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasPermission('can_view_stats')) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = (await adminApi.getDailyStats(Number(range))) as DailyStatsResponse;
        if (!cancelled) setReport(result);
      } catch (err: unknown) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load stats report.';
          setError(message);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [hasPermission, range]);

  if (!hasPermission('can_view_stats')) {
    return <div className="text-stone-500">You do not have permission to view the stats report.</div>;
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
        <h1 className="text-3xl font-bold text-[#2c2c2c]">Stats Report</h1>
        <div className="w-[180px]">
          <AdminSelect
            value={range}
            onChange={(v) => setRange(v as RangeDays)}
            options={RANGE_OPTIONS}
          />
        </div>
      </div>
      <p className="text-stone-500 text-sm mb-6">
        New homeowners, companies, and inquiries over time. Live counts — no cron dependency.
      </p>

      {isLoading ? (
        <PageSpinner text="Loading stats report..." />
      ) : error ? (
        <div className="p-6 rounded-2xl border border-red-200 bg-red-50 text-red-600">{error}</div>
      ) : !report || report.data.length === 0 ? (
        <div className="p-6 rounded-2xl border border-stone-200 bg-white text-stone-500">
          No data for the selected range.
        </div>
      ) : (
        <>
          <TotalsRow totals={report.totals} />
          <TrendChart data={report.data} />
          <DetailTable data={report.data} />
        </>
      )}
    </div>
  );
}

function TotalsRow({ totals }: { totals: DailyStatsResponse['totals'] }) {
  const cards = [
    { label: 'New Homeowners', value: totals.new_homeowners, color: SERIES[0].color },
    { label: 'New Companies', value: totals.new_companies, color: SERIES[1].color },
    { label: 'New Inquiries', value: totals.new_inquiries, color: SERIES[2].color },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4"
        >
          <div className="text-sm font-medium text-stone-500">{c.label}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="text-3xl font-bold" style={{ color: c.color }}>
              {c.value}
            </div>
            <div className="text-xs text-stone-500">in range</div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface TrendChartProps {
  data: DailyStatsRow[];
}

function TrendChart({ data }: TrendChartProps) {
  const width = 960;
  const height = 280;
  const padding = { top: 16, right: 16, bottom: 28, left: 36 };

  const { paths, maxY, xStep, xCoords } = useMemo(() => {
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;
    const n = data.length;
    const step = n > 1 ? innerW / (n - 1) : innerW;

    const max = Math.max(
      1,
      ...data.map((d) => Math.max(d.new_homeowners, d.new_companies, d.new_inquiries))
    );

    const xs = data.map((_, i) => padding.left + step * i);

    const toPath = (key: (typeof SERIES)[number]['key']) => {
      return data
        .map((d, i) => {
          const x = xs[i];
          const y = padding.top + innerH - (d[key] / max) * innerH;
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
    };

    return {
      paths: SERIES.map((s) => ({ ...s, d: toPath(s.key) })),
      maxY: max,
      xStep: step,
      xCoords: xs,
    };
  }, [data]);

  const innerTop = padding.top;
  const innerBottom = height - padding.bottom;
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  // Label every ~7 ticks to avoid crowding
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 mb-6">
      <div className="flex flex-wrap items-center gap-4 mb-3">
        {SERIES.map((s) => (
          <div key={s.key} className="flex items-center gap-2 text-sm text-[#2c2c2c]">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="w-full h-[280px]"
          role="img"
          aria-label="Daily trends chart"
        >
          {/* Y gridlines */}
          {gridLines.map((g) => {
            const y = innerTop + (innerBottom - innerTop) * (1 - g);
            const value = Math.round(maxY * g);
            return (
              <g key={g}>
                <line
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={y}
                  y2={y}
                  stroke="#e7e5e4"
                  strokeWidth={1}
                />
                <text x={8} y={y + 4} fontSize={10} fill="#6b6b6b">
                  {value}
                </text>
              </g>
            );
          })}

          {/* X axis labels */}
          {data.map((d, i) => {
            if (i % labelEvery !== 0 && i !== data.length - 1) return null;
            const x = xCoords[i];
            return (
              <text
                key={d.date}
                x={x}
                y={height - 8}
                fontSize={10}
                fill="#6b6b6b"
                textAnchor="middle"
              >
                {d.date.slice(5)}
              </text>
            );
          })}

          {/* Series lines */}
          {paths.map((p) => (
            <path key={p.key} d={p.d} fill="none" stroke={p.color} strokeWidth={2} />
          ))}

          {/* Data point dots (small, for clarity when few points) */}
          {data.length <= 14 &&
            paths.map((p) =>
              data.map((d, i) => {
                const innerH = height - padding.top - padding.bottom;
                const x = xCoords[i];
                const y =
                  padding.top + innerH - (d[p.key] / maxY) * innerH;
                return (
                  <circle
                    key={`${p.key}-${d.date}`}
                    cx={x}
                    cy={y}
                    r={2.5}
                    fill={p.color}
                  />
                );
              })
            )}

          {/* Invisible hover bands are a nice-to-have; skipped to keep SVG simple */}
          {xStep > 0 && null}
        </svg>
      </div>
    </div>
  );
}

interface DetailTableProps {
  data: DailyStatsRow[];
}

function DetailTable({ data }: DetailTableProps) {
  // Last 14 days, most recent first
  const recent = useMemo(() => {
    const sorted = [...data].sort((a, b) => (a.date < b.date ? 1 : -1));
    return sorted.slice(0, 14);
  }, [data]);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-200">
        <h2 className="text-[15px] font-semibold text-[#2c2c2c]">Last 14 Days Detail</h2>
        <p className="text-xs text-stone-500 mt-1">
          Click a row to expand and see individual homeowners, companies, and inquiries for that day.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50/60">
              <th className="py-3 px-4 text-left text-sm font-medium text-stone-500">Date</th>
              <th className="py-3 px-4 text-right text-sm font-medium text-stone-500">
                <span style={{ color: SERIES[0].color }}>Homeowners</span>
              </th>
              <th className="py-3 px-4 text-right text-sm font-medium text-stone-500">
                <span style={{ color: SERIES[1].color }}>Companies</span>
              </th>
              <th className="py-3 px-4 text-right text-sm font-medium text-stone-500">
                <span style={{ color: SERIES[2].color }}>Inquiries</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {recent.map((row) => (
              <DayRow key={row.date} row={row} />
            ))}
            {recent.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 px-4 text-sm text-stone-500 text-center">
                  No data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DayRow({ row }: { row: DailyStatsRow }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail =
    row.homeowner_list.length > 0 ||
    row.company_list.length > 0 ||
    row.inquiry_list.length > 0;

  return (
    <>
      <tr
        className={`border-b border-stone-100 ${hasDetail ? 'cursor-pointer hover:bg-stone-50' : ''}`}
        onClick={() => hasDetail && setExpanded((v) => !v)}
      >
        <td className="py-3 px-4 text-[15px] text-[#2c2c2c] font-medium">
          {row.date}
          {hasDetail && (
            <span className="ml-2 text-xs text-stone-400">{expanded ? '▾' : '▸'}</span>
          )}
        </td>
        <td className="py-3 px-4 text-[15px] text-right text-[#2c2c2c]">{row.new_homeowners}</td>
        <td className="py-3 px-4 text-[15px] text-right text-[#2c2c2c]">{row.new_companies}</td>
        <td className="py-3 px-4 text-[15px] text-right text-[#2c2c2c]">{row.new_inquiries}</td>
      </tr>
      {expanded && hasDetail && (
        <tr className="bg-stone-50/60 border-b border-stone-100">
          <td colSpan={4} className="py-4 px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DetailList
                title="Homeowners"
                color={SERIES[0].color}
                items={row.homeowner_list.map((h) => ({
                  title: h.name,
                  subtitle: h.email || '—',
                  meta: h.city || '',
                }))}
              />
              <DetailList
                title="Companies"
                color={SERIES[1].color}
                items={row.company_list.map((c) => ({
                  title: c.name,
                  subtitle: c.email || '—',
                  meta: `${c.city || ''}${c.projects ? ` · ${c.projects} projects` : ''}`,
                }))}
              />
              <DetailList
                title="Inquiries"
                color={SERIES[2].color}
                items={row.inquiry_list.map((i) => ({
                  title: i.name,
                  subtitle: i.phone || '—',
                  meta: `${i.city || ''}${i.company ? ` · ${i.company}` : ''}`,
                }))}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

interface DetailListProps {
  title: string;
  color: string;
  items: Array<{ title: string; subtitle: string; meta: string }>;
}

function DetailList({ title, color, items }: DetailListProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
        <span className="text-sm font-medium text-[#2c2c2c]">
          {title} <span className="text-stone-400 font-normal">({items.length})</span>
        </span>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-stone-400">None</div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, idx) => (
            <li key={idx} className="text-xs">
              <div className="text-[#2c2c2c] font-medium truncate">{it.title}</div>
              <div className="text-stone-500 truncate">{it.subtitle}</div>
              {it.meta && <div className="text-stone-400 truncate">{it.meta}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
