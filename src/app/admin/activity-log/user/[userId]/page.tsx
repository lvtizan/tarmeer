'use client';
import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/adminApi';
import { formatAdminDateTime } from '@/lib/formatTime';

interface LogEntry {
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

interface Summary {
  total_events: number;
  first_seen: string | null;
  last_seen: string | null;
  distinct_actions: number;
}

type TimeRange = '7d' | '30d' | 'all';

const ACTION_LABELS: Record<string, string> = {
  create: '创建',
  update: '编辑资料',
  delete: '删除',
  approve: '审批',
  reject: '拒绝',
  login: '登录',
  register: '注册',
  bind: '绑定',
  view_company: '浏览公司',
  submit_inquiry: '提交询价',
  view_project: '浏览项目',
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  project: '项目',
  company_profile: '装企',
  company: '公司',
  inquiry: '询盘',
  user: '用户',
  session: '会话',
  homeowner_profile: '业主资料',
  company_logo: 'Logo',
  admin_permission: '权限',
  uae_company: '目录公司',
};

type DotType = 'login' | 'edit' | 'upload' | 'inquiry' | 'view' | 'default';

function getDotType(action: string): DotType {
  if (action === 'login' || action === 'register') return 'login';
  if (action === 'update' || action === 'bind') return 'edit';
  if (action === 'create') return 'upload';
  if (action === 'submit_inquiry') return 'inquiry';
  if (action === 'view_company' || action === 'view_project') return 'view';
  return 'default';
}

const DOT_STYLES: Record<DotType, string> = {
  login: 'bg-emerald-50 ring-2 ring-emerald-300 text-emerald-600',
  edit: 'bg-amber-50 ring-2 ring-yellow-300 text-amber-600',
  upload: 'bg-blue-50 ring-2 ring-blue-300 text-blue-600',
  inquiry: 'bg-purple-50 ring-2 ring-purple-300 text-purple-600',
  view: 'bg-stone-50 ring-2 ring-stone-300 text-stone-500',
  default: 'bg-white ring-2 ring-stone-200 text-stone-400',
};

const DOT_ICONS: Record<DotType, string> = {
  login: '🔑', edit: '✏️', upload: '📸', inquiry: '📩', view: '👁', default: '•',
};

function formatDateGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (d.toDateString() === today.toDateString()) return `今天 · ${today.getFullYear()}年${m}月${day}日`;
  if (d.toDateString() === yesterday.toDateString()) return `昨天 · ${today.getFullYear()}年${m}月${day}日`;
  return `${d.getFullYear()}年${m}月${day}日`;
}

function getRoleBadge(role: string | null) {
  if (role === 'admin') return <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">超管</span>;
  if (role === 'company') return <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">装企</span>;
  if (role === 'homeowner') return <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">业主</span>;
  return null;
}

function UserTimelineContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { userId } = useParams<{ userId: string }>();

  const roleParam = searchParams.get('role') || undefined;
  const uid = Number(userId);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('all');

  const fetchTimeline = useCallback(() => {
    if (!uid) return;
    setLoading(true);
    adminApi.getUserTimeline(uid, { role: roleParam, page, limit: 100 })
      .then((data) => {
        setLogs(data.logs || []);
        setSummary(data.summary || null);
        setPagination({
          page: data.pagination?.page ?? 1,
          total: data.pagination?.total ?? 0,
          totalPages: data.pagination?.totalPages ?? 0,
        });
      })
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [uid, roleParam, page]);

  useEffect(() => { fetchTimeline(); }, [fetchTimeline]);
  useEffect(() => { setPage(1); }, [uid, roleParam]);

  const userName = logs[0]?.user_name || `用户 #${uid}`;
  const userRole = logs[0]?.user_role || roleParam || null;
  const avatarLetter = userName[0].toUpperCase();

  const derivedStats = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recent7d = logs.filter((l) => new Date(l.created_at).getTime() >= sevenDaysAgo).length;
    const uploads = logs.filter((l) => l.action === 'create' && (l.target_type === 'project' || l.target_type === 'company_logo')).length;
    const edits = logs.filter((l) => l.action === 'update').length;
    return { recent7d, uploads, edits };
  }, [logs]);

  const commonIp = useMemo(() => {
    const ipMap: Record<string, number> = {};
    for (const l of logs) { if (l.ip) ipMap[l.ip] = (ipMap[l.ip] || 0) + 1; }
    return Object.entries(ipMap).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }, [logs]);

  const isActiveToday = useMemo(() => {
    const today = new Date().toDateString();
    return logs.some((l) => new Date(l.created_at).toDateString() === today);
  }, [logs]);

  const timeRangeLogs = useMemo(() => {
    if (timeRange === 'all') return logs;
    const days = timeRange === '7d' ? 7 : 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return logs.filter((l) => new Date(l.created_at).getTime() >= cutoff);
  }, [logs, timeRange]);

  const actionCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of timeRangeLogs) { map[l.action] = (map[l.action] || 0) + 1; }
    return map;
  }, [timeRangeLogs]);

  const filteredLogs = useMemo(() =>
    actionFilter ? timeRangeLogs.filter((l) => l.action === actionFilter) : timeRangeLogs,
    [timeRangeLogs, actionFilter]
  );

  const groupedByDate = useMemo(() => {
    const map = new Map<string, LogEntry[]>();
    for (const l of filteredLogs) {
      const d = l.created_at.slice(0, 10);
      const arr = map.get(d) || [];
      arr.push(l);
      map.set(d, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredLogs]);

  const avatarBg = userRole === 'company' ? 'bg-amber-50 text-amber-700'
    : userRole === 'homeowner' ? 'bg-blue-50 text-blue-600'
    : 'bg-emerald-50 text-emerald-700';

  return (
    <div className="space-y-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => router.push('/admin/activity-log')}
          className="text-sm text-[#6b6b6b] hover:text-[#B8864A] transition-colors"
        >
          ← 用户行为监控
        </button>
      </div>

      {/* User header */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 mb-6">
        <div className="flex items-start gap-4">
          <div className={`w-[52px] h-[52px] rounded-full flex items-center justify-center text-2xl font-bold shrink-0 ${avatarBg}`}>
            {avatarLetter}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-[#1c1917]">{userName}</h1>
              {getRoleBadge(userRole)}
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${isActiveToday ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-400'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isActiveToday ? 'bg-emerald-400' : 'bg-stone-300'}`} />
                {isActiveToday ? '今日在线' : '今日未活跃'}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-[#6b6b6b]">
              {summary?.first_seen && <span>注册 {formatAdminDateTime(summary.first_seen).split(' ')[0]}</span>}
              {commonIp && <span>常用 IP：{commonIp}</span>}
              {summary && <span>共 <strong className="text-[#2c2c2c]">{summary.total_events}</strong> 次操作</span>}
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {(userRole === 'company') && (
              <button
                onClick={() => router.push(`/admin/companies?tab=registered&search=${encodeURIComponent(userName)}`)}
                className="h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs text-[#44403c] hover:bg-stone-50 transition-colors"
              >
                查看公司主页
              </button>
            )}
            <button
              onClick={() => router.push(`/admin/inquiries?search=${encodeURIComponent(userName)}`)}
              className="h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs text-[#44403c] hover:bg-stone-50 transition-colors"
            >
              查看线索
            </button>
            <button
              className="h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs text-[#44403c] hover:bg-stone-50 transition-colors opacity-50 cursor-not-allowed"
              disabled
              title="暂未开放"
            >
              发送通知
            </button>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-[#B8864A]">{derivedStats.recent7d}</p>
          <p className="text-xs text-[#6b6b6b] mt-1">近7天操作</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-blue-500">{derivedStats.uploads}</p>
          <p className="text-xs text-[#6b6b6b] mt-1">项目上传</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-[#B8864A]">{derivedStats.edits}</p>
          <p className="text-xs text-[#6b6b6b] mt-1">资料编辑</p>
        </div>
      </div>

      {/* Body: left filter + timeline */}
      <div className="flex gap-5 items-start">
        {/* Left filter panel */}
        <div className="w-44 shrink-0 hidden md:block space-y-3">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wide mb-2">时间范围</p>
            {([['7d', '最近7天'], ['30d', '最近30天'], ['all', '全部记录']] as [TimeRange, string][]).map(([val, label]) => (
              <button
                key={val}
                onClick={() => { setTimeRange(val); setActionFilter(''); }}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-colors ${timeRange === val ? 'bg-amber-50 text-[#B8864A] font-semibold' : 'text-[#44403c] hover:bg-stone-50'}`}
              >
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wide mb-2">操作类型</p>
            <button
              onClick={() => setActionFilter('')}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${actionFilter === '' ? 'bg-amber-50 text-[#B8864A] font-semibold' : 'text-[#44403c] hover:bg-stone-50'}`}
            >
              <span className="flex-1 text-left">全部操作</span>
              <span className="text-[11px] text-stone-400">{logs.length}</span>
            </button>
            {Object.entries(actionCounts).sort((a, b) => b[1] - a[1]).map(([action, count]) => (
              <button
                key={action}
                onClick={() => setActionFilter(action)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${actionFilter === action ? 'bg-amber-50 text-[#B8864A] font-semibold' : 'text-[#44403c] hover:bg-stone-50'}`}
              >
                <span className="flex-1 text-left truncate">{ACTION_LABELS[action] || action}</span>
                <span className="text-[11px] text-stone-400">{count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-stone-200 h-16 animate-pulse" />
              ))}
            </div>
          ) : groupedByDate.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-12 text-center">
              <p className="text-[#6b6b6b] text-sm">暂无活动记录</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedByDate.map(([date, entries]) => (
                <div key={date}>
                  <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-3 pl-12">
                    {formatDateGroup(date)}
                  </p>
                  <div className="relative">
                    <div className="absolute left-[17px] top-0 bottom-0 w-0.5 bg-stone-200" />
                    <div className="space-y-3">
                      {entries.map((entry) => {
                        const dotType = getDotType(entry.action);
                        const actionLabel = ACTION_LABELS[entry.action] || entry.action;
                        const targetLabel = TARGET_TYPE_LABELS[entry.target_type || ''] || entry.target_type || '';
                        const loc = [entry.city, entry.country].filter(Boolean).join(', ');
                        const timeStr = formatAdminDateTime(entry.created_at).split(' ').slice(1).join(' ');
                        return (
                          <div key={entry.id} className="flex gap-3 items-start relative">
                            <div className={`w-[34px] h-[34px] rounded-full flex items-center justify-center text-sm z-10 shrink-0 ${DOT_STYLES[dotType]}`}>
                              {DOT_ICONS[dotType]}
                            </div>
                            <div className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-3 shadow-sm">
                              <div className="flex items-baseline gap-2">
                                <p className="text-[13.5px] text-[#1c1917]">
                                  <span className="font-semibold">{actionLabel}</span>
                                  {targetLabel && <span className="text-stone-500">了{targetLabel}</span>}
                                  {entry.action === 'view_company' && entry.target_name ? (
                                    <Link href={`/admin/companies?search=${encodeURIComponent(entry.target_name)}`} className="text-[#B8864A] hover:underline ml-1"> — {entry.target_name}</Link>
                                  ) : entry.target_name ? (
                                    <span className="text-[#B8864A]"> — {entry.target_name}</span>
                                  ) : null}
                                </p>
                                <span className="ml-auto text-[11px] text-stone-400 shrink-0">{timeStr}</span>
                              </div>
                              {entry.description && <p className="text-xs text-[#6b6b6b] mt-1">{entry.description}</p>}
                              {entry.action === 'submit_inquiry' && (
                                <div className="mt-1.5">
                                  <Link
                                    href={`/admin/inquiries?search=${encodeURIComponent(entry.user_name || '')}`}
                                    className="text-[11px] text-violet-600 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5 hover:bg-violet-100 transition-colors"
                                  >
                                    查看询盘内容 →
                                  </Link>
                                  {entry.target_name && <span className="ml-1.5 text-[11px] text-stone-400">向「{entry.target_name}」</span>}
                                </div>
                              )}
                              {(loc || entry.ip) && (
                                <div className="flex gap-2 mt-1.5">
                                  {loc && <span className="text-[11px] text-stone-400 bg-stone-50 rounded px-1.5 py-0.5">📍 {loc}</span>}
                                  {entry.ip && <span className="text-[11px] text-stone-400 bg-stone-50 rounded px-1.5 py-0.5">🌐 {entry.ip}</span>}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-[#6b6b6b] mt-6">
              <span>共 {pagination.total} 条</span>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="h-9 px-4 rounded-2xl border border-stone-200 bg-white text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-50 transition-colors">上一页</button>
                <span className="px-2">第 {page} / {pagination.totalPages} 页</span>
                <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} className="h-9 px-4 rounded-2xl border border-stone-200 bg-white text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-50 transition-colors">下一页</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminUserTimelinePage() {
  return (
    <Suspense fallback={<div className="p-8 text-stone-400 text-sm">加载中...</div>}>
      <UserTimelineContent />
    </Suspense>
  );
}
