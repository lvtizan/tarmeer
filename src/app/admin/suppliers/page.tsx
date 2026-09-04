'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/adminApi';
import { Spinner } from '@/components/ui/Spinner';
import { showToast } from '@/components/ui/Toast';
import { useAdminT } from '@/hooks/useAdminLang';
import { useAdminCountry } from '@/contexts/AdminCountryContext';
import { useAdmin } from '@/contexts/AdminContext';
import { Package, Trash2, Pencil, Check, X, Plus, ExternalLink, Download, Copy, CalendarDays, Tag, Search, EyeOff } from 'lucide-react';
import AdminRowActions from '@/components/admin/AdminRowActions';
import ProductCategoriesManager from '@/components/admin/ProductCategoriesManager';
import AdminSelect from '@/components/ui/AdminSelect';
import DeleteReasonModal from '@/components/admin/DeleteReasonModal';
import SupplierThumbsPreview from '@/components/admin/SupplierThumbsPreview';
import PasswordInput from '@/components/admin/PasswordInput';
import { formatAdminDateTime, ADMIN_TIME_CLS } from '@/lib/formatTime';

interface Supplier {
  id: number;
  company_name: string;
  name_zh?: string | null;
  slug: string;
  origin: 'china' | 'dubai';
  categories: string[] | string | null;
  status: string;
  is_published?: number; // 0=已下架(admin toggle-published 下架);默认 1
  has_physical_store: number;
  user_email: string;
  user_name: string;
  product_count: number;
  catalog_count: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  home_display_order: number;
  list_display_order: number;
  weight_score: number | null;
  source?: string;
}

