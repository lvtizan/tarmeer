'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SmartImage from '@/components/ui/SmartImage';
import { TableSpinner } from '@/components/ui/Spinner';
import { Trash2 } from 'lucide-react';
import CopyButton from '@/components/ui/CopyButton';
import { formatAdminDateTime, ADMIN_TIME_CLS } from '@/lib/formatTime';

interface CompanyProfileRecord {
  id: number;
  company_name: string;
  company_type: string;
  status: 'pending' | 'approved' | 'rejected';
  display_order: number;
  home_display_order: number;
  list_display_order: number;
  city: string | null;
  logo_url: string | null;
  user_name: string;
  user_email: string;
  project_count: number;
  today_project_count?: number;
  created_at: string;
  updated_at?: string;
  is_signed?: boolean;
  weight_score?: number;
  pending_project_count?: number;
}

type SortDir = 'asc' | 'desc';

interface AdminCompaniesTableTabProps {
  profiles: CompanyProfileRecord[];
  loading: boolean;
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  onDelete: (profile: CompanyProfileRecord, reason?: string) => void;
  onSetHomeOrder: (id: number, value: number) => void;
  onSetListOrder: (id: number, value: number) => void;
  orderSavingId: number | null;
  sortDir: SortDir;
  sortActive: boolean;
  onSortToggle: () => void;
  onBulkUnapprove?: (ids: number[]) => void;
  onToggleSigned?: (id: number, isSigned: boolean) => void;
  updatedSortActive?: boolean;
  updatedSortDir?: SortDir;
  onUpdatedSortToggle?: () => void;
}

