import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../../lib/adminApi';
import { TableSpinner } from '../../components/ui/Spinner';
import AdminSelect from '../../components/ui/AdminSelect';
import { useAdminT } from '../../hooks/useAdminLang';
import { formatAdminDateTime, ADMIN_TIME_CLS } from '../../lib/formatTime';

type StatusFilter = 'all' | 'new' | 'processing' | 'resolved' | 'rejected';

interface ComplaintRecord {
  id: number;
  name: string;
  email: string;
  content_url: string | null;
  description: string | null;
  status: 'new' | 'processing' | 'resolved' | 'rejected';
  admin_notes: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  processing: 'bg-amber-100 text-amber-700',
  resolved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

function truncate(str: string | null, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

export default function AdminComplaintsPage() {
  const { t } = useAdminT();
  const [searchParams, setSearchParams] = useSearchParams();
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get('page') || '1')));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const s = searchParams.get('status');
    return s === 'new' || s === 'processing' || s === 'resolved' || s === 'rejected' ? s : 'all';
  });
  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [error, setError] = useState('');

  // Expanded detail
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [updating, setUpdating] = useState(false);

  const loadComplaints = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminApi.getComplaints({
        page, limit: 20,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search || undefined,
      });
      setComplaints(result.complaints);
      setTotal(result.pagination.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load complaints.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => { loadComplaints(); }, [loadComplaints]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (page > 1) params.page = String(page);
    if (statusFilter !== 'all') params.status = statusFilter;
    if (search) params.search = search;
    setSearchParams(params, { replace: true });
  }, [page, statusFilter, search, setSearchParams]);

  const totalPages = Math.ceil(total / 20);

  const handleExpand = (complaint: ComplaintRecord) => {
    if (expandedId === complaint.id) {
      setExpandedId(null);
    } else {
      setExpandedId(complaint.id);
      setEditNotes(complaint.admin_notes || '');
      setEditStatus(complaint.status);
    }
  };

  const handleUpdate = async (id: number) => {
    setUpdating(true);
    try {
      await adminApi.updateComplaintStatus(id, editStatus, editNotes);
      setExpandedId(null);
      loadComplaints();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-stone-800">{t('Complaints', '投诉')}</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">{t('Status', '状态')}</label>
          <AdminSelect
            value={statusFilter}
            onChange={(val) => { setStatusFilter(val as StatusFilter); setPage(1); }}
            options={[
              { value: 'all', label: t('All Status', '全部状态') },
              { value: 'new', label: t('New', '新投诉') },
              { value: 'processing', label: t('Processing', '处理中') },
              { value: 'resolved', label: t('Resolved', '已解决') },
              { value: 'rejected', label: t('Rejected', '已拒绝') },
            ]}
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-stone-500 mb-1">{t('Search', '搜索')}</label>
          <input
            type="text" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('Name or email...', '姓名或邮箱...')}
            className="h-9 w-full px-3 border border-stone-200 rounded-lg text-sm bg-white"
          />
        </div>
      </div>

      {error && <div className="text-red-600 bg-red-50 px-4 py-2 rounded-lg text-sm">{error}</div>}

      {/* Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-4 py-3 font-medium text-stone-600">ID</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Name', '名称')}</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Email', '邮箱')}</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Content URL', '内容链接')}</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Description', '描述')}</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Status', '状态')}</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Date', '日期')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSpinner colSpan={7} />
              ) : complaints.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-stone-400">{t('No complaints found', '未找到投诉')}</td></tr>
              ) : complaints.map((c) => (
                <>
                  <tr
                    key={c.id}
                    className={`border-b border-stone-100 hover:bg-stone-50 cursor-pointer transition ${expandedId === c.id ? 'bg-stone-50' : ''}`}
                    onClick={() => handleExpand(c)}
                  >
                    <td className="px-4 py-3 text-stone-500 text-xs">{c.id}</td>
                    <td className="px-4 py-3 font-medium text-stone-800">{c.name}</td>
                    <td className="px-4 py-3 text-stone-600">{c.email}</td>
                    <td className="px-4 py-3 text-stone-500 text-xs">
                      {c.content_url ? (
                        <a
                          href={c.content_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {truncate(c.content_url, 30)}
                        </a>
                      ) : (
                        <span className="text-stone-400">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-stone-600 max-w-[200px]">{truncate(c.description, 40)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[c.status]}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className={`px-4 py-3 ${ADMIN_TIME_CLS}`}>
                      {formatAdminDateTime(c.created_at)}
                    </td>
                  </tr>
                  {expandedId === c.id && (
                    <tr key={`${c.id}-detail`} className="bg-stone-50">
                      <td colSpan={7} className="px-4 py-4">
                        <div className="space-y-3 max-w-2xl">
                          {c.content_url && (
                            <div>
                              <span className="text-xs font-medium text-stone-500">{t('Content URL:', '内容链接：')}</span>
                              <p className="text-sm text-stone-700 mt-1">
                                <a
                                  href={c.content_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline break-all"
                                >
                                  {c.content_url}
                                </a>
                              </p>
                            </div>
                          )}
                          {c.description && (
                            <div>
                              <span className="text-xs font-medium text-stone-500">{t('Description:', '描述：')}</span>
                              <p className="text-sm text-stone-700 mt-1 whitespace-pre-wrap">{c.description}</p>
                            </div>
                          )}
                          <div className="flex gap-4 items-end">
                            <div>
                              <label className="block text-xs font-medium text-stone-500 mb-1">{t('Status', '状态')}</label>
                              <AdminSelect
                                value={editStatus}
                                onChange={(val) => setEditStatus(val)}
                                options={[
                                  { value: 'new', label: t('New', '新投诉') },
                                  { value: 'processing', label: t('Processing', '处理中') },
                                  { value: 'resolved', label: t('Resolved', '已解决') },
                                  { value: 'rejected', label: t('Rejected', '已拒绝') },
                                ]}
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs font-medium text-stone-500 mb-1">{t('Admin Notes', '管理员备注')}</label>
                              <textarea
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                placeholder={t('Add notes...', '添加备注...')}
                                rows={2}
                                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white resize-y"
                              />
                            </div>
                            <button
                              onClick={() => handleUpdate(c.id)}
                              disabled={updating}
                              className="h-9 px-4 bg-[#b8864a] text-white text-sm rounded-lg hover:bg-[#a07840] disabled:opacity-50"
                            >
                              {updating ? '...' : t('Save', '保存')}
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
            <span className="text-xs text-stone-500">{t('Page', '页')} {page} / {totalPages} ({t('Total', '共')} {total})</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">{t('Prev', '上一页')}</button>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">{t('Next', '下一页')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
