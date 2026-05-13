import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { adminApi } from '../../lib/adminApi';
import { formatAdminDateTime } from '../../lib/formatTime';
import AdminSelect from '../../components/ui/AdminSelect';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ActivityLogEntry {
  id: number;
  user_id: number | null;
  user_name: string | null;
  user_role: string | null;
  ip_hint_name: string | null;
  ip_hint_role: string | null;
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

interface TopUser {
  user_id: number;
  user_role: string;
  user_name: string | null;
  event_count: number;
  last_seen: string;
  recent_actions: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLE_TABS = [
  { value: '', label: '全部' },
  { value: 'company', label: '装企' },
  { value: 'homeowner', label: '业主' },
  { value: 'admin', label: '管理员' },
];

const ACTION_OPTIONS = [
  { value: '', label: '全部操作' },
  { value: 'create', label: '创建' },
  { value: 'update', label: '编辑' },
  { value: 'delete', label: '删除' },
  { value: 'approve', label: '审批' },
  { value: 'login', label: '登录' },
  { value: 'register', label: '注册' },
  { value: 'view_company', label: '浏览公司' },
  { value: 'submit_inquiry', label: '提交询价' },
];

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

// bar color per action type (matches wireframe)
const ACTION_BAR_COLORS: Record<string, string> = {
  update: '#B8864A',
  create: '#3b82f6',
  submit_inquiry: '#8b5cf6',
  login: '#16a34a',
  register: '#16a34a',
  approve: '#0ea5e9',
  delete: '#ef4444',
  view_company: '#6b7280',
  default: '#a8a29e',
};

// Emoji per action × target type
function getActionEmoji(action: string, targetType: string | null): string {
  if (action === 'login') return '🔑';
  if (action === 'register') return '✅';
  if (action === 'create' && targetType === 'inquiry') return '📩';
  if (action === 'create' && targetType === 'project') return '📸';
  if (action === 'create') return '✅';
  if (action === 'update' || action === 'edit') return '✏️';
  if (action === 'approve') return '✅';
  if (action === 'reject') return '❌';
  if (action === 'delete') return '🗑️';
  if (action === 'view_company' || action === 'view_project') return '👁';
  if (action === 'bind') return '🔗';
  return '📋';
}

// Whether entry is "new" (created within last 2 hours)
function isNew(createdAt: string): boolean {
  return (Date.now() - new Date(createdAt).getTime()) < 2 * 60 * 60 * 1000;
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  project: '项目',
  company_profile: '装企资料',
  company: '公司',
  inquiry: '询盘',
  user: '用户',
  session: '会话',
  homeowner_profile: '业主资料',
  company_logo: 'Logo',
  admin_permission: '权限',
  uae_company: '目录公司',
};

const PAGE_SIZE = 30;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build admin detail path from target_type + target_id */
function getTargetPath(targetType: string | null, targetId: number | null): string | null {
  if (!targetId) return null;
  if (targetType === 'company_profile') return `/admin/profile-companies/${targetId}`;
  if (targetType === 'company' || targetType === 'uae_company') return `/admin/companies/${targetId}`;
  if (targetType === 'user') return `/admin/users/${targetId}`;
  return null;
}

/** Build actor (user) detail path based on role */
function getUserPath(userId: number, role: string | null): string {
  if (role === 'admin') return `/admin/activity-log/user/${userId}?role=admin`;
  return `/admin/users/${userId}`;
}

function getRoleBadge(role: string | null) {
  if (role === 'admin') return <span className="ml-1.5 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">超管</span>;
  if (role === 'company') return <span className="ml-1.5 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">装企</span>;
  if (role === 'homeowner') return <span className="ml-1.5 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600">业主</span>;
  return null;
}


function formatDateLabel(dateStr: string): string {
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

function extractDate(dateStr: string | null | undefined): string { return dateStr ? dateStr.slice(0, 10) : '1970-01-01'; }

// ─── Event Card ──────────────────────────────────────────────────────────────

function EntryDetail({ e }: { e: ActivityLogEntry }) {
  const m = e.metadata as Record<string, string> | null;
  const targetPath = getTargetPath(e.target_type, e.target_id);

  if (e.target_type === 'inquiry' && m) {
    const parts = [
      m.company && `公司: ${m.company}`,
      m.submitter && `提交人: ${m.submitter}`,
      m.city && `城市: ${m.city}`,
      m.area && `面积: ${m.area}`,
      m.phone && `电话: ${m.phone}`,
    ].filter(Boolean);
    return <div className="text-xs text-[#6b6b6b]">{parts.join(' · ') || e.description || `#${e.target_id}`}</div>;
  }

  const label = e.target_name || e.description || `#${e.target_id}`;
  if (targetPath && label) {
    return (
      <div className="text-xs">
        <Link
          to={targetPath}
          state={{ from: '/admin/activity-log', fromLabel: '操作记录' }}
          className="text-[#B8864A] hover:underline"
          onClick={(ev) => ev.stopPropagation()}
        >
          {label}
        </Link>
      </div>
    );
  }
  return <div className="text-xs text-[#6b6b6b]">{e.description || label}</div>;
}

// Safely parse metadata — MySQL TEXT column may arrive as a JSON string
function parseMeta(raw: unknown): Record<string, any> | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return null; } }
  return null;
}