export default function AdminCompaniesTableTab({
  profiles,
  loading,
  total,
  page,
  onPageChange,
  onDelete,
  onSetHomeOrder,
  onSetListOrder,
  orderSavingId,
  sortDir,
  sortActive,
  onSortToggle,
  onBulkUnapprove,
  onToggleSigned,
  updatedSortActive,
  updatedSortDir,
  onUpdatedSortToggle,
}: AdminCompaniesTableTabProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingOrder, setEditingOrder] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ msg: string; key: string } | null>(null);

  const showToast = (msg: string, key: string) => {
    setToast({ msg, key });
    setTimeout(() => setToast(null), 2000);
  };

  const getEditKey = (id: number, type: string) => `${type}-${id}`;

  const handleOrderBlur = (id: number, type: 'home' | 'list', original: number) => {
    const key = getEditKey(id, type);
    const raw = editingOrder[key];
    if (raw === undefined) return;
    const value = parseInt(raw) || 0;
    if (value === original) {
      setEditingOrder((prev) => { const next = { ...prev }; delete next[key]; return next; });
      return;
    }
    const handler = type === 'home' ? onSetHomeOrder : onSetListOrder;
    handler(id, value);
    setEditingOrder((prev) => { const next = { ...prev }; delete next[key]; return next; });
    showToast(`${type === 'home' ? 'Home' : 'List'} order set to ${value}`, key);
  };

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
    const reason = window.prompt(`Delete ${selected.size} companies? This cannot be undone.\nPlease enter delete reason / 请输入删除原因：`);
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
        <div className="mb-3 flex gap-3">
          {onBulkUnapprove && (
            <button
              onClick={() => { onBulkUnapprove([...selected]); setSelected(new Set()); }}
              className="px-4 py-2 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition-colors text-sm font-medium"
            >
              Unapprove {selected.size}
            </button>
          )}
          <button
            onClick={handleBatchDelete}
            className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <Trash2 size={16} />
            Delete {selected.size}
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <table className="w-full text-[15px]">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200 text-sm">
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={profiles.length > 0 && selected.size === profiles.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded"
                />
              </th>
              <th className="text-left px-4 py-3 font-medium text-stone-600">Company</th>
              <th className="text-left px-4 py-3 font-medium text-stone-600">City</th>
              <th className="text-left px-4 py-3 font-medium text-stone-600">Owner</th>
              <th
                className="text-left px-4 py-3 font-medium text-stone-600 cursor-pointer select-none hover:text-stone-800"
                onClick={onSortToggle}
              >
                Projects {sortActive ? (sortDir === 'desc' ? '↓' : '↑') : <span className="text-stone-300">↕</span>}
              </th>
              <th className="text-left px-4 py-3 font-medium text-stone-600">Home Order</th>
              <th className="text-left px-4 py-3 font-medium text-stone-600">List Order</th>
              <th className="text-left px-4 py-3 font-medium text-stone-600">已签约</th>
              <th className="text-left px-4 py-3 font-medium text-stone-600">Weight</th>
              <th className="text-left px-4 py-3 font-medium text-stone-600">Joined</th>
              <th
                className="text-left px-4 py-3 font-medium text-stone-600 cursor-pointer select-none hover:text-stone-800"
                onClick={onUpdatedSortToggle}
              >
                更新时间 {updatedSortActive ? (updatedSortDir === 'desc' ? '↓' : '↑') : <span className="text-stone-300">↕</span>}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSpinner colSpan={11} />
            ) : profiles.length === 0 ? (
              <tr><td colSpan={11} className="text-center py-12 text-stone-400">No records</td></tr>
            ) : profiles.map((c) => (
              <tr
                key={c.id}
                className="group border-b border-stone-100 hover:bg-stone-50 cursor-pointer"
                onClick={() => router.push(`/admin/profile-companies/${c.id}?tab=companies`)}
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
                    {c.pending_project_count != null && c.pending_project_count > 0 && (
                      <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                        待审核{c.pending_project_count}
                      </span>
                    )}
                    <CopyButton text={c.company_name} />
                  </div>
                </td>
                <td className="px-4 py-3 text-stone-600">{c.city || '—'}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-stone-800 text-xs">{c.user_name}</div>
                  <div className="text-xs text-stone-400">{c.user_email}</div>
                </td>
                <td className="px-4 py-3 text-stone-700 font-medium">
                  {c.project_count}
                  {c.today_project_count != null && c.today_project_count > 0 && (
                    <span className="ml-1.5 text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">今天+{c.today_project_count}</span>
                  )}
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="relative">
                    {toast?.key === getEditKey(c.id, 'home') && (
                      <div className="absolute -top-8 left-0 bg-white border border-stone-200 text-stone-700 text-xs px-2.5 py-1 rounded-lg shadow-sm whitespace-nowrap">{toast.msg}</div>
                    )}
                    <input
                      type="number"
                      value={editingOrder[getEditKey(c.id, 'home')] ?? c.home_display_order}
                      onChange={(e) => setEditingOrder((prev) => ({ ...prev, [getEditKey(c.id, 'home')]: e.target.value }))}
                      onBlur={() => handleOrderBlur(c.id, 'home', c.home_display_order)}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      disabled={orderSavingId === c.id}
                      className="w-16 px-2 py-1 text-xs border rounded disabled:opacity-50"
                    />
                  </div>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="relative">
                    {toast?.key === getEditKey(c.id, 'list') && (
                      <div className="absolute -top-8 left-0 bg-white border border-stone-200 text-stone-700 text-xs px-2.5 py-1 rounded-lg shadow-sm whitespace-nowrap">{toast.msg}</div>
                    )}
                    <input
                      type="number"
                      value={editingOrder[getEditKey(c.id, 'list')] ?? c.list_display_order}
                      onChange={(e) => setEditingOrder((prev) => ({ ...prev, [getEditKey(c.id, 'list')]: e.target.value }))}
                      onBlur={() => handleOrderBlur(c.id, 'list', c.list_display_order)}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      disabled={orderSavingId === c.id}
                      className="w-16 px-2 py-1 text-xs border rounded disabled:opacity-50"
                    />
                  </div>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onToggleSigned?.(c.id, !c.is_signed)}
                    className={`w-9 h-5 rounded-full relative transition-colors ${c.is_signed ? 'bg-[#b8864a]' : 'bg-stone-300'}`}
                  >
                    <span className={`block w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-transform ${c.is_signed ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                  </button>
                </td>
                <td className="px-4 py-3 text-stone-600 text-[15px] tabular-nums font-mono">{c.weight_score ?? '—'}</td>
                <td className={`px-4 py-3 ${ADMIN_TIME_CLS}`}>{formatAdminDateTime(c.created_at)}</td>
                <td className={`px-4 py-3 ${ADMIN_TIME_CLS}`}>{formatAdminDateTime(c.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100">
            <span className="text-xs text-stone-500">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1} className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">Prev</button>
              <button onClick={() => onPageChange(Math.min(pages, page + 1))} disabled={page >= pages} className="px-3 py-1 text-xs border rounded-lg hover:bg-stone-50 disabled:opacity-30">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
