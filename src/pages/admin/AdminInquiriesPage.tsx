import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Info } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { TableSpinner } from '../../components/ui/Spinner';
import AdminSelect from '../../components/ui/AdminSelect';

const CRM_ACTION_TOOLTIP: Record<string, string> = {
  created: 'CRM 中新建了一条线索',
  updated: '已更新到 CRM 已有线索',
  linked: '该联系人在 CRM 已存在，此次询盘被合并到原线索——CRM 团队可能不会收到新通知，请手动检查',
  duplicate: '同一联系人已有未处理线索，自动判定为重复',
  synced: '已同步到 CRM',
};
const CRM_STATUS_TOOLTIP = {
  failed: 'CRM 同步失败，可点击「重新发送」重试',
  pending: '尚未同步到 CRM',
};

type StatusFilter = 'all' | 'new' | 'contacted' | 'resolved' | 'archived';
type TypeFilter = 'all' | 'homeowner' | 'company';

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
    return t === 'homeowner' || t === 'company' ? t : 'all';
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
      // Combine user search with type filter
      let effectiveSearch = search || undefined;
      if (typeFilter === 'company') {
        effectiveSearch = effectiveSearch ? `[Company Inquiry] ${effectiveSearch}` : '[Company Inquiry]';
      }
      const result = await adminApi.getInquiries({
        page, limit: 20,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: effectiveSearch,
        deleted: viewMode === 'deleted',
      });
      let filtered = result.inquiries;
      if (typeFilter === 'homeowner') {
        filtered = filtered.filter((inq: InquiryRecord) => !inq.message?.startsWith('[Company Inquiry]'));
      }
      setInquiries(filtered);
      setTotal(typeFilter === 'homeowner' ? filtered.length : result.pagination.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load inquiries.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, viewMode, typeFilter]);

  // Clear selection when viewMode changes
  useEffect(() => {
    setSelected(new Set());
    setPage(1);
  }, [viewMode]);

  useEffect(() => { loadInquiries(); }, [loadInquiries]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (page > 1) params.page = String(page);
    if (statusFilter !== 'all') params.status = statusFilter;
    if (typeFilter !== 'all') params.type = typeFilter;
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
        const [all, companyRes] = await Promise.all([
          adminApi.getInquiries({ page: 1, limit: 1 }),
          adminApi.getInquiries({ page: 1, limit: 1, search: '[Company Inquiry]' }),
        ]);
        const total = all.pagination.total;
        const company = companyRes.pagination.total;
        setCounts({ homeowner: Math.max(0, total - company), company });
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-800">Inquiries</h1>

      {/* Stats bars — right-aligned horizontal bars */}
      {(() => {
        const max = Math.max(counts.homeowner, counts.company, 1);
        const Row = ({ label, value, color }: { label: string; value: number; color: string }) => (
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-500 w-20 text-right shrink-0">{label}</span>
            <div className="flex-1 flex justify-end">
              <div className="h-5 rounded-full" style={{ width: `${(value / max) * 100}%`, backgroundColor: color, minWidth: value > 0 ? '8px' : 0 }} />
            </div>
            <span className="text-sm font-medium text-[#2c2c2c] w-12 text-right tabular-nums">{value}</span>
          </div>
        );
        return (
          <div className="flex justify-end">
            <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-2">
              <Row label="业主询单数" value={counts.homeowner} color="#b8864a" />
              <Row label="公司线索" value={counts.company} color="#6b6b6b" />
            </div>
          </div>
        );
      })()}

      {/* View mode tabs */}
      <div className="flex gap-2">
        <button onClick={() => setViewMode('active')}
          className={viewMode === 'active' ? 'bg-[#b8864a] text-white rounded-2xl px-4 py-1.5 text-sm' : 'border border-stone-200 text-stone-600 rounded-2xl px-4 py-1.5 text-sm'}>
          Active
        </button>
        <button onClick={() => setViewMode('deleted')}
          className={viewMode === 'deleted' ? 'bg-[#b8864a] text-white rounded-2xl px-4 py-1.5 text-sm' : 'border border-stone-200 text-stone-600 rounded-2xl px-4 py-1.5 text-sm'}>
          Deleted
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Type</label>
          <AdminSelect
            value={typeFilter}
            onChange={(val) => { setTypeFilter(val as TypeFilter); setPage(1); }}
            options={[
              { value: 'all', label: 'All Types' },
              { value: 'homeowner', label: 'Homeowner' },
              { value: 'company', label: 'Company Lead' },
            ]}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Status</label>
          <AdminSelect
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
        </div>
        <div className="w-56">
          <label className="block text-xs font-medium text-stone-500 mb-1">Search</label>
          <input
            type="text" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Name or phone..."
            className="h-9 w-full px-3 border border-stone-200 rounded-lg text-sm bg-white"
          />
        </div>
        <div className="ml-auto">
          <button
            onClick={handleExport}
            className="h-9 px-4 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition"
          >
            Export Excel
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
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
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
                      </div>
                    </td>
                    <td className="px-4 py-3 text-stone-600">{inq.phone}</td>
                    <td className="px-4 py-3 text-stone-600">{inq.city || <span className="text-stone-400">—</span>}</td>
                    <td className="px-4 py-3 text-stone-600">{inq.area_range}</td>
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
                                <span title={tip} className="inline-flex cursor-help"><Info className="w-3.5 h-3.5 text-stone-400" /></span>
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
