'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Info } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import { TableSpinner } from '@/components/ui/Spinner';
import AdminSelect from '@/components/ui/AdminSelect';
import { formatAdminDateTime, ADMIN_TIME_CLS } from '@/lib/formatTime';
import BackToAnalytics from '@/components/admin/BackToAnalytics';
import { useAdminCountry } from '@/contexts/AdminCountryContext';

/* ── Floating Tooltip（与 inquiries 页同模式：fixed 定位，逃出表格 overflow）── */
function FloatingTip({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const show = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ top: r.top + r.height / 2, left: r.right + 8 });
  };
  return (
    <>
      <span ref={ref} className="inline-flex cursor-help" onMouseEnter={show} onMouseLeave={() => setPos(null)}>
        {icon || <Info className="w-3.5 h-3.5 text-stone-400" />}
      </span>
      {pos && (
        <div
          className="fixed z-[9999] w-72 rounded-lg border border-stone-200 bg-white p-3 text-[12px] leading-relaxed text-stone-700 shadow-xl whitespace-normal"
          style={{ top: pos.top, left: pos.left, transform: 'translateY(-50%)' }}
        >
          {children}
        </div>
      )}
    </>
  );
}

type RequestType = 'sample' | 'visit' | 'sourcing' | 'designer_partner';
type RequestStatus = 'new' | 'contacted' | 'completed' | 'rejected';
type TypeFilter = 'all' | RequestType;
type StatusFilter = 'all' | RequestStatus;

interface SourcingRequestRecord {
  id: number;
  request_type: RequestType;
  name: string;
  phone: string;
  email: string | null;
  company_name: string | null;
  city: string | null;
  message: string | null;
  preferred_date: string | null;
  product_id: number | null;
  supplier_profile_id: number | null;
  /** 后端 JOIN 带出（国家一致性条件保护，跨国引用时为 null） */
  product_title: string | null;
  supplier_name: string | null;
  source_page: string | null;
  country: string;
  status: RequestStatus;
  created_at: string;
}

interface StatusCounts {
  new?: number;
  contacted?: number;
  completed?: number;
  rejected?: number;
}

const TYPE_TABS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'sample', label: '样品申请' },
  { value: 'visit', label: '到店预约' },
  { value: 'sourcing', label: '采购咨询' },
  { value: 'designer_partner', label: '设计师合作' },
];

const TYPE_BADGE: Record<RequestType, string> = {
  sample: 'bg-blue-100 text-blue-700',
  visit: 'bg-purple-100 text-purple-700',
  sourcing: 'bg-amber-100 text-amber-700',
  designer_partner: 'bg-emerald-100 text-emerald-700',
};

const TYPE_LABEL: Record<RequestType, string> = {
  sample: '样品申请',
  visit: '到店预约',
  sourcing: '采购咨询',
  designer_partner: '设计师合作',
};

const STATUS_BADGE: Record<RequestStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-green-700',
  rejected: 'bg-stone-100 text-stone-500',
};

const STATUS_LABEL: Record<RequestStatus, string> = {
  new: '新',
  contacted: '已联系',
  completed: '已完成',
  rejected: '已拒绝',
};

const STATUS_OPTIONS: { value: RequestStatus; label: string }[] = [
  { value: 'new', label: '新' },
  { value: 'contacted', label: '已联系' },
  { value: 'completed', label: '已完成' },
  { value: 'rejected', label: '已拒绝' },
];

const COUNTRY_FLAG: Record<string, string> = { ae: '🇦🇪', vn: '🇻🇳', sa: '🇸🇦' };

const PAGE_SIZE = 20;

function isTypeFilter(v: string | null): v is TypeFilter {
  return v === 'all' || v === 'sample' || v === 'visit' || v === 'sourcing' || v === 'designer_partner';
}
function isStatusFilter(v: string | null): v is StatusFilter {
  return v === 'all' || v === 'new' || v === 'contacted' || v === 'completed' || v === 'rejected';
}

