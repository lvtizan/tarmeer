'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Info, Trash2, FileDown } from 'lucide-react';
import CopyButton from '@/components/ui/CopyButton';
import { adminApi } from '@/lib/adminApi';
import { TableSpinner } from '@/components/ui/Spinner';
import AdminSelect from '@/components/ui/AdminSelect';
import { formatAdminDateTime, ADMIN_TIME_CLS } from '@/lib/formatTime';
import BackToAnalytics from '@/components/admin/BackToAnalytics';
import { useAdminCountry } from '@/contexts/AdminCountryContext';

/* ── Floating Tooltip (portal-free, renders outside table overflow) ── */
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

const CRM_ACTION_TOOLTIP: Record<string, string> = {
  created: '✅ 已在 CRM 创建新线索，销售可正常跟进。',
  updated: '🔄 该联系人在 CRM 已有线索，本次询盘信息已合并更新到原线索。',
  linked: '⚠️ 该联系人（手机号/邮箱）在 CRM 中已存在，本次询盘被自动合并到原线索。CRM 团队不会收到新线索通知，请手动在 CRM 中查看并跟进！',
  duplicate: '🔁 同一联系人短时间内已有未处理线索，系统自动判定为重复，未创建新线索。',
  synced: '✅ 已成功同步到 CRM。',
};
const CRM_STATUS_TOOLTIP = {
  failed: 'CRM 同步失败',
  pending: '尚未同步到 CRM',
};

type StatusFilter = 'all' | 'new' | 'contacted' | 'resolved' | 'archived';
type TypeFilter = 'homeowner' | 'company';

interface InquiryRecord {
  id: number;
  name: string | null;
  phone: string;
  city: string | null;
  area_range: string;
  message: string | null;
  designer_id: number | null;
  company_id: number | null;
  designer_name: string | null;
  company_name: string | null;
  source_company_name: string | null;
  source_company_slug: string | null;
  status: 'new' | 'contacted' | 'resolved' | 'archived';
  admin_notes: string | null;
  created_at: string;
  crm_synced_at: string | null;
  crm_sync_status: 'pending' | 'synced' | 'failed' | null;
  crm_lead_id: string | null;
  crm_action: string | null;
  crm_last_error: string | null;
  crm_sync_attempts: number | null;
  deleted_at?: string | null;
  deleted_reason?: string | null;
  dup_count?: number;
}

const STATUS_BADGE: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  archived: 'bg-stone-100 text-stone-500',
};

const STATUS_LABEL: Record<string, string> = {
  new: '新询单',
  contacted: '已联系',
  resolved: '已解决',
  archived: '已归档',
};

const CRM_LABEL: Record<string, string> = {
  pending: '待同步',
  synced: '已同步',
  failed: '同步失败',
  created: '已创建',
  updated: '已更新',
  linked: '已关联',
  duplicate: '重复',
};

