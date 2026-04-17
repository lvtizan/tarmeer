import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Info } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { TableSpinner } from '../../components/ui/Spinner';
import AdminSelect from '../../components/ui/AdminSelect';

const CRM_ACTION_TOOLTIP: Record<string, string> = {
  created: '✅ 已在 CRM 创建新线索，销售可正常跟进。',
  updated: '🔄 该联系人在 CRM 已有线索，本次询盘信息已合并更新到原线索。',
  linked: '⚠️ 该联系人（手机号/邮箱）在 CRM 中已存在，本次询盘被自动合并到原线索。CRM 团队不会收到新线索通知，请手动在 CRM 中查看并跟进！',
  duplicate: '🔁 同一联系人短时间内已有未处理线索，系统自动判定为重复，未创建新线索。',
  synced: '✅ 已成功同步到 CRM。',
};
const CRM_STATUS_TOOLTIP = {
  failed: 'CRM 同步失败，可点击「重新发送」重试',
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
  // CRM sync state
  crm_synced_at: string | null;
  crm_sync_status: 'pending' | 'synced' | 'failed' | null;
  crm_lead_id: string | null;
  crm_action: string | null;
  crm_last_error: string | null;
  crm_sync_attempts: number | null;
  deleted_at?: string | null;
  deleted_reason?: string | null;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get('page') || '1')));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const s = searchParams.get('status');
    return s === 'new' || s === 'contacted' || s === 'resolved' || s === 'archived' ? s : 'all';
  });
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(() => {
    const t = searchParams.get('type');
    return t === 'homeowner' || t === 'company' ? t : 'homeowner';
  });
  const [error, setError] = useState('');

  // Expanded detail
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [updating, setUpdating] = useState(false);

  // Batch delete / recycle bin
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
      });
      setInquiries(result.inquiries);
      setTotal(result.pagination.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load inquiries.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, viewMode, typeFilter]);

  // Clear selection when viewMode or typeFilter changes
  useEffect(() => {
    setSelected(new Set());
    setPage(1);
  }, [viewMode, typeFilter]);

  useEffect(() => { loadInquiries(); }, [loadInquiries]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (page > 1) params.page = String(page);
    if (statusFilter !== 'all') params.status = statusFilter;
    if (typeFilter !== 'homeowner') params.type = typeFilter;
    if (search) params.search = search;
    setSearchParams(params, { replace: true });
  }, [page, statusFilter, typeFilter, search, setSearchParams]);

  const totalPages = Math.ceil(total / 20);

  const handleExpand = (inquiry: InquiryRecord) => {
    if (expandedId === inquiry.id) {
      setExpandedId(null);
    } else {
      setExpandedId(inquiry.id);
      setEditNotes(inquiry.admin_notes || '');
      setEditStatus(inquiry.status);
    }
  };

  const handleUpdate = async (id: number) => {
    setUpdating(true);
    try {
      await adminApi.updateInquiryStatus(id, editStatus, editNotes);
      setExpandedId(null);
      loadInquiries();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleExport = () => {
    const url = adminApi.getInquiriesExportUrl({
      status: statusFilter === 'all' ? undefined : statusFilter,
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
    } catch (err: any) {
      alert(err.message || 'Failed to delete inquiries.');
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

  const [resendingId, setResendingId] = useState<number | null>(null);
  const handleResendCrm = async (id: number) => {
    setResendingId(id);
    try {
      const result: any = await adminApi.resendInquiryCrm(id);
      if (result?.success) {
        alert(`CRM sync OK: action=${result.action}, leadId=${result.leadId}`);
      } else {
        alert(`CRM sync failed: ${result?.error || 'unknown error'}`);
      }
      loadInquiries();
    } catch (err: any) {
      alert(`CRM sync error: ${err.message || err}`);
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Row 1: Title + Export */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#2c2c2c]">线索管理</h1>
        <button onClick={handleExport} className="btn-primary h-9 px-5 text-sm rounded-2xl">
          导出 Excel
        </button>
      </div>

      {/* Row 2: Type tabs | Status + Search | Active/Deleted toggle — all h-9 */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Type tabs with badge counts */}
        <div className="flex gap-2">
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
        </div>

        {/* Status dropdown */}
        <AdminSelect
          className="!h-9 !px-3 !text-sm"
          value={statusFilter}
          onChange={(val) => { setStatusFilter(val as StatusFilter); setPage(1); }}
          options={[
            { value: 'all', label: '全部状态' },
            { value: 'new', label: '新询单' },
            { value: 'contacted', label: '已联系' },
            { value: 'resolved', label: '已解决' },
            { value: 'archived', label: '已归档' },
          ]}
        />

        {/* Search */}
        <input
          type="text" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="搜索姓名或电话..."
          className="h-9 w-[36rem] px-4 rounded-2xl border border-stone-200 bg-stone-50/80 text-sm text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white"
        />

        {/* Active / Deleted toggle — pushed right */}
        <div className="flex items-center gap-0.5 ml-auto h-9 bg-stone-100 rounded-2xl px-0.5">
          <button onClick={() => setViewMode('active')}
            className={`h-8 rounded-[14px] px-3 text-sm font-medium transition ${viewMode === 'active'
              ? 'bg-white text-[#2c2c2c] shadow-sm'
              : 'text-[#6b6b6b] hover:text-[#2c2c2c]'}`}>
            有效
          </button>
          <button onClick={() => setViewMode('deleted')}
            className={`h-8 rounded-[14px] px-3 text-sm font-medium transition ${viewMode === 'deleted'
              ? 'bg-white text-[#2c2c2c] shadow-sm'
              : 'text-[#6b6b6b] hover:text-[#2c2c2c]'}`}>
            已删除
          </button>
        </div>
      </div>

      {error && <div className="text-red-600 bg-red-50 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {/* Batch action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-stone-50 border border-stone-200 rounded-2xl px-4 py-2">
          <span className="text-sm text-stone-600">{selected.size} selected</span>
          {viewMode === 'active' ? (
            <button
              onClick={() => setDeleteModalOpen(true)}
              className="px-4 py-1.5 text-sm text-white bg-[#8b2525] rounded-2xl hover:bg-[#6b1d1d] transition"
            >
              Delete Selected ({selected.size})
            </button>
          ) : (
            <button
              onClick={handleBatchRestore}
              className="px-4 py-1.5 text-sm text-white bg-[#b8864a] rounded-2xl hover:bg-[#a07840] transition"
            >
              Restore Selected ({selected.size})
            </button>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
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

      {/* Table */}
      <div className="bg-white rounded-xl border border-stone-200">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="px-4 py-3 w-10"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">City</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Area</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Source</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">CRM</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSpinner colSpan={9} />
              ) : inquiries.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-stone-400">No inquiries found</td></tr>
              ) : inquiries.map((inq) => (
                <>
                  <tr
                    key={inq.id}
                    className={`border-b border-stone-100 hover:bg-stone-50 cursor-pointer transition ${expandedId === inq.id ? 'bg-stone-50' : ''}`}
                    onClick={() => handleExpand(inq)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(inq.id)} onChange={() => toggleSelect(inq.id)} />
                    </td>
                    <td className="px-4 py-3 font-medium text-stone-800">
                      <div className="flex items-center gap-2">
                        {inq.name || <span className="text-stone-400">—</span>}
                        {inq.message?.startsWith('[Company Inquiry]') && (
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#b8864a]/10 text-[#b8864a]">Company</span>
                        )}
                        {inq.deleted_at && (
                          <span className="inline-flex cursor-help relative group" onClick={(e) => e.stopPropagation()}>
                            <Info className="w-3.5 h-3.5 text-red-400" />
                            <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 z-50 hidden group-hover:block w-72 rounded-lg border border-stone-200 bg-white p-3 text-[12px] leading-relaxed text-stone-700 shadow-xl whitespace-normal">
                              <div className="font-semibold text-red-600 mb-1">删除理由</div>
                              <div>{inq.deleted_reason || '—（无记录）'}</div>
                              {inq.deleted_at && (
                                <div className="text-stone-400 mt-1 text-[11px]">
                                  删除时间：{new Date(inq.deleted_at).toLocaleString()}
                                </div>
                              )}
                            </span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-stone-600">{inq.phone}</td>
                    <td className="px-4 py-3 text-stone-600">{inq.city || <span className="text-stone-400">—</span>}</td>
                    <td className="px-4 py-3 text-stone-600">{(() => {
                      const fromMessage = inq.message?.match(/Area[:：]?\s*([\d,]+)\s*m²/i);
                      if (fromMessage) return `${fromMessage[1]}m²`;
                      return inq.area_range?.replace(/\+$/, '') || '—';
                    })()}</td>
                    <td className="px-4 py-3 text-xs">
                      {inq.source_company_name ? (
                        inq.source_company_slug ? (
                          <a
                            href={`/companies/${inq.source_company_slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[#b8864a] font-medium hover:underline"
                          >{inq.source_company_name}</a>
                        ) : (
                          <span className="text-[#b8864a] font-medium">{inq.source_company_name}</span>
                        )
                      ) : (
                        <span className="text-stone-400">Homepage</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[inq.status]}`}>
                        {STATUS_LABEL[inq.status] || inq.status}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const status = inq.crm_sync_status;
                        const action = inq.crm_action;

                        // Synced with action info. 'linked' is a yellow warning
                        // since it means CRM merged into an existing lead
                        // (which the CRM team may not notice — see incident log).
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
                                <span className="inline-flex cursor-help relative group">
                                  <Info className="w-3.5 h-3.5 text-stone-400" />
                                  <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 z-50 hidden group-hover:block w-72 rounded-lg border border-stone-200 bg-white p-3 text-[12px] leading-relaxed text-stone-700 shadow-xl whitespace-normal">
                                    {tip}
                                  </span>
                                </span>
                              </span>
                              {isLinked && (
                                <span className="text-[10px] text-amber-600">已合并 → 请检查</span>
                              )}
                            </div>
                          );
                        }

                        if (status === 'failed') {
                          return (
                            <div className="flex flex-col items-start gap-1">
                              <span className="inline-flex items-center gap-1">
                                <span
                                  className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200"
                                  title={inq.crm_last_error || undefined}
                                >
                                  同步失败
                                </span>
                                <span title={CRM_STATUS_TOOLTIP.failed} className="inline-flex cursor-help"><Info className="w-3.5 h-3.5 text-stone-400" /></span>
                              </span>
                              <button
                                onClick={() => handleResendCrm(inq.id)}
                                disabled={resendingId === inq.id}
                                className="text-[10px] text-[#b8864a] hover:underline disabled:opacity-50"
                              >
                                {resendingId === inq.id ? '发送中…' : '重新发送'}
                              </button>
                            </div>
                          );
                        }

                        // pending (not yet attempted) or legacy rows with no status
                        return (
                          <div className="flex flex-col items-start gap-1">
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-500">
                                待同步
                              </span>
                              <span title={CRM_STATUS_TOOLTIP.pending} className="inline-flex cursor-help"><Info className="w-3.5 h-3.5 text-stone-400" /></span>
                            </span>
                            <button
                              onClick={() => handleResendCrm(inq.id)}
                              disabled={resendingId === inq.id}
                              className="text-[10px] text-[#b8864a] hover:underline disabled:opacity-50"
                            >
                              {resendingId === inq.id ? '发送中…' : '立即发送'}
                            </button>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-stone-500 text-xs whitespace-nowrap">
                      {new Date(inq.created_at).toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                    </td>
                  </tr>
                  {expandedId === inq.id && (
                    <tr key={`${inq.id}-detail`} className="bg-stone-50">
                      <td colSpan={9} className="px-4 py-4">
                        <div className="space-y-3 max-w-2xl">
                          {inq.message && (
                            <div>
                              <span className="text-xs font-medium text-stone-500">Message:</span>
                              <p className="text-sm text-stone-700 mt-1">{inq.message}</p>
                            </div>
                          )}
                          <div className="flex gap-4 items-end">
                            <div>
                              <label className="block text-xs font-medium text-stone-500 mb-1">Status</label>
                              <AdminSelect
                                value={editStatus}
                                onChange={(val) => setEditStatus(val)}
                                options={[
                                  { value: 'new', label: '新询单' },
                                  { value: 'contacted', label: '已联系' },
                                  { value: 'resolved', label: '已解决' },
                                  { value: 'archived', label: '已归档' },
                                ]}
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-stone-500 mb-1">Admin Notes</label>
                              <input
                                type="text"
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                placeholder="Add notes..."
                                className="h-9 w-full px-3 border border-stone-200 rounded-lg text-sm bg-white"
                              />
                            </div>
                            <button
                              onClick={() => handleUpdate(inq.id)}
                              disabled={updating}
                              className="h-9 px-4 bg-[#b8864a] text-white text-sm rounded-lg hover:bg-[#a07840] disabled:opacity-50"
                            >
                              {updating ? '...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
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