export default function AdminSourcingRequestsPage() {
  const { country } = useAdminCountry();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [requests, setRequests] = useState<SourcingRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<StatusCounts>({});
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get('page') || '1')));
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(() => {
    const t = searchParams.get('type');
    return isTypeFilter(t) ? t : 'all';
  });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const s = searchParams.get('status');
    return isStatusFilter(s) ? s : 'all';
  });
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), country });
      if (typeFilter !== 'all') query.set('type', typeFilter);
      if (statusFilter !== 'all') query.set('status', statusFilter);
      const result = await adminApi.request(`/sourcing-requests?${query.toString()}`);
      setRequests(result.requests || []);
      setTotal(result.pagination?.total ?? 0);
      setCounts(result.counts || {});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '加载采购线索失败');
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, statusFilter, country]);

  // country 切换必须重置分页（国家隔离铁律）
  useEffect(() => { setPage(1); }, [country]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  // URL 同步（对齐 inquiries 页模式）
  useEffect(() => {
    const params: Record<string, string> = {};
    if (page > 1) params.page = String(page);
    if (typeFilter !== 'all') params.type = typeFilter;
    if (statusFilter !== 'all') params.status = statusFilter;
    const qs = new URLSearchParams(params).toString();
    router.replace('/admin/sourcing-requests' + (qs ? '?' + qs : ''));
  }, [page, typeFilter, statusFilter, router]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleStatusChange = async (id: number, status: RequestStatus) => {
    setUpdatingId(id);
    try {
      // 带上当前 admin 国家（国家隔离铁律：后端按 country 作用域更新，防跨国改单；超管切国家也随之带对）
      await adminApi.request(`/sourcing-requests/${id}/status?country=${encodeURIComponent(country)}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      // 重新加载：保证列表（受状态筛选影响）与计数徽标同步
      await loadRequests();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '更新状态失败');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <BackToAnalytics />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#2c2c2c]">采购线索</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TYPE_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => { setTypeFilter(tab.value); setPage(1); }}
            className={`h-9 rounded-2xl px-4 text-sm font-medium transition ${typeFilter === tab.value
              ? 'bg-[#b8864a] text-white'
              : 'border border-stone-200 text-stone-600 hover:bg-stone-50'}`}
          >
            {tab.label}
          </button>
        ))}

        <div className="w-px h-5 bg-stone-200" />

        <AdminSelect
          className="!h-9 !px-3 !text-sm w-32"
          size="sm"
          value={statusFilter}
          onChange={(val) => { setStatusFilter(val as StatusFilter); setPage(1); }}
          options={[
            { value: 'all', label: '全部状态' },
            ...STATUS_OPTIONS,
          ]}
        />

        {/* 各状态计数徽标（点击即筛选） */}
        <div className="flex items-center gap-1.5">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setStatusFilter(opt.value); setPage(1); }}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition ${STATUS_BADGE[opt.value]} ${statusFilter === opt.value ? 'ring-2 ring-[#b8864a]/40' : 'hover:opacity-80'}`}
              title={`筛选「${opt.label}」`}
            >
              {opt.label} {counts[opt.value] ?? 0}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="text-red-600 bg-red-50 px-4 py-2 rounded-lg text-sm">{error}</div>}

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-4 py-3 font-medium text-stone-600">类型</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">姓名</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">电话</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">城市</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">关联产品</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">留言</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">预约日期</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">来源页</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">国家</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">状态</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">创建时间</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSpinner colSpan={12} />
              ) : requests.length === 0 ? (
                <tr><td colSpan={12} className="text-center py-12 text-stone-400">暂无采购线索</td></tr>
              ) : requests.map((req) => (
                <tr key={req.id} className="border-b border-stone-100 hover:bg-stone-50 transition">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[req.request_type] || 'bg-stone-100 text-stone-500'}`}>
                      {TYPE_LABEL[req.request_type] || req.request_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-stone-800 whitespace-nowrap">
                    <div>{req.name || <span className="text-stone-400">—</span>}</div>
                    {req.company_name && <div className="text-[11px] text-stone-400 font-normal">{req.company_name}</div>}
                  </td>
                  <td className="px-4 py-3 text-stone-600 whitespace-nowrap">
                    <div>{req.phone}</div>
                    {req.email && <div className="text-[11px] text-stone-400">{req.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{req.city || <span className="text-stone-400">—</span>}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {req.product_id ? (
                      <a
                        href={`/materials/products/${req.product_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#b8864a] font-medium hover:underline"
                        title={req.product_title || undefined}
                      >{req.product_title ? `${req.product_title.slice(0, 24)}${req.product_title.length > 24 ? '…' : ''}` : `#${req.product_id}`}</a>
                    ) : req.supplier_name ? (
                      <span className="text-stone-600">{req.supplier_name}</span>
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-600 max-w-[200px]">
                    {req.message ? (
                      <span className="inline-flex items-center gap-1 max-w-full">
                        <span className="truncate max-w-[160px]">{req.message}</span>
                        <FloatingTip>{req.message}</FloatingTip>
                      </span>
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-stone-600 whitespace-nowrap">
                    {req.request_type === 'visit' && req.preferred_date
                      ? req.preferred_date
                      : <span className="text-stone-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-500 max-w-[140px]">
                    {req.source_page
                      ? <span className="block truncate" title={req.source_page}>{req.source_page}</span>
                      : <span className="text-stone-400">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {COUNTRY_FLAG[req.country] || req.country?.toUpperCase() || '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[req.status] || 'bg-stone-100 text-stone-500'}`}>
                      {STATUS_LABEL[req.status] || req.status}
                    </span>
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap ${ADMIN_TIME_CLS}`}>
                    {formatAdminDateTime(req.created_at)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <AdminSelect
                      className="w-28"
                      size="sm"
                      disabled={updatingId === req.id}
                      value={req.status}
                      onChange={(val) => {
                        if (val !== req.status) handleStatusChange(req.id, val as RequestStatus);
                      }}
                      options={STATUS_OPTIONS}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100">
            <span className="text-xs text-stone-500">第 {page} / {totalPages} 页（共 {total} 条）</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">上一页</button>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">下一页</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