export default function AdminInquiriesPage() {
  const { country } = useAdminCountry();
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateSearchParams = (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    router.replace('/admin/inquiries' + (qs ? '?' + qs : ''));
  };

  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get('page') || '1')));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const s = searchParams.get('status');
    return s === 'new' || s === 'contacted' || s === 'resolved' || s === 'archived' ? s : 'all';
  });
  const [search] = useState(() => searchParams.get('search') || '');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(() => {
    const t = searchParams.get('type');
    return t === 'homeowner' || t === 'company' ? t : 'homeowner';
  });
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<'active' | 'deleted'>('active');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  const loadInquiries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminApi.getInquiries({
        page, limit: 20,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search || undefined,
        deleted: viewMode === 'deleted',
        type: typeFilter,
        country,
      });
      setInquiries(result.inquiries);
      setTotal(result.pagination.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load inquiries.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, viewMode, typeFilter, country]);

  useEffect(() => {
    setSelected(new Set());
    setPage(1);
    if (typeFilter === 'company' && ['contacted', 'resolved', 'archived'].includes(statusFilter)) {
      setStatusFilter('all');
    }
  }, [viewMode, typeFilter]);

  useEffect(() => { setPage(1); }, [country]);

  useEffect(() => { loadInquiries(); }, [loadInquiries]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (page > 1) params.page = String(page);
    if (statusFilter !== 'all') params.status = statusFilter;
    if (typeFilter !== 'homeowner') params.type = typeFilter;
    if (search) params.search = search;
    updateSearchParams(params);
  }, [page, statusFilter, typeFilter, search]);

  const totalPages = Math.ceil(total / 20);

  const handleExport = () => {
    const url = adminApi.getInquiriesExportUrl({
      status: statusFilter === 'all' ? undefined : statusFilter,
      country,
    });
    window.open(url, '_blank');
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = inquiries.length > 0 && inquiries.every((inq) => selected.has(inq.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(inquiries.map((inq) => inq.id)));
    }
  };

  const handleBatchDelete = async () => {
    try {
      await adminApi.batchDeleteInquiries([...selected], deleteReason.trim());
      setSelected(new Set());
      setDeleteModalOpen(false);
      setDeleteReason('');
      loadInquiries();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete inquiries.');
    }
  };

  const handleBatchRestore = async () => {
    await adminApi.batchRestoreInquiries([...selected]);
    setSelected(new Set());
    loadInquiries();
  };

  const [counts, setCounts] = useState<{ homeowner: number; company: number }>({ homeowner: 0, company: 0 });
  useEffect(() => {
    (async () => {
      try {
        const [homeownerRes, companyRes] = await Promise.all([
          adminApi.getInquiries({ page: 1, limit: 1, type: 'homeowner', deleted: viewMode === 'deleted' }),
          adminApi.getInquiries({ page: 1, limit: 1, type: 'company', deleted: viewMode === 'deleted' }),
        ]);
        setCounts({
          homeowner: homeownerRes.pagination.total,
          company: companyRes.pagination.total,
        });
      } catch {
        // non-blocking; leave counts at 0
      }
    })();
  }, [viewMode]);

  return (
    <div className="space-y-4">
      <BackToAnalytics />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#2c2c2c]">线索管理</h1>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => { setTypeFilter('homeowner'); setPage(1); }}
          className={`h-9 rounded-2xl px-4 text-sm font-medium transition ${typeFilter === 'homeowner'
            ? 'bg-[#b8864a] text-white'
            : 'border border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
          业主询单 ({counts.homeowner})
        </button>
        <button onClick={() => { setTypeFilter('company'); setPage(1); }}
          className={`h-9 rounded-2xl px-4 text-sm font-medium transition ${typeFilter === 'company'
            ? 'bg-[#b8864a] text-white'
            : 'border border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
          公司线索 ({counts.company})
        </button>

        <div className="w-px h-5 bg-stone-200" />

        <AdminSelect
          className="!h-9 !px-3 !text-sm"
          value={viewMode === 'deleted' ? 'deleted' : statusFilter}
          onChange={(val) => {
            if (val === 'deleted') {
              setViewMode('deleted');
              setStatusFilter('all');
            } else {
              setViewMode('active');
              setStatusFilter(val as StatusFilter);
            }
            setPage(1);
          }}
          options={typeFilter === 'company' ? [
            { value: 'all', label: '全部状态' },
            { value: 'new', label: '新询单' },
            { value: 'deleted', label: '已删除' },
          ] : [
            { value: 'all', label: '全部状态' },
            { value: 'new', label: '新询单' },
            { value: 'contacted', label: '已联系' },
            { value: 'resolved', label: '已解决' },
            { value: 'archived', label: '已归档' },
            { value: 'deleted', label: '已删除' },
          ]}
        />
      </div>

      {error && <div className="text-red-600 bg-red-50 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {selected.size > 0 && (
        <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-2xl px-4 h-11">
          {viewMode === 'active' ? (
            <>
              <button
                onClick={() => setDeleteModalOpen(true)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-red-200 bg-white text-red-600 text-sm font-medium hover:bg-red-50 transition"
              >
                <Trash2 size={14} /> 删除 ({selected.size})
              </button>
              <button
                onClick={handleExport}
                className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-stone-200 bg-white text-stone-600 text-sm font-medium hover:bg-stone-50 transition"
              >
                <FileDown size={14} /> 导出 Excel ({selected.size})
              </button>
            </>
          ) : (
            <button
              onClick={handleBatchRestore}
              className="h-8 px-4 text-sm text-white bg-[#b8864a] rounded-xl hover:bg-[#a07840] transition"
            >
              恢复 ({selected.size})
            </button>
          )}
        </div>
      )}

      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-[400px]">
            <h3 className="font-serif text-lg mb-4">Delete {selected.size} inquiry(s)</h3>
            <textarea
              className="w-full h-24 px-4 py-3 rounded-2xl border border-stone-200 text-[15px] mb-4"
              placeholder="Enter deletion reason (required)"
              value={deleteReason}
              onChange={e => setDeleteReason(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => { setDeleteModalOpen(false); setDeleteReason(''); }}
                className="px-4 py-2 text-sm text-stone-600 border border-stone-200 rounded-2xl">Cancel</button>
              <button onClick={handleBatchDelete} disabled={!deleteReason.trim()}
                className="px-4 py-2 text-sm text-white bg-[#8b2525] hover:bg-[#6b1d1d] rounded-2xl disabled:opacity-50 transition">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="px-4 py-3 w-10"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">City</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">{typeFilter === 'company' ? '服务范围' : '面积'}</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">{typeFilter === 'company' ? '公司名' : '来源'}</th>
                {typeFilter !== 'company' && <th className="text-left px-4 py-3 font-medium text-stone-600">Status</th>}
                <th className="text-left px-4 py-3 font-medium text-stone-600">CRM</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSpinner colSpan={typeFilter === 'company' ? 8 : 9} />
              ) : inquiries.length === 0 ? (
                <tr><td colSpan={typeFilter === 'company' ? 8 : 9} className="text-center py-12 text-stone-400">No inquiries found</td></tr>
              ) : inquiries.map((inq) => (
                <>
                  <tr
                    key={inq.id}
                    className="group border-b border-stone-100 hover:bg-stone-50 transition"
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(inq.id)} onChange={() => toggleSelect(inq.id)} />
                    </td>
                    <td className="px-4 py-3 font-medium text-stone-800 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {inq.name || <span className="text-stone-400">—</span>}
                        {inq.name && <CopyButton text={inq.name} />}
                        {inq.deleted_at && (
                          <span onClick={(e) => e.stopPropagation()}>
                            <FloatingTip icon={<Info className="w-3.5 h-3.5 text-red-400" />}>
                              <div className="font-semibold text-red-600 mb-1">删除理由</div>
                              <div>{inq.deleted_reason || '—（无记录）'}</div>
                              <div className="text-stone-400 mt-1 text-[11px]">
                                删除时间：{formatAdminDateTime(inq.deleted_at)}
                              </div>
                            </FloatingTip>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-stone-600 whitespace-nowrap">
                      {inq.phone}
                      {(inq.dup_count || 0) > 1 && (
                        <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-500">×{inq.dup_count}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{inq.city || <span className="text-stone-400">—</span>}</td>
                    <td className="px-4 py-3 text-stone-600">{(() => {
                      const fromMessage = inq.message?.match(/Area[:：]?\s*([\d,]+)\s*m²/i);
                      if (fromMessage) return `${fromMessage[1]}m²`;
                      return inq.area_range?.replace(/\+$/, '') || '—';
                    })()}</td>
                    <td className="px-4 py-3 text-xs max-w-[180px]">
                      {inq.source_company_name ? (
                        <a
                          href={inq.source_company_slug
                            ? `/companies/${inq.source_company_slug}`
                            : `https://www.google.com/search?q=${encodeURIComponent(inq.source_company_name + ' UAE')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[#b8864a] font-medium hover:underline block truncate"
                          title={inq.source_company_name}
                        >{inq.source_company_name}</a>
                      ) : (
                        <span className="text-stone-400">Homepage</span>
                      )}
                    </td>
                    {typeFilter !== 'company' && (
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[inq.status]}`}>
                          {STATUS_LABEL[inq.status] || inq.status}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const status = inq.crm_sync_status;
                        const action = inq.crm_action;

                        if (status === 'synced') {
                          const isLinked = action === 'linked';
                          const badgeClass = isLinked
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-green-50 text-green-700';
                          const label = action ? (CRM_LABEL[action] || action) : '已同步';
                          const tip = (action && CRM_ACTION_TOOLTIP[action]) || CRM_ACTION_TOOLTIP.synced;
                          return (
                            <div className="flex flex-col items-start gap-1">
                              <span className="inline-flex items-center gap-1">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}
                                  title={inq.crm_lead_id ? `CRM lead: ${inq.crm_lead_id}` : undefined}
                                >
                                  {label}
                                </span>
                                <FloatingTip>{tip}</FloatingTip>
                              </span>
                              {isLinked && (
                                <span className="text-[10px] text-amber-600">已合并 → 请检查</span>
                              )}
                            </div>
                          );
                        }

                        if (status === 'failed') {
                          return (
                            <span className="inline-flex items-center gap-1">
                              <span
                                className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200"
                                title={inq.crm_last_error || undefined}
                              >
                                同步失败
                              </span>
                              <FloatingTip>{CRM_STATUS_TOOLTIP.failed}</FloatingTip>
                            </span>
                          );
                        }

                        return (
                          <span className="inline-flex items-center gap-1">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-500">
                              待同步
                            </span>
                            <FloatingTip>{CRM_STATUS_TOOLTIP.pending}</FloatingTip>
                          </span>
                        );
                      })()}
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap ${ADMIN_TIME_CLS}`}>
                      {formatAdminDateTime(inq.created_at)}
                    </td>
                  </tr>
                </>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100">
            <span className="text-xs text-stone-500">Page {page} of {totalPages} ({total} total)</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">Prev</button>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
