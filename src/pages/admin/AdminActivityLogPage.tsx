import { useState, useEffect, useMemo, useCallback } from 'react';
import { adminApi } from '../../lib/adminApi';
import { formatAdminDateTime } from '../../lib/formatTime';
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ActivityLogEntry {
  id: number;
  user_id: number | null;
  user_name: string | null;
  user_role: string | null;
  action: string;
  target_type: string | null;
  target_id: number | null;
  target_name: string | null;
  description: string | null;
  ip: string | null;
  country: string | null;
  city: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface TodayStats {
  total: number;
  active_companies: number;
  active_homeowners: number;
  admin_actions: number;
}

interface ActionDistribution {
  action: string;
  count: number;
}

interface DailyTrend {
  date: string;
  admin: number;
  company: number;
  homeowner: number;
}

interface AggregatedGroup {
  key: string;
  entries: ActivityLogEntry[];
  user_id: number | null;
  user_name: string | null;
  user_role: string | null;
  action: string;
  target_type: string | null;
  date: string;
  latest: ActivityLogEntry;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'admin', label: 'Admin' },
  { value: 'company', label: '装企' },
  { value: 'homeowner', label: '业主' },
];

const ACTION_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'create', label: '创建' },
  { value: 'update', label: '编辑' },
  { value: 'delete', label: '删除' },
  { value: 'approve', label: '审批' },
  { value: 'login', label: '登录' },
  { value: 'register', label: '注册' },
];

const PIE_COLORS = ['#B8864A', '#5b7fcb', '#6b6b6b', '#d4a574', '#8daae0', '#a3a3a3', '#c9956b', '#7b9fd4'];

const ACTION_LABELS: Record<string, string> = {
  create: '创建',
  update: '编辑',
  delete: '删除',
  approve: '审批',
  reject: '拒绝',
  login: '登录',
  register: '注册',
  bind: '绑定',
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  project: '项目',
  company_profile: '装企',
  inquiry: '询盘',
  user: '用户',
  session: '会话',
  homeowner_profile: '业主资料',
  company_logo: 'Logo',
  admin_permission: '权限',
  uae_company: '目录公司',
};

const PAGE_SIZE = 30;

// ─── Helpers ────────────────────────────────────────────────────────────────

function getBorderColor(action: string): string {
  if (['create', 'approve', 'register'].includes(action)) return 'border-l-emerald-400';
  if (['delete', 'reject'].includes(action)) return 'border-l-red-400';
  if (['update', 'bind'].includes(action)) return 'border-l-amber-400';
  return 'border-l-stone-300';
}

function getRoleBadge(role: string | null) {
  if (role === 'admin') return <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Admin</span>;
  if (role === 'company') return <span className="ml-2 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">装企</span>;
  if (role === 'homeowner') return <span className="ml-2 inline-block rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">业主</span>;
  return null;
}

function formatTime(dateStr: string): string {
  return formatAdminDateTime(dateStr);
}

function extractDate(dateStr: string): string {
  return dateStr.slice(0, 10);
}

function buildDescription(group: AggregatedGroup): string {
  const actionLabel = ACTION_LABELS[group.action] || group.action;
  const targetLabel = TARGET_TYPE_LABELS[group.target_type || ''] || group.target_type || '';
  const count = group.entries.length;
  if (count > 1) {
    return `${actionLabel}了 ${count} 个${targetLabel}`;
  }
  return group.latest.description || `${actionLabel}了${targetLabel}`;
}

function getProjectLink(entry: ActivityLogEntry): string | null {
  if (entry.target_type === 'project' && entry.target_name && entry.target_id) {
    return `/admin/companies`; // link to admin companies view
  }
  return null;
}

// ─── Components ─────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
      <p className="text-sm text-[#6b6b6b] mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#2c2c2c]">{value}</p>
    </div>
  );
}

