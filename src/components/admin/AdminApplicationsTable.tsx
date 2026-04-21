import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SmartImage from '../ui/SmartImage';
import { TableSpinner } from '../ui/Spinner';
import { Trash2 } from 'lucide-react';
import { useAdminT } from '../../hooks/useAdminLang';

interface CompanyProfileRecord {
  id: number;
  company_name: string;
  company_type: string;
  status: 'pending' | 'approved' | 'rejected';
  city: string | null;
  logo_url: string | null;
  user_name: string;
  user_email: string;
  project_count: number;
  created_at: string;
}

type SortDir = 'asc' | 'desc';

interface AdminApplicationsTableProps {
  profiles: CompanyProfileRecord[];
  loading: boolean;
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  onDelete: (profile: CompanyProfileRecord, reason?: string) => void;
  sortDir: SortDir;
  sortActive: boolean;
  onSortToggle: () => void;
}

export default function AdminApplicationsTable({
  profiles,
  loading,
  total,
  page,
  onPageChange,
  onDelete,
  sortDir,
  sortActive,
  onSortToggle,
}: AdminApplicationsTableProps) {
  const navigate = useNavigate();
  const { t } = useAdminT();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const pages = Math.ceil(total / 20);

  const handleSelectAll = (checked: boolean) => {
    setSelected(checked ? new Set(profiles.map(p => p.id)) : new Set());
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    const next = new Set(selected);
    checked ? next.add(id) : next.delete(id);
    setSelected(next);
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    const reason = window.prompt(`Delete ${selected.size} applications? This cannot be undone.\nPlease enter delete reason / 请输入删除原因：`);
    if (!reason?.trim()) return;
    for (const id of selected) {
      const profile = profiles.find(p => p.id === id);
      if (profile) onDelete(profile, reason.trim());
    }
    setSelected(new Set());
  };

  return (
    <div>
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-2xl px-4 h-11 mb-3">
          <span className="text-sm text-stone-500">{selected.size} {t('selected', '已选')}</span>
          <button
            onClick={handleBatchDelete}
            className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-red-200 bg-white text-red-600 text-sm font-medium hover:bg-red-50 transition"
          >
            <Trash2 size={14} />
            {t('Delete', '删除')} ({selected.size})
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={profiles.length > 0 && selected.size === profiles.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded"
                />
              </th>
              <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Company', '公司')}</th>
              <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Type', '类型')}</th>
              <th className="text-left px-4 py-3 font-medium text-stone-600">{t('City', '城市')}</th>
              <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Owner', '所有者')}</th>
              <th
                className="text-left px-4 py-3 font-medium text-stone-600 cursor-pointer select-none hover:text-stone-800"
                onClick={onSortToggle}
              >
                {t('Projects', '项目')} {sortActive ? (sortDir === 'desc' ? '↓' : '↑') : <span className="text-stone-300">↕</span>}
              </th>
              <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Joined', '加入时间')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSpinner colSpan={7} />
            ) : profiles.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-stone-400">{t('No records', '暂无数据')}</td></tr>
            ) : profiles.map((c) => (
              <tr
                key={c.id}
                className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer"
                onClick={() => navigate(`/admin/profile-companies/${c.id}?tab=applications`)}
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={(e) => handleSelectOne(c.id, e.target.checked)}
                    className="rounded"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {c.logo_url ? (
                      <SmartImage src={c.logo_url} alt="" className="w-8 h-8 rounded-lg object-contain bg-stone-100" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-sm font-semibold text-amber-600">
                        {c.company_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="font-medium text-stone-800">{c.company_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    c.company_type === 'design_studio' ? 'bg-purple-50 text-purple-600'
                    : c.company_type === 'mep_contractor' ? 'bg-orange-50 text-orange-600'
                    : c.company_type === 'general_contractor' ? 'bg-emerald-50 text-emerald-600'
                    : c.company_type === 'maintenance_company' ? 'bg-cyan-50 text-cyan-600'
                    : c.company_type === 'specialty_trade' ? 'bg-amber-50 text-amber-600'
                    : c.company_type === 'landscaping' ? 'bg-green-50 text-green-600'
                    : 'bg-blue-50 text-blue-600'
                  }`}>
                    {{ design_studio: t('Studio', '设计工作室'), renovation_company: t('Renovation', '装修公司'), general_contractor: t('Contractor', '总承包商'), mep_contractor: t('MEP', '机电工程'), maintenance_company: t('Maintenance', '维保公司'), specialty_trade: t('Specialty', '专项工程'), landscaping: t('Landscape', '景观工程'), furnishing: t('Furnishing', '软装公司') }[c.company_type] || c.company_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-stone-600">{c.city || '—'}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-stone-800 text-xs">{c.user_name}</div>
                  <div className="text-xs text-stone-400">{c.user_email}</div>
                </td>
                <td className="px-4 py-3 text-stone-700 font-medium">{c.project_count}</td>
                <td className="px-4 py-3 text-stone-500 text-xs">{new Date(c.created_at).toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100">
            <span className="text-xs text-stone-500">{t('Page', '第')} {page} {t('of', '/')} {pages}</span>
            <div className="flex gap-2">
              <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">{t('Prev', '上一页')}</button>
              <button onClick={() => onPageChange(Math.min(pages, page + 1))} disabled={page >= pages} className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">{t('Next', '下一页')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