function supplierSearchText(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

function supplierSortTime(...values: Array<string | null | undefined>): number {
  for (const value of values) {
    if (!value) continue;
    const time = new Date(value).getTime();
    if (Number.isFinite(time)) return time;
  }
  return 0;
}

export default function AdminSuppliersPage() {
  const { t } = useAdminT();
  const { country } = useAdminCountry();
  const { hasPermission } = useAdmin();
  const activeCountryRef = useRef(country);
  const supplierFetchIdRef = useRef(0);
  activeCountryRef.current = country;
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [partnerCount, setPartnerCount] = useState(0);
  const [allCount, setAllCount] = useState(0);
  const [teamCount, setTeamCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [originFilter, setOriginFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [productSort, setProductSort] = useState<'asc' | 'desc' | null>(null);
  const [joinedSort, setJoinedSort] = useState<'asc' | 'desc' | null>('desc'); // 默认「上架时间(published_at)」从新到旧,最新上架的在最前(与服务端 ORDER BY 一致)
  const [editedSort, setEditedSort] = useState<'asc' | 'desc' | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ id: number; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Record<string, string>>({});
  const [orderToast, setOrderToast] = useState<{ msg: string; key: string } | null>(null);
  const [editingNameZh, setEditingNameZh] = useState<Record<number, string>>({});
  const [editingName, setEditingName] = useState<Record<number, string>>({});
  const [showCatManager, setShowCatManager] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createForm, setCreateForm] = useState({ companyName: '', email: '', password: '', phone: '' });

  const fetchSuppliers = useCallback(async () => {
    const requestCountry = country;
    const requestId = ++supplierFetchIdRef.current;
    setLoading(true);
    setLoadError('');
    try {
      // limit 提到 500：admin 需一次加载完当前筛选全部（"公司创建的号"130 个 + 导出 Excel 要全量），避免旧的 50 静默截断
      const params: Record<string, string> = { limit: '500', country };
      if (originFilter) params.origin = originFilter;
      if (statusFilter) params.status = statusFilter;
      if (sourceFilter) params.source = sourceFilter;
      if (groupFilter) params.group = groupFilter;
      const qs = new URLSearchParams(params).toString();
      const data = await adminApi.request(`/suppliers?${qs}`);
      if (requestId !== supplierFetchIdRef.current || activeCountryRef.current !== requestCountry) return;
      setSuppliers(data.suppliers || []);
      setPartnerCount(data.partnerCount || 0);
      setAllCount(data.allCount || 0);
      setTeamCount(data.teamCount || 0);
    } catch (error) {
      if (requestId !== supplierFetchIdRef.current || activeCountryRef.current !== requestCountry) return;
      const message = error instanceof Error ? error.message : '供应商加载失败';
      setLoadError(message);
      showToast('供应商加载失败', 'error');
    }
    if (requestId === supplierFetchIdRef.current && activeCountryRef.current === requestCountry) setLoading(false);
  }, [originFilter, statusFilter, sourceFilter, groupFilter, country]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);
  useEffect(() => {
    setDeleteModal(null);
    setCreateError('');
    setDeleteLoading(false);
    setCreateSubmitting(false);
  }, [country]);

  const parseCats = (cats: string[] | string | null): string[] => {
    if (!cats) return [];
    if (Array.isArray(cats)) return cats;
    try { return JSON.parse(cats); } catch { return []; }
  };

  const handleStatus = async (id: number, status: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const requestCountry = country;
    try {
      await adminApi.request(`/suppliers/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      if (activeCountryRef.current !== requestCountry) return;
      setSuppliers(list => list.map(s => s.id === id ? { ...s, status } : s));
      showToast(t('Status updated', '状态已更新'), 'success');
    } catch {
      if (activeCountryRef.current === requestCountry) showToast(t('Failed to update status', '更新状态失败'), 'error');
    }
  };

  const handleDeleteConfirm = async (reason: string) => {
    if (!deleteModal) return;
    const requestCountry = country;
    setDeleteLoading(true);
    try {
      await adminApi.request(`/suppliers/${deleteModal.id}`, { method: 'DELETE', body: JSON.stringify({ reason, country: requestCountry }) });
      if (activeCountryRef.current === requestCountry) {
        setDeleteModal(null);
        fetchSuppliers();
      }
    } catch {}
    if (activeCountryRef.current === requestCountry) setDeleteLoading(false);
  };

  const handleCreateSupplier = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError('');
    if (!createForm.companyName.trim() || !createForm.email.trim() || !createForm.password) {
      setCreateError(t('Company name, email, and password are required.', '公司名称、邮箱和密码均为必填项。'));
      return;
    }
    if (createForm.password.length < 8) {
      setCreateError(t('Password must be at least 8 characters.', '密码至少 8 位。'));
      return;
    }
    if (new TextEncoder().encode(createForm.password).length > 72) {
      setCreateError(t('Password must be at most 72 UTF-8 bytes.', '密码不能超过 72 个 UTF-8 字节。'));
      return;
    }
    if (createForm.phone.length > 64) {
      setCreateError(t('Phone must be at most 64 characters.', '联系电话不能超过 64 个字符。'));
      return;
    }
    const requestCountry = country;
    setCreateSubmitting(true);
    try {
      await adminApi.createSupplierAccount({ ...createForm, country: requestCountry });
      if (activeCountryRef.current === requestCountry) {
        setCreateForm({ companyName: '', email: '', password: '', phone: '' });
        setShowCreateForm(false);
        showToast(t('Supplier account created and ready to sign in.', '供应商账号已创建，可直接登录。'), 'success');
        await fetchSuppliers();
      }
    } catch (error) {
      if (activeCountryRef.current === requestCountry) {
        setCreateError(error instanceof Error ? error.message : t('Failed to create supplier account.', '创建供应商账号失败。'));
      }
    }
    if (activeCountryRef.current === requestCountry) setCreateSubmitting(false);
  };

  const getEditKey = (id: number, type: string) => `${type}-${id}`;

  const showOrderToast = (msg: string, key: string) => {
    setOrderToast({ msg, key });
    setTimeout(() => setOrderToast(null), 2000);
  };

  const handleOrderBlur = async (id: number, type: 'home' | 'list', original: number) => {
    const requestCountry = country;
    const key = getEditKey(id, type);
    const raw = editingOrder[key];
    if (raw === undefined) return;
    const value = parseInt(raw) || 0;
    setEditingOrder(prev => { const next = { ...prev }; delete next[key]; return next; });
    if (value === original) return;
    try {
      if (type === 'home') {
        await adminApi.setSupplierHomeOrder(id, value);
      } else {
        await adminApi.setSupplierListOrder(id, value);
      }
      if (activeCountryRef.current === requestCountry) {
        showOrderToast(`${type === 'home' ? '首页' : '列表'}排序已设为 ${value}`, key);
        fetchSuppliers();
      }
    } catch {
      if (activeCountryRef.current === requestCountry) showToast(t('Failed to update order', '排序更新失败'), 'error');
    }
  };

  const handleNameZhBlur = async (s: Supplier) => {
    const requestCountry = country;
    const draft = editingNameZh[s.id];
    if (draft === undefined) return;
    const value = draft.trim();
    setEditingNameZh(prev => { const next = { ...prev }; delete next[s.id]; return next; });
    if (value === (s.name_zh ?? '')) return;
    try {
      await adminApi.request(`/suppliers/${s.id}`, { method: 'PUT', body: JSON.stringify({ name_zh: value }) });
      if (activeCountryRef.current !== requestCountry) return;
      setSuppliers(list => list.map(x => x.id === s.id ? { ...x, name_zh: value } : x));
      showToast(t('Chinese name updated', '中文名已更新'), 'success');
    } catch {
      if (activeCountryRef.current === requestCountry) showToast(t('Failed to update Chinese name', '更新中文名失败'), 'error');
    }
  };

  const startEditName = (s: Supplier) => setEditingName(prev => ({ ...prev, [s.id]: s.company_name }));

  const handleNameBlur = async (s: Supplier) => {
    const requestCountry = country;
    const draft = editingName[s.id];
    if (draft === undefined) return;
    const value = draft.trim();
    setEditingName(prev => { const next = { ...prev }; delete next[s.id]; return next; });
    if (!value || value === s.company_name) return; // 公司名必填：空则不保存、还原
    try {
      await adminApi.request(`/suppliers/${s.id}`, { method: 'PUT', body: JSON.stringify({ company_name: value }) });
      if (activeCountryRef.current !== requestCountry) return;
      setSuppliers(list => list.map(x => x.id === s.id ? { ...x, company_name: value } : x));
      showToast(t('Company name updated', '公司名已更新'), 'success');
    } catch {
      if (activeCountryRef.current === requestCountry) showToast(t('Failed to update company name', '更新公司名失败'), 'error');
    }
  };

  const copyName = async (s: Supplier) => {
    try {
      await navigator.clipboard.writeText(s.company_name);
      showToast(t('Company name copied', '公司名已复制'), 'success');
    } catch {
      showToast(t('Copy failed', '复制失败'), 'error');
    }
  };

  const selectTab = (tab: 'all' | 'partner' | 'team') => {
    if (tab === 'all') { setSourceFilter(''); setGroupFilter(''); }
    else if (tab === 'partner') { setSourceFilter('partner'); setGroupFilter(''); }
    else { setSourceFilter(''); setGroupFilter('team'); }
  };

  const visibleSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = suppliers.filter(s =>
      !q ||
      supplierSearchText(s.company_name).includes(q) ||
      supplierSearchText(s.name_zh).includes(q) ||
      supplierSearchText(s.user_email).includes(q)
    );
    const sorted = [...list];
    if (productSort) {
      sorted.sort((a, b) => {
        const diff = (Number(a.product_count) || 0) - (Number(b.product_count) || 0);
        return productSort === 'asc' ? diff : -diff;
      });
    }
    if (joinedSort) {
      sorted.sort((a, b) => {
        const diff = supplierSortTime(a.published_at, a.updated_at, a.created_at) - supplierSortTime(b.published_at, b.updated_at, b.created_at);
        return joinedSort === 'asc' ? diff : -diff;
      });
    }
    if (editedSort) {
      sorted.sort((a, b) => {
        const diff = supplierSortTime(a.updated_at, a.created_at) - supplierSortTime(b.updated_at, b.created_at);
        return editedSort === 'asc' ? diff : -diff;
      });
    }
    return sorted;
  }, [editedSort, joinedSort, productSort, search, suppliers]);

  const exportCsv = () => {
    const esc = (v: unknown): string => {
      let str = v === null || v === undefined ? '' : String(v);
      // 防 CSV 公式注入：以 = + - @ TAB CR 开头的值(如供应商自填公司名/中文名) Excel/WPS 会当公式执行，前缀单引号中和
      if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
      return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const headers = [
      t('Chinese Name', '中文名'),
      t('English Name', '英文名'),
      t('Origin', '产地'),
      t('Status', '状态'),
      t('Products', '商品数'),
      t('Email', '邮箱'),
      t('Listed', '上架时间'),
    ];
    const rows = suppliers.map(s => [
      esc(s.name_zh ?? ''),
      esc(s.company_name),
      esc(s.origin),
      esc(s.status),
      esc(s.product_count),
      esc(s.user_email),
      esc(s.published_at || s.updated_at),
    ].join(','));
    const csv = [headers.map(esc).join(','), ...rows].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `suppliers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {deleteModal && (
        <DeleteReasonModal
          names={[deleteModal.name]}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteModal(null)}
          loading={deleteLoading}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-[#2c2c2c]">{t('Suppliers', '供应商')}</h1>
          {partnerCount > 0 && (
            <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-[#f5ecdf] text-[#a07640] text-xs font-medium">
              {t('Partner-synced', '合作方同步')} {partnerCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasPermission('can_approve_suppliers') && <button
            type="button"
            onClick={() => { setShowCreateForm(true); setCreateError(''); }}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#b8864a] hover:bg-[#a07640] text-xs font-medium text-white transition"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('New Supplier', '新建供应商账号')}
          </button>}
          <button
            onClick={() => setShowCatManager(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50 hover:text-[#b8864a] transition"
          >
            <Tag className="w-3.5 h-3.5" />
            {t('Product Categories', '产品分类')}
          </button>
          <a
            href="/admin/supplier-report"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50 hover:text-[#b8864a] transition"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            {t('Listing Report', '上架统计')}
          </a>
          <button
            onClick={exportCsv}
            disabled={suppliers.length === 0}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#b8864a] hover:bg-[#a07640] text-xs font-medium text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            {t('Export Excel', '导出 Excel')}
          </button>
          <a
            href="/start-suppliers"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50 hover:text-[#b8864a] transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {t('Supplier Guide', '供应商教程页')}
          </a>
        </div>
      </div>

      <section hidden={!showCreateForm} className="mb-5 border border-stone-200 bg-white p-5 rounded-lg">
          <h2 className="mb-4 text-sm font-semibold text-stone-700">{t('New Supplier Account', '新建供应商账号')}</h2>
          <form onSubmit={handleCreateSupplier} className="space-y-3">
            {createError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{createError}</p>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-stone-500">
                {t('Company Name', '公司名称')}
                <input
                  type="text"
                  value={createForm.companyName}
                  onChange={event => setCreateForm(form => ({ ...form, companyName: event.target.value }))}
                  required
                  maxLength={100}
                  className="mt-1 h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 focus:border-[#b8864a] focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30"
                />
              </label>
              <label className="block text-xs font-medium text-stone-500">
                {t('Email', '邮箱')}
                <input
                  type="email"
                  value={createForm.email}
                  onChange={event => setCreateForm(form => ({ ...form, email: event.target.value }))}
                  required
                  maxLength={255}
                  className="mt-1 h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 focus:border-[#b8864a] focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30"
                />
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-stone-500">
                {t('Phone (optional)', '联系电话（选填）')}
                <input
                  type="tel"
                  value={createForm.phone}
                  onChange={event => setCreateForm(form => ({ ...form, phone: event.target.value }))}
                  maxLength={64}
                  className="mt-1 h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 focus:border-[#b8864a] focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30"
                />
              </label>
              <PasswordInput
                id="new-supplier-password"
                value={createForm.password}
                onChange={password => setCreateForm(form => ({ ...form, password }))}
                label={t('Initial Password', '初始密码')}
                placeholder={t('At least 8 characters', '至少 8 位')}
                minLength={8}
                required
                resetKey={showCreateForm ? 'open' : 'closed'}
              />
            </div>
            <div className="flex justify-end pt-1">
              <button type="button" onClick={() => setShowCreateForm(false)} className="mr-2 h-9 rounded-lg border border-stone-200 px-4 text-sm text-stone-600 hover:bg-stone-50">{t('Cancel', '取消')}</button>
              <button
                type="submit"
                disabled={createSubmitting}
                className="h-9 rounded-lg bg-[#b8864a] px-4 text-sm font-medium text-white transition hover:bg-[#a07640] disabled:opacity-40"
              >
                {createSubmitting ? t('Creating...', '创建中...') : t('Create Account', '创建账号')}
              </button>
            </div>
          </form>
      </section>

      <div className="flex items-center justify-between gap-2 mb-4">
        {/* 来源 tab：全部 / 合作方同步 / 公司创建的号 */}
        <div className="inline-flex items-center gap-1 p-1 bg-stone-100 rounded-lg">
          <button
            onClick={() => selectTab('all')}
            className={`h-7 px-3 rounded-md text-sm font-medium transition inline-flex items-center gap-1 ${
              sourceFilter === '' && groupFilter === '' ? 'bg-white text-[#2c2c2c] shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {t('All', '全部')}
            {allCount > 0 && <span className="text-xs opacity-70">{allCount}</span>}
          </button>
          <button
            onClick={() => selectTab('partner')}
            className={`h-7 px-3 rounded-md text-sm font-medium transition inline-flex items-center gap-1 ${
              sourceFilter === 'partner' ? 'bg-white text-[#a07640] shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {t('Partner-synced', '合作方同步')}
            {partnerCount > 0 && <span className="text-xs opacity-70">{partnerCount}</span>}
          </button>
          <button
            onClick={() => selectTab('team')}
            className={`h-7 px-3 rounded-md text-sm font-medium transition inline-flex items-center gap-1 ${
              groupFilter === 'team' ? 'bg-white text-[#2c2c2c] shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {t('Company Accounts', '公司创建的号')}
            {teamCount > 0 && <span className="text-xs opacity-70">{teamCount}</span>}
          </button>
        </div>
        <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('Search name / email', '搜索公司名 / 中文名 / 邮箱')}
            className="h-8 w-56 pl-8 pr-3 rounded-lg border border-stone-200 bg-white text-xs text-[#2c2c2c] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] transition"
          />
        </div>
        <AdminSelect
          size="sm"
          value={originFilter}
          onChange={setOriginFilter}
          options={[
            { value: '', label: t('All Origins', '全部产地') },
            { value: 'china', label: '🇨🇳 China' },
            { value: 'dubai', label: '🇦🇪 Dubai' },
          ]}
        />
        <AdminSelect
          size="sm"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: '', label: t('All Status', '全部状态') },
            { value: 'pending', label: t('Pending', '待审核') },
            { value: 'approved', label: t('Approved', '已通过') },
            { value: 'rejected', label: t('Rejected', '已拒绝') },
          ]}
        />
        </div>
      </div>

      {loading ? <Spinner /> : loadError ? (
        <div className="py-16 text-center">
          <Package className="w-10 h-10 text-red-300 mx-auto mb-3" />
          <p className="text-[15px] font-medium text-red-600">{t('Failed to load suppliers', '供应商加载失败')}</p>
          <p className="mt-1 text-xs text-stone-500">{loadError}</p>
          <button
            type="button"
            onClick={() => fetchSuppliers()}
            className="mt-4 inline-flex h-8 items-center justify-center rounded-lg bg-[#b8864a] px-3 text-xs font-medium text-white transition hover:bg-[#a07640]"
          >
            {t('Retry', '重试')}
          </button>
        </div>
      ) : visibleSuppliers.length === 0 ? (
        <div className="py-16 text-center">
          <Package className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-[15px] text-stone-500">{t('No suppliers found', '暂无供应商')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-x-auto">
          <table className="w-full min-w-max text-[15px]">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-sm">
                <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Company', '公司')}</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600 whitespace-nowrap">{t('Chinese Name', '中文名')}</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Origin', '产地')}</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Categories', '品类')}</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Status', '状态')}</th>
                <th
                  className="text-left px-4 py-3 font-medium text-stone-600 cursor-pointer select-none hover:text-stone-800"
                  onClick={() => { setJoinedSort(null); setEditedSort(null); setProductSort(s => s === 'desc' ? 'asc' : 'desc'); }}
                >
                  {t('Products', '产品')} {productSort === 'asc' ? '↑' : productSort === 'desc' ? '↓' : <span className="text-stone-300">↕</span>}
                </th>
                <th className="text-left px-4 py-3 font-medium text-stone-600 whitespace-nowrap">首页排序</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600 whitespace-nowrap">列表排序</th>
                <th className="text-left px-4 py-3 font-medium text-stone-600 whitespace-nowrap">权重</th>
                <th
                  className="text-left px-4 py-3 font-medium text-stone-600 cursor-pointer select-none hover:text-stone-800 whitespace-nowrap"
                  onClick={() => { setProductSort(null); setEditedSort(null); setJoinedSort(s => s === 'desc' ? 'asc' : 'desc'); }}
                >
                  {t('Listed', '上架时间')} {joinedSort === 'asc' ? '↑' : joinedSort === 'desc' ? '↓' : <span className="text-stone-300">↕</span>}
                </th>
                <th
                  className="text-left px-4 py-3 font-medium text-stone-600 cursor-pointer select-none hover:text-stone-800 whitespace-nowrap"
                  onClick={() => { setProductSort(null); setJoinedSort(null); setEditedSort(s => s === 'desc' ? 'asc' : 'desc'); }}
                >
                  {t('Last Edited', '最后编辑')} {editedSort === 'asc' ? '↑' : editedSort === 'desc' ? '↓' : <span className="text-stone-300">↕</span>}
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visibleSuppliers.map(s => (
                <tr
                  key={s.id}
                  className="border-b border-stone-100 hover:bg-stone-50/50 cursor-pointer"
                  onClick={() => router.push(`/admin/suppliers/${s.id}`)}
                >
                  <td className="px-4 py-3">
                    {editingName[s.id] !== undefined ? (
                      <div onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingName[s.id]}
                          onChange={e => setEditingName(prev => ({ ...prev, [s.id]: e.target.value }))}
                          onBlur={() => handleNameBlur(s)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') setEditingName(prev => { const n = { ...prev }; delete n[s.id]; return n; });
                          }}
                          autoFocus
                          className="w-60 px-2 py-1 text-[15px] font-semibold bg-white border border-stone-200 rounded focus:outline-none focus:border-[#b8864a]"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <SupplierThumbsPreview supplierId={s.id} productCount={s.product_count}>
                          <span className="text-[16px] font-semibold text-[#2c2c2c] leading-tight">{s.company_name}</span>
                        </SupplierThumbsPreview>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); startEditName(s); }}
                          title={t('Edit company name', '编辑公司名')}
                          aria-label={t('Edit company name', '编辑公司名')}
                          className="text-stone-400 hover:text-[#b8864a] transition shrink-0"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); copyName(s); }}
                          title={t('Copy company name', '复制公司名')}
                          aria-label={t('Copy company name', '复制公司名')}
                          className="text-stone-400 hover:text-[#b8864a] transition shrink-0"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {s.source === 'partner' && (
                          <span className="inline-flex items-center h-5 px-2 rounded-full bg-[#f5ecdf] text-[#a07640] text-[12px] font-medium shrink-0">
                            {t('Partner', '合作方同步')}
                          </span>
                        )}
                        {s.is_published === 0 && (
                          <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-stone-200/80 text-stone-600 text-[12px] font-medium shrink-0" title={t('Hidden from public site', '未在公开站点展示')}>
                            <EyeOff className="w-3 h-3" />
                            {t('Delisted', '已下架')}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="text-[14px] text-stone-400 mt-0.5">{s.user_email}</div>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editingNameZh[s.id] ?? (s.name_zh ?? '')}
                      placeholder={t('+ Add', '+ 添加')}
                      onChange={e => setEditingNameZh(prev => ({ ...prev, [s.id]: e.target.value }))}
                      onBlur={() => handleNameZhBlur(s)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      className="w-32 px-2 py-1 text-[14px] bg-white border border-stone-200 rounded focus:outline-none focus:border-[#b8864a]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[15px] font-medium px-2.5 py-0.5 rounded-full ${
                      s.origin === 'china' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {s.origin === 'china' ? '🇨🇳 China' : '🇦🇪 Dubai'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {parseCats(s.categories).slice(0, 2).map(c => (
                        <span key={c} className="text-[13px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">{c}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[15px] font-medium px-2.5 py-0.5 rounded-full ${
                      s.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                      s.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[15px] text-stone-600">{s.product_count}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="relative">
                      {orderToast?.key === getEditKey(s.id, 'home') && (
                        <div className="absolute -top-8 left-0 bg-white border border-stone-200 text-stone-700 text-xs px-2.5 py-1 rounded-lg shadow-sm whitespace-nowrap">{orderToast.msg}</div>
                      )}
                      <input
                        type="number"
                        value={editingOrder[getEditKey(s.id, 'home')] ?? (s.home_display_order || 0)}
                        onChange={e => setEditingOrder(prev => ({ ...prev, [getEditKey(s.id, 'home')]: e.target.value }))}
                        onBlur={() => handleOrderBlur(s.id, 'home', s.home_display_order || 0)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        className="w-16 px-2 py-1 text-xs border rounded"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="relative">
                      {orderToast?.key === getEditKey(s.id, 'list') && (
                        <div className="absolute -top-8 left-0 bg-white border border-stone-200 text-stone-700 text-xs px-2.5 py-1 rounded-lg shadow-sm whitespace-nowrap">{orderToast.msg}</div>
                      )}
                      <input
                        type="number"
                        value={editingOrder[getEditKey(s.id, 'list')] ?? (s.list_display_order || 0)}
                        onChange={e => setEditingOrder(prev => ({ ...prev, [getEditKey(s.id, 'list')]: e.target.value }))}
                        onBlur={() => handleOrderBlur(s.id, 'list', s.list_display_order || 0)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        className="w-16 px-2 py-1 text-xs border rounded"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-stone-600 text-[15px] tabular-nums font-mono">{s.weight_score ?? '—'}</td>
                  <td className={`px-4 py-3 ${ADMIN_TIME_CLS}`}>{formatAdminDateTime(s.published_at || s.updated_at)}</td>
                  <td className={`px-4 py-3 ${ADMIN_TIME_CLS}`}>{s.updated_at ? formatAdminDateTime(s.updated_at) : '—'}</td>
                  <td className="px-4 py-3">
                    <AdminRowActions actions={[
                      {
                        icon: <Pencil size={14} />,
                        label: t('Edit', '编辑'),
                        variant: 'default',
                        onClick: e => { e.stopPropagation(); router.push(`/admin/suppliers/${s.id}`); },
                      },
                      ...(s.status !== 'approved' ? [{
                        icon: <Check size={14} />,
                        label: t('Approve', '通过'),
                        variant: 'success' as const,
                        onClick: (e: React.MouseEvent) => handleStatus(s.id, 'approved', e),
                      }] : []),
                      ...(s.status !== 'rejected' ? [{
                        icon: <X size={14} />,
                        label: t('Reject', '拒绝'),
                        variant: 'warning' as const,
                        onClick: (e: React.MouseEvent) => handleStatus(s.id, 'rejected', e),
                      }] : []),
                      {
                        icon: <Trash2 size={14} />,
                        label: t('Delete', '删除'),
                        variant: 'danger' as const,
                        onClick: e => { e.stopPropagation(); setDeleteModal({ id: s.id, name: s.company_name }); },
                      },
                    ]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 产品分类管理弹层（两级：大类→子类，增删改+启停+拖拽） */}
      {showCatManager && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm p-4 sm:p-8" onClick={() => setShowCatManager(false)}>
          <div className="w-full max-w-3xl rounded-2xl bg-[#faf9f7] shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-[#2c2c2c]">{t('Product Categories', '产品分类')}</h2>
                <p className="mt-0.5 text-xs text-stone-500">{t('Two levels: top categories (Building Materials / Soft Furnishing) → sub-categories. Products pick a sub-category.', '两级：大类（建材/软装）→ 子类；产品归到子类')}</p>
              </div>
              <button onClick={() => setShowCatManager(false)} className="p-1 text-stone-400 hover:text-stone-600" aria-label={t('Close', '关闭')}><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5">
              <ProductCategoriesManager />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