function AggregatedEntry({ group }: { group: AggregatedGroup }) {
  const [expanded, setExpanded] = useState(false);
  const isMultiple = group.entries.length > 1;
  const borderClass = getBorderColor(group.action);
  const loc = [group.latest.city, group.latest.country].filter(Boolean).join(', ');

  return (
    <div className={`bg-white rounded-2xl border border-stone-200 shadow-sm border-l-4 ${borderClass} p-4`}>
      {/* Top row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center min-w-0">
          <span className="font-medium text-[#2c2c2c] truncate">{group.user_name || '未知用户'}</span>
          {getRoleBadge(group.user_role)}
        </div>
        <span className="text-[15px] tabular-nums text-stone-500 ml-4 whitespace-nowrap">{formatTime(group.latest.created_at)}</span>
      </div>

      {/* Second row */}
      <div className="flex items-start justify-between mt-1.5">
        <p className="text-sm text-[#6b6b6b]">
          {buildDescription(group)}
          {isMultiple && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="ml-2 text-xs text-[#B8864A] hover:underline"
            >
              {expanded ? '收起' : '展开详情'}
            </button>
          )}
          {!isMultiple && group.latest.target_name && group.latest.target_type === 'project' && (
            <span className="ml-1 text-[#B8864A]">
              {' '}— {group.latest.target_name}
            </span>
          )}
        </p>
        {loc && <span className="text-xs text-[#6b6b6b] ml-4 whitespace-nowrap">{loc}</span>}
      </div>

      {/* Expanded detail list */}
      {expanded && isMultiple && (
        <div className="mt-3 ml-3 space-y-1 border-l-2 border-stone-200 pl-3">
          {group.entries.map((entry) => {
            const link = getProjectLink(entry);
            return (
              <div key={entry.id} className="flex items-center text-sm text-[#6b6b6b]">
                <span className="mr-1 text-stone-400">-</span>
                {entry.target_name || entry.description || `#${entry.target_id}`}
                {link && (
                  <a href={link} className="ml-2 text-xs text-[#B8864A] hover:underline">查看</a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function AdminActivityLogPage() {
  // Stats state
  const [todayStats, setTodayStats] = useState<TodayStats>({ total: 0, active_companies: 0, active_homeowners: 0, admin_actions: 0 });
  const [actionDist, setActionDist] = useState<ActionDistribution[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  // Log list state
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [logsLoading, setLogsLoading] = useState(true);

  // Filters
  const [roleFilter, setRoleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // ─── Fetch stats ───────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    adminApi.getActivityLogStats(7).then((data) => {
      if (cancelled) return;
      setTodayStats(data.today || { total: 0, active_companies: 0, active_homeowners: 0, admin_actions: 0 });
      setActionDist(data.action_distribution || []);
      setDailyTrend(data.daily_trend || []);
    }).catch(() => {
      // silently fail
    }).finally(() => {
      if (!cancelled) setStatsLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // ─── Fetch logs ────────────────────────────────────────────────────────

  const fetchLogs = useCallback(() => {
    setLogsLoading(true);
    adminApi.getActivityLog({
      page,
      limit: PAGE_SIZE,
      role: roleFilter || undefined,
      action: actionFilter || undefined,
      search: searchQuery || undefined,
    }).then((data) => {
      setLogs(data.logs || []);
      setPagination({
        page: data.pagination?.page ?? 1,
        total: data.pagination?.total ?? 0,
        totalPages: data.pagination?.totalPages ?? 0,
      });
    }).catch(() => {
      setLogs([]);
    }).finally(() => {
      setLogsLoading(false);
    });
  }, [page, roleFilter, actionFilter, searchQuery]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [roleFilter, actionFilter, searchQuery]);

  // ─── Aggregate logs (frontend grouping) ────────────────────────────────

  const aggregatedGroups = useMemo<AggregatedGroup[]>(() => {
    const map = new Map<string, ActivityLogEntry[]>();
    for (const entry of logs) {
      const date = extractDate(entry.created_at);
      const key = `${entry.user_id ?? 'null'}_${date}_${entry.action}_${entry.target_type ?? 'null'}`;
      const arr = map.get(key) || [];
      arr.push(entry);
      map.set(key, arr);
    }
    const groups: AggregatedGroup[] = [];
    for (const [key, entries] of map) {
      const latest = entries[0]; // logs come sorted desc, first is latest
      groups.push({
        key,
        entries,
        user_id: latest.user_id,
        user_name: latest.user_name,
        user_role: latest.user_role,
        action: latest.action,
        target_type: latest.target_type,
        date: extractDate(latest.created_at),
        latest,
      });
    }
    return groups;
  }, [logs]);

  // ─── CSV export ────────────────────────────────────────────────────────

  const handleExport = () => {
    const url = adminApi.getActivityLogExportUrl({
      role: roleFilter || undefined,
      action: actionFilter || undefined,
    });
    window.open(url, '_blank');
  };

  // ─── Pie chart label ──────────────────────────────────────────────────

  const renderPieLabel = ({ name, percent }: { name?: string; percent?: number }) =>
    `${ACTION_LABELS[name || ''] || name || ''} ${((percent || 0) * 100).toFixed(0)}%`;

  // ─── Render ────────────────────────────────────────────────────────────

  const selectClass = 'h-[42px] px-4 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white appearance-none';

  return (
    <div className="space-y-6">
      {/* Title */}
      <h1 className="text-xl font-bold text-[#2c2c2c]">操作记录</h1>

      {/* ── Summary Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="今日操作" value={todayStats.total} />
        <StatCard label="活跃装企" value={todayStats.active_companies} />
        <StatCard label="活跃业主" value={todayStats.active_homeowners} />
        <StatCard label="管理操作" value={todayStats.admin_actions} />
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────── */}
      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 h-[320px] animate-pulse" />
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 h-[320px] animate-pulse" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pie: action distribution */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <h2 className="text-sm font-medium text-[#6b6b6b] mb-4">操作类型分布</h2>
            {actionDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={actionDist}
                    dataKey="count"
                    nameKey="action"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    label={renderPieLabel}
                    labelLine={false}
                  >
                    {actionDist.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, ACTION_LABELS[String(name)] || String(name)]} />
                  <Legend formatter={(value) => ACTION_LABELS[String(value)] || String(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-sm text-[#6b6b6b]">暂无数据</div>
            )}
          </div>

          {/* Area: daily trend */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
            <h2 className="text-sm font-medium text-[#6b6b6b] mb-4">每日操作趋势</h2>
            {dailyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: '#6b6b6b' }}
                    tickFormatter={(v: string) => v.slice(5)} // MM-DD
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#6b6b6b' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e7e5e4', fontSize: 13 }}
                    labelFormatter={(v) => String(v)}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="admin" name="Admin" stackId="1" stroke="#B8864A" fill="#B8864A" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="company" name="装企" stackId="1" stroke="#5b7fcb" fill="#5b7fcb" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="homeowner" name="业主" stackId="1" stroke="#6b6b6b" fill="#6b6b6b" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-sm text-[#6b6b6b]">暂无数据</div>
            )}
          </div>
        </div>
      )}

      {/* ── Filter Bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className={selectClass}
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className={selectClass}
        >
          {ACTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="搜索操作人或目标..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-[42px] px-4 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white w-64"
        />

        <div className="flex-1" />

        <button
          onClick={handleExport}
          className="h-[42px] px-5 rounded-2xl border border-stone-200 bg-white text-sm font-medium text-[#2c2c2c] hover:bg-stone-50 transition-colors"
        >
          导出 CSV
        </button>
      </div>

      {/* ── Log List ───────────────────────────────────────────────────── */}
      {logsLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-stone-200 shadow-sm h-20 animate-pulse" />
          ))}
        </div>
      ) : aggregatedGroups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-12 text-center">
          <p className="text-[#6b6b6b] text-sm">暂无操作记录</p>
        </div>
      ) : (
        <div className="space-y-3">
          {aggregatedGroups.map((group) => (
            <AggregatedEntry key={group.key} group={group} />
          ))}
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────────────────── */}
      {pagination.totalPages > 0 && (
        <div className="flex items-center justify-between text-sm text-[#6b6b6b]">
          <span>共 {pagination.total} 条</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-[36px] px-4 rounded-2xl border border-stone-200 bg-white text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-50 transition-colors"
            >
              上一页
            </button>
            <span className="px-2">第 {page} / {pagination.totalPages} 页</span>
            <button
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              className="h-[36px] px-4 rounded-2xl border border-stone-200 bg-white text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-50 transition-colors"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