// Build rich description with metadata — returns { main, detail } parts
function buildRichDesc(e: ActivityLogEntry): { main: string; detail: string | null; entityName: string | null } {
  const m = parseMeta(e.metadata);
  const title = e.target_name || (m?.title as string | null) || null;

  if (e.action === 'create' && e.target_type === 'project') {
    const count = m?.image_count ? `，含 ${m.image_count} 张图片` : '';
    return { main: `上传了新项目${title ? `「${title}」` : ''}${count}`, detail: null, entityName: title };
  }
  if (e.action === 'update' && e.target_type === 'project') {
    return { main: `编辑了项目${title ? `「${title}」` : ''}`, detail: null, entityName: title };
  }
  if (e.action === 'delete' && e.target_type === 'project') {
    return { main: `删除了项目${title ? `「${title}」` : ''}`, detail: null, entityName: title };
  }
  if (e.action === 'create' && e.target_type === 'inquiry') {
    const company = m?.company as string | null;
    const area = m?.area as string | null;
    const detail = [area && `空间 ${area}`, m?.city && `${m.city}`].filter(Boolean).join('，') || null;
    return { main: `向公司提交了询价`, detail, entityName: company };
  }
  if (e.action === 'login') {
    return { main: '登录了系统', detail: null, entityName: null };
  }
  if (e.action === 'approve') {
    const count = m?.count ? ` ${m.count} 个` : '';
    const targetLabel = TARGET_TYPE_LABELS[e.target_type || ''] || e.target_type || '';
    return { main: `批准了${count}${targetLabel}`, detail: m?.reason as string | null, entityName: title };
  }
  if (e.action === 'reject') {
    const targetLabel = TARGET_TYPE_LABELS[e.target_type || ''] || e.target_type || '';
    return { main: `拒绝了${targetLabel}`, detail: m?.reason as string | null, entityName: title };
  }
  if (e.action === 'update') {
    const targetLabel = TARGET_TYPE_LABELS[e.target_type || ''] || e.target_type || '';
    return { main: `编辑了${targetLabel}${title ? ` — ${title}` : ''}`, detail: null, entityName: title };
  }
  // Fallback to stored description
  const fallbackDesc = e.description || `${ACTION_LABELS[e.action] || e.action}了${TARGET_TYPE_LABELS[e.target_type || ''] || e.target_type || ''}`;
  return { main: fallbackDesc, detail: null, entityName: title };
}

