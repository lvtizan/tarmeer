'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SmartImage from '@/components/ui/SmartImage';
import { TableSpinner } from '@/components/ui/Spinner';
import { useAdminT } from '@/hooks/useAdminLang';

interface CompanyRecord {
  id: number;
  name_en: string;
  slug: string;
  city: string;
  logo_url: string | null;
  home_display_order: number;
  list_display_order: number;
  owner_user_id: number | null;
  owner_name: string | null;
  owner_email: string | null;
  project_count: number;
}

type SortDir = 'asc' | 'desc';

interface AdminDirectoryTableProps {
  companies: CompanyRecord[];
  loading: boolean;
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  onSetHomeOrder: (id: number, value: number) => void;
  onSetListOrder: (id: number, value: number) => void;
  orderSavingKey: string | null;
  sortDir: SortDir;
  sortActive: boolean;
  onSortToggle: () => void;
}

export default function AdminDirectoryTable({
  companies,
  loading,
  total,
  page,
  onPageChange,
  onSetHomeOrder,
  onSetListOrder,
  orderSavingKey,
  sortDir,
  sortActive,
  onSortToggle,
}: AdminDirectoryTableProps) {
  const router = useRouter();
  const { t } = useAdminT();
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
    setSelected(checked ? new Set(companies.map(c => c.id)) : new Set());
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    const next = new Set(selected);
    checked ? next.add(id) : next.delete(id);
    setSelected(next);
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <table className="w-full text-[15px]">
        <thead>
          <tr className="bg-stone-50 border-b border-stone-200 text-sm">
            <th className="px-4 py-3 text-left">
              <input
                type="checkbox"
                checked={companies.length > 0 && selected.size === companies.length}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="rounded"
              />
            </th>
            <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Company', '公司')}</th>
            <th className="text-left px-4 py-3 font-medium text-stone-600">{t('City', '城市')}</th>
            <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Owner', '所有者')}</th>
            <th
              className="text-left px-4 py-3 font-medium text-stone-600 cursor-pointer select-none hover:text-stone-800"
              onClick={onSortToggle}
            >
              {t('Projects', '项目')} {sortActive ? (sortDir === 'desc' ? '↓' : '↑') : <span className="text-stone-300">↕</span>}
            </th>
            <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Home Order', '首页排序')}</th>
            <th className="text-left px-4 py-3 font-medium text-stone-600">{t('List Order', '列表排序')}</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <TableSpinner colSpan={7} />
          ) : companies.length === 0 ? (
            <tr><td colSpan={7} className="text-center py-12 text-stone-400">{t('No records', '暂无数据')}</td></tr>
          ) : companies.map((c) => (
            <tr
              key={c.id}
              className="group border-b border-stone-100 hover:bg-stone-50 cursor-pointer"
              onClick={() => router.push(`/admin/companies/${c.id}?tab=directory`)}
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
                    <div className="w-8 h-8 rounded-lg bg-stone-200" />
                  )}
                  <span className="font-medium text-stone-800">{c.name_en}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-stone-600">{c.city || '—'}</td>
              <td className="px-4 py-3">
                {c.owner_name ? (
                  <>
                    <div className="font-medium text-stone-800 text-xs">{c.owner_name}</div>
                    <div className="text-xs text-stone-400">{c.owner_email}</div>
                  </>
                ) : (
                  <span className="text-stone-400 text-xs">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-stone-700 font-medium">{c.project_count}</td>
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
                    disabled={orderSavingKey === `home-${c.id}`}
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
                    disabled={orderSavingKey === `list-${c.id}`}
                    className="w-16 px-2 py-1 text-xs border rounded disabled:opacity-50"
                  />
                </div>
              </td>
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
  );
}