function AggregatedEntry({ group, onUserClick }: {
  group: AggregatedGroup;
  onUserClick: (userId: number, role: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isMultiple = group.entries.length > 1;
  const timeStr = formatAdminDateTime(group.latest.created_at).split(' ').slice(1).join(' ');
  const showNew = isNew(group.latest.created_at);

  // Resolve anonymous users: use ip_hint or masked IP
  const isAnon = !group.user_id;
  const hintName = group.latest.ip_hint_name;
  const hintRole = group.latest.ip_hint_role;
  const maskedIp = group.latest.ip ? group.latest.ip.replace(/\.\d+$/, '.xxx') : null;
  const displayName = group.user_id
    ? (group.user_name || `用户 #${group.user_id}`)
    : (hintName ? `访客（疑似 ${hintName}）` : (maskedIp ? `访客 ${maskedIp}` : '未知访客'));
  const displayRole = group.user_role || (isAnon && hintRole) || null;

  const emoji = getActionEmoji(group.action, group.target_type);
  const { main, detail, entityName } = buildRichDesc(group.latest);
  const m = parseMeta(group.latest.metadata);
  const uaBrowser = m?.ua_browser as string | null;
  const uaOs = m?.ua_os as string | null;
  const projStatus = m?.status as string | null;

  return (
    <div className="flex gap-3 py-2.5 border-b border-stone-100 last:border-0 hover:bg-stone-50/60 transition-colors px-1 rounded-lg">
      {/* Emoji circle */}
      <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-base shrink-0 mt-0.5 select-none">{emoji}</div>

      <div className="flex-1 min-w-0">
        {/* Row 1: user + badges + time */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {group.user_id ? (
            <Link
              to={getUserPath(group.user_id, group.user_role)}
              className="text-sm font-semibold text-[#1c1917] hover:text-[#B8864A] transition-colors leading-tight"
              onClick={(e) => {
                if (group.user_role === 'admin') {
                  e.preventDefault();
                  onUserClick(group.user_id!, group.user_role);
                }
              }}
            >
              {displayName}
            </Link>
          ) : (
            <span className={`text-[13px] font-semibold leading-tight ${hintName ? 'text-stone-400 italic' : 'text-stone-400'}`}>{displayName}</span>
          )}
          {getRoleBadge(displayRole)}
          {isMultiple && <span className="text-[11px] text-stone-400 bg-stone-50 border border-stone-200 rounded px-1.5 py-0.5">×{group.entries.length}</span>}
          {showNew && <span className="text-[10px] font-bold text-white bg-[#B8864A] rounded px-1.5 py-0.5">新</span>}
          <span className="ml-auto text-[11px] text-stone-400 tabular-nums shrink-0">{timeStr}</span>
        </div>

        {/* Row 2: rich description + chips */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-1">
          {/* Main description text */}
          <span className="text-[12.5px] text-[#44403c] leading-snug">
            {main}
            {entityName && group.action !== 'create' && group.action !== 'update' && group.action !== 'delete' && (
              <span className="ml-1 text-[#B8864A] font-medium">{entityName}</span>
            )}
          </span>
          {/* Extra detail (area, reason, etc.) */}
          {detail && <span className="text-[11px] text-stone-500">— {detail}</span>}

          {/* Chips */}
          {group.action === 'submit_inquiry' && (
            <Link
              to={`/admin/inquiries?search=${encodeURIComponent(group.user_name || group.latest.target_name || '')}`}
              className="text-[10px] bg-violet-50 text-violet-600 border border-violet-200 rounded px-1.5 py-0.5 font-medium hover:bg-violet-100 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              查看询盘 →
            </Link>
          )}
          {group.latest.target_id && group.target_type === 'inquiry' && (
            <span className="text-[10px] bg-violet-50 text-violet-600 border border-violet-200 rounded px-1.5 py-0.5 font-medium">线索 #{group.latest.target_id}</span>
          )}
          {group.latest.target_id && group.target_type === 'project' && (
            <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5 py-0.5 font-medium">项目 #{group.latest.target_id}</span>
          )}
          {projStatus === 'pending' && (
            <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 rounded px-1.5 py-0.5 font-medium">待审批</span>
          )}
          {isMultiple && (
            <span className="text-[10px] bg-stone-50 text-stone-500 border border-stone-200 rounded px-1.5 py-0.5">批量操作</span>
          )}
          {uaBrowser && uaOs && (
            <span className="text-[10px] bg-stone-50 text-stone-500 border border-stone-200 rounded px-1.5 py-0.5">{uaBrowser} · {uaOs}</span>
          )}

          {/* Expand button */}
          {isMultiple && (
            <button onClick={() => setExpanded(!expanded)} className="text-[11px] text-[#B8864A] bg-amber-50 rounded px-1.5 py-0.5 hover:bg-amber-100 transition-colors ml-auto">
              {expanded ? '收起' : '展开 ▾'}
            </button>
          )}
        </div>

        {/* Expanded sub-list */}
        {expanded && isMultiple && (
          <div className="mt-2 ml-1 border-l-2 border-stone-100 pl-3 space-y-1">
            {group.entries.map((e) => {
              const { main: em, detail: ed, entityName: en } = buildRichDesc(e);
              const isViewCompany = e.action === 'view_company';
              return (
                <div key={e.id} className="text-[11px] text-[#6b6b6b]">
                  {em}
                  {en ? (
                    isViewCompany ? (
                      <Link
                        to={`/admin/companies?search=${encodeURIComponent(en)}`}
                        className="text-[#B8864A] ml-1 hover:underline"
                        onClick={(ev) => ev.stopPropagation()}
                      >{en}</Link>
                    ) : (
                      <span className="text-[#B8864A] ml-1">{en}</span>
                    )
                  ) : null}
                  {ed ? <span className="text-stone-400"> — {ed}</span> : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Right Sidebar ────────────────────────────────────────────────────────────

function TopUserRow({ user, rank: _rank, onClick }: { user: TopUser; rank: number; onClick: () => void }) {
  const letter = (user.user_name || '?')[0].toUpperCase();
  const avatarCls = user.user_role === 'company' ? 'bg-amber-50 text-amber-700'
    : user.user_role === 'homeowner' ? 'bg-blue-50 text-blue-600'
    : 'bg-emerald-50 text-emerald-700';
  const roleLabel = user.user_role === 'company' ? '装企' : user.user_role === 'homeowner' ? '业主' : 'Admin';

  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 py-2 border-b border-stone-100 last:border-0 hover:bg-stone-50 rounded-lg px-1 transition-colors text-left">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarCls}`}>{letter}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1c1917] truncate">{user.user_name || `用户 #${user.user_id}`}</p>
        <p className="text-[11px] text-stone-400">{roleLabel}</p>
        {/* Mini activity bar */}
        <div className="w-full h-1 bg-stone-100 rounded mt-1">
          <div className="h-full bg-[#B8864A] rounded" style={{ width: `${Math.min(100, (user.event_count / 20) * 100)}%` }} />
        </div>
      </div>
      <span className="text-sm font-bold text-[#B8864A] shrink-0">{user.event_count}次</span>
    </button>
  );
}

function ActionBarChart({ data }: { data: ActionDistribution[] }) {
  const top = data.slice(0, 6);
  const max = top.reduce((m, d) => Math.max(m, d.count), 1);
  return (
    <div className="space-y-2.5">
      {top.map((d) => (
        <div key={d.action} className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: ACTION_BAR_COLORS[d.action] || ACTION_BAR_COLORS.default }} />
          <span className="text-stone-600 w-20 truncate shrink-0">{ACTION_LABELS[d.action] || d.action}</span>
          <div className="flex-1 h-1.5 bg-stone-100 rounded">
            <div className="h-full rounded" style={{ width: `${(d.count / max) * 100}%`, background: ACTION_BAR_COLORS[d.action] || ACTION_BAR_COLORS.default }} />
          </div>
          <span className="text-stone-400 w-5 text-right shrink-0">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminActivityLogPage() {
  const navigate = useNavigate();

  const [todayStats, setTodayStats] = useState<TodayStats>({ total: 0, active_companies: 0, active_homeowners: 0, admin_actions: 0 });
  const [actionDist, setActionDist] = useState<ActionDistribution[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [topUsersLoading, setTopUsersLoading] = useState(true);

  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [logsLoading, setLogsLoading] = useState(true);

  const [roleFilter, setRoleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);

  // ── Fetch stats ─────────────────────────────────────────────────────────

  useEffect(() => {
    let c = false;
    setStatsLoading(true);
    adminApi.getActivityLogStats(7).then((data) => {
      if (c) return;
      setTodayStats(data.today || { total: 0, active_companies: 0, active_homeowners: 0, admin_actions: 0 });
      setActionDist(data.action_distribution || []);
    }).catch(() => {}).finally(() => { if (!c) setStatsLoading(false); });
    return () => { c = true; };
  }, []);

  // ── Fetch top users ──────────────────────────────────────────────────────

  useEffect(() => {
    let c = false;
    setTopUsersLoading(true);
    adminApi.getTopActiveUsers(1).then((data) => {  // today's top
      if (c) return;
      setTopUsers(data.users || []);
    }).catch(() => {}).finally(() => { if (!c) setTopUsersLoading(false); });
    return () => { c = true; };
  }, []);

  // ── Fetch logs ───────────────────────────────────────────────────────────

  const fetchLogs = useCallback(() => {
    setLogsLoading(true);
    adminApi.getActivityLog({ page, limit: PAGE_SIZE, role: roleFilter || undefined, action: actionFilter || undefined })
      .then((data) => {
        setLogs(data.logs || []);
        setPagination({ page: data.pagination?.page ?? 1, total: data.pagination?.total ?? 0, totalPages: data.pagination?.totalPages ?? 0 });
      })
      .catch(() => setLogs([]))
      .finally(() => setLogsLoading(false));
  }, [page, roleFilter, actionFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { setPage(1); }, [roleFilter, actionFilter]);

  // ── Aggregate + group by date ────────────────────────────────────────────

  const groupedByDate = useMemo(() => {
    const agg = new Map<string, ActivityLogEntry[]>();
    for (const e of logs) {
      const k = `${e.user_id ?? 'null'}_${extractDate(e.created_at)}_${e.action}_${e.target_type ?? 'null'}`;
      const a = agg.get(k) || []; a.push(e); agg.set(k, a);
    }
    const groups: AggregatedGroup[] = [];
    for (const [key, entries] of agg) {
      const l = entries[0];
      groups.push({ key, entries, user_id: l.user_id, user_name: l.user_name, user_role: l.user_role, action: l.action, target_type: l.target_type, date: extractDate(l.created_at), latest: l });
    }
    const byDate = new Map<string, AggregatedGroup[]>();
    for (const g of groups) { const a = byDate.get(g.date) || []; a.push(g); byDate.set(g.date, a); }
    return Array.from(byDate.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [logs]);

  const handleExport = () => window.open(adminApi.getActivityLogExportUrl({ role: roleFilter || undefined, action: actionFilter || undefined }), '_blank');

  // Detect "anomalous" users (edited > 2 times today in top users)
  const warningUser = topUsers.find((u) => u.event_count >= 3 && u.user_role === 'company');

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#2c2c2c]">用户行为监控</h1>
          <p className="text-xs text-stone-500 mt-0.5">实时追踪业主、装企、管理员的所有关键操作</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={fetchLogs} className="h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs text-stone-600 hover:bg-stone-50 transition-colors">⟳ 刷新</button>
          <button onClick={handleExport} className="h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs text-stone-600 hover:bg-stone-50 transition-colors">导出 CSV</button>
        </div>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
          <p className="text-xs text-stone-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-stone-400 inline-block" />今日操作总数</p>
          <p className="text-3xl font-bold text-[#2c2c2c] mt-1">{statsLoading ? '—' : todayStats.total}</p>
        </div>
        {/* Active companies */}
        <div className="bg-white rounded-2xl border-2 border-amber-300 shadow-sm p-4">
          <p className="text-xs text-stone-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            活跃装企
            <span className="ml-1 text-[10px] font-semibold text-amber-600 bg-amber-50 rounded px-1">可点</span>
          </p>
          <p className="text-3xl font-bold text-amber-600 mt-1">{statsLoading ? '—' : todayStats.active_companies}</p>
          {topUsers.filter((u) => u.user_role === 'company').length > 0 && (
            <p className="text-[11px] text-stone-400 mt-1 truncate">
              {topUsers.filter((u) => u.user_role === 'company').slice(0, 2).map((u) => u.user_name || `#${u.user_id}`).join('、')}
            </p>
          )}
        </div>
        {/* Active homeowners */}
        <div className="bg-white rounded-2xl border-2 border-blue-300 shadow-sm p-4">
          <p className="text-xs text-stone-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            活跃业主
            <span className="ml-1 text-[10px] font-semibold text-blue-600 bg-blue-50 rounded px-1">可点</span>
          </p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{statsLoading ? '—' : todayStats.active_homeowners}</p>
          {topUsers.filter((u) => u.user_role === 'homeowner').length > 0 && (
            <p className="text-[11px] text-stone-400 mt-1 truncate">
              {topUsers.filter((u) => u.user_role === 'homeowner').slice(0, 2).map((u) => u.user_name || `#${u.user_id}`).join('、')}
            </p>
          )}
        </div>
        {/* Admin actions */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
          <p className="text-xs text-stone-500 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />管理员操作</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{statsLoading ? '—' : todayStats.admin_actions}</p>
          {topUsers.filter((u) => u.user_role === 'admin').length > 0 && (
            <p className="text-[11px] text-stone-400 mt-1 truncate">
              {topUsers.filter((u) => u.user_role === 'admin').slice(0, 2).map((u) => `${u.user_name || `#${u.user_id}`} (${u.event_count})`).join('、')}
            </p>
          )}
        </div>
      </div>

      {/* ── Main content: feed + right sidebar ───────────────────────────── */}
      <div className="flex gap-5 items-start">

        {/* Left: toolbar + feed */}
        <div className="flex-1 min-w-0 space-y-3">

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Role tabs */}
            <div className="flex gap-0.5 bg-stone-100 rounded-lg p-0.5 shrink-0">
              {ROLE_TABS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => { setRoleFilter(t.value); setPage(1); }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${roleFilter === t.value ? 'bg-white text-[#B8864A] shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {/* Action filter */}
            <AdminSelect size="sm" value={actionFilter} onChange={setActionFilter} options={ACTION_OPTIONS} />
          </div>

          {/* Feed */}
          {logsLoading ? (
            <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} className="h-[62px] px-4 py-3 flex gap-3 items-center"><div className="w-8 h-8 rounded-full bg-stone-100 animate-pulse shrink-0" /><div className="flex-1 space-y-1.5"><div className="h-3 bg-stone-100 rounded animate-pulse w-2/5" /><div className="h-2.5 bg-stone-100 rounded animate-pulse w-3/4" /></div></div>)}
            </div>
          ) : groupedByDate.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-sm text-stone-400">暂无操作记录</div>
          ) : (
            <div className="space-y-4">
              {groupedByDate.map(([date, groups]) => (
                <div key={date} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                  <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide py-2 px-4 border-b border-stone-100 bg-stone-50/60">{formatDateLabel(date)}</p>
                  <div className="px-3">
                    {groups.map((g) => (
                      <AggregatedEntry
                        key={g.key}
                        group={g}
                        onUserClick={(uid, role) => navigate(`/admin/activity-log/user/${uid}${role ? `?role=${role}` : ''}`)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-stone-500 pt-2">
              <span>共 {pagination.total} 条</span>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="h-9 px-4 rounded-xl border border-stone-200 bg-white text-sm disabled:opacity-40 hover:bg-stone-50 transition-colors">上一页</button>
                <span>第 {page} / {pagination.totalPages} 页</span>
                <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} className="h-9 px-4 rounded-xl border border-stone-200 bg-white text-sm disabled:opacity-40 hover:bg-stone-50 transition-colors">下一页</button>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-[260px] shrink-0 hidden lg:flex flex-col gap-3">

          {/* Top active users (today) */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
            <h3 className="text-sm font-bold text-[#1c1917] mb-3">今日最活跃用户</h3>
            {topUsersLoading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 rounded-xl bg-stone-100 animate-pulse" />)}</div>
            ) : topUsers.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-4">暂无数据</p>
            ) : (
              <div>
                {topUsers.slice(0, 5).map((u, i) => (
                  <TopUserRow
                    key={`${u.user_id}-${u.user_role}`}
                    user={u}
                    rank={i + 1}
                    onClick={() => navigate(`/admin/activity-log/user/${u.user_id}?role=${u.user_role}`)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Action type distribution (today) */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-4">
            <h3 className="text-sm font-bold text-[#1c1917] mb-3">操作类型分布（今日）</h3>
            {statsLoading ? (
              <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-4 rounded bg-stone-100 animate-pulse" />)}</div>
            ) : actionDist.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-4">暂无数据</p>
            ) : (
              <ActionBarChart data={actionDist} />
            )}
          </div>

          {/* Warning card */}
          {warningUser && (
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
              <p className="text-sm font-bold text-amber-800 mb-1">⚠️ 注意</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                <strong>{warningUser.user_name}</strong> 今日操作了 <strong>{warningUser.event_count} 次</strong>，频率偏高，可能正在反复调试 profile。
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
