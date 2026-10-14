'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Users, Building2, MessageSquare, Package } from 'lucide-react';
import { adminApi } from '@/lib/adminApi';
import { useAdminCountry } from '@/contexts/AdminCountryContext';
import { useAdmin } from '@/contexts/AdminContext';
import CopyButton from '@/components/ui/CopyButton';

type SearchResults = Awaited<ReturnType<typeof adminApi.globalSearch>>;
type ReferenceResults = Awaited<ReturnType<typeof adminApi.referenceSearch>>;
const EMPTY_RESULTS: SearchResults = { homeownerLeads: [], companyLeads: [], users: [], registeredCompanies: [], directoryCompanies: [], suppliers: [], partnerCompanies: [] };
type FlatResult =
  | { kind: 'supplierReference'; item: ReferenceResults['suppliers'][0] }
  | { kind: 'productReference'; item: ReferenceResults['products'][0] }
  | { kind: 'homeowner'; item: SearchResults['homeownerLeads'][0] }
  | { kind: 'company'; item: SearchResults['companyLeads'][0] }
  | { kind: 'user'; item: SearchResults['users'][0] }
  | { kind: 'registeredCompany'; item: SearchResults['registeredCompanies'][0] }
  | { kind: 'directoryCompany'; item: SearchResults['directoryCompanies'][0] }
  | { kind: 'supplier'; item: SearchResults['suppliers'][0] };

const CRM_LABEL: Record<string, string> = {
  created: '已创建', updated: '已更新', linked: '已关联', duplicate: '重复',
  synced: '已同步', pending: '待同步', failed: '失败',
};

function highlight(text: string, q: string) {
  if (!q || !text) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[#b8864a]/20 text-[#8a6030] rounded px-0.5 not-italic">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function AdminGlobalSearch({ referenceOnly = false }: { referenceOnly?: boolean }) {
  const { country } = useAdminCountry();
  const { admin, hasPermission } = useAdmin();
  const canReferences = hasPermission('can_view_suppliers');
  const [references, setReferences] = useState<ReferenceResults>({ suppliers: [], products: [] });
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const [q, setQ] = useState('');
  const queryEligible = q.trim().length >= 2 || /^[1-9]$/.test(q.trim());
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const search = useCallback(async (val: string) => {
    const current = ++requestId.current;
    setLoading(true);
    setError('');
    const isReference = /^(?:(?:supplier|product)\s*#?\s*)?[1-9]\d*$/i.test(val.trim());
    const explicitReference = /^(?:supplier|product)\b/i.test(val.trim()) && isReference;
    try {
      const [data, refs] = await Promise.allSettled([
        explicitReference || referenceOnly ? Promise.resolve(EMPTY_RESULTS) : adminApi.globalSearch(val),
        isReference && canReferences ? adminApi.referenceSearch(val, admin?.role === 'super_admin' ? country : undefined) : Promise.resolve({ suppliers: [], products: [] }),
      ]);
      if (current !== requestId.current) return;
      setResults(data.status === 'fulfilled' ? data.value : EMPTY_RESULTS);
      setReferences(refs.status === 'fulfilled' ? refs.value : { suppliers: [], products: [] });
      if (refs.status === 'rejected') setError('编号查询失败，请重试或检查供应商权限');
      else if (data.status === 'rejected' && !refs.value.suppliers.length && !refs.value.products.length) setError('搜索失败，请重试或检查账号权限');
    } catch {
      if (current !== requestId.current) return;
      setResults(null);
      setReferences({ suppliers: [], products: [] });
      setError('搜索失败，请重试或检查账号权限');
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [country, canReferences, referenceOnly, admin?.role]);

  useEffect(() => {
    ++requestId.current;
    setResults(null);
    setReferences({ suppliers: [], products: [] });
    setCursor(-1);
    setError('');
    setLoading(false);
    if (!queryEligible) return;
    timerRef.current = setTimeout(() => search(q), 300);
    return () => { ++requestId.current; if (timerRef.current) clearTimeout(timerRef.current); };
  }, [q, search, queryEligible]);

  // Flatten results for keyboard nav
  const flat: FlatResult[] = results ? [
    ...references.suppliers.map(item => ({ kind: 'supplierReference' as const, item })),
    ...references.products.map(item => ({ kind: 'productReference' as const, item })),
    ...results.homeownerLeads.map(item => ({ kind: 'homeowner' as const, item })),
    ...results.companyLeads.map(item => ({ kind: 'company' as const, item })),
    ...results.users.map(item => ({ kind: 'user' as const, item })),
    ...results.registeredCompanies.map(item => ({ kind: 'registeredCompany' as const, item })),
    ...results.directoryCompanies.map(item => ({ kind: 'directoryCompany' as const, item })),
    ...(results.suppliers || []).map(item => ({ kind: 'supplier' as const, item })),
  ] : [];

  const navigateTo = useCallback((r: FlatResult) => {
    setOpen(false);
    setQ('');
    setResults(null);
    if (r.kind === 'supplierReference') router.push(`/admin/suppliers/${r.item.id}`);
    else if (r.kind === 'productReference') router.push(`/admin/suppliers/${r.item.supplierId}?productId=${r.item.id}#products`);
    else if (r.kind === 'homeowner') router.push(`/admin/inquiries?type=homeowner&search=${encodeURIComponent(r.item.phone)}`);
    else if (r.kind === 'company') router.push(`/admin/inquiries?type=company&search=${encodeURIComponent(r.item.phone)}`);
    else if (r.kind === 'user') router.push(`/admin/activity-log/user/${r.item.id}`);
    else if (r.kind === 'registeredCompany') router.push(`/admin/profile-companies/${r.item.id}`);
    else if (r.kind === 'directoryCompany') router.push(`/admin/companies/${r.item.id}`);
    else if (r.kind === 'supplier') router.push(`/admin/suppliers/${r.item.id}`);
  }, [router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter' && cursor >= 0 && flat[cursor]) { navigateTo(flat[cursor]); }
    else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasResults = results && flat.length > 0;
  const showPanel = open && queryEligible;

  return (
    <div ref={panelRef} className="relative w-[520px]">
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
        <input
          ref={inputRef}
          value={q}
          onChange={e => { ++requestId.current; setResults(null); setReferences({ suppliers: [], products: [] }); setQ(e.target.value); setOpen(true); setCursor(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={referenceOnly ? "搜索 Supplier / Product 编号，如 162 或 1943" : "搜索用户、公司、线索或 Supplier / Product 编号..."}
          className="w-full h-10 pl-9 pr-8 rounded-2xl border border-stone-200 bg-white text-sm text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/20 focus:border-[#B8864A] focus:bg-white transition"
        />
        {q && (
          <button onClick={() => { setQ(''); setResults(null); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showPanel && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-stone-200 rounded-2xl shadow-xl z-[200] overflow-hidden max-h-[70vh] overflow-y-auto">
          {loading && (
            <div className="px-4 py-3 text-sm text-stone-400">搜索中...</div>
          )}

          {error && <div role="alert" className="px-4 py-3 text-sm text-red-600">{error}</div>}
          {!loading && !error && !hasResults && queryEligible && (
            <div className="px-4 py-6 text-sm text-stone-400 text-center">未找到「{q}」相关结果</div>
          )}

          {!loading && hasResults && (() => {
            let idx = 0;
            const sections = [];

            if (references.suppliers.length || references.products.length) {
              sections.push(<div key="references">
                <div className="flex items-center gap-2 px-4 pt-3 pb-1.5"><Package className="w-3.5 h-3.5 text-stone-400" /><span className="text-[11px] font-semibold text-stone-400">编号精确匹配 · 原始资料</span></div>
                {references.suppliers.map(item => {
                  const i = idx++;
                  return <button key={`ref-s-${item.id}`} onClick={() => navigateTo({ kind: 'supplierReference', item })} className={`w-full text-left px-4 py-2.5 hover:bg-stone-50 ${cursor === i ? 'bg-stone-50' : ''}`}><div className="text-sm font-medium truncate">{item.name}</div><div className="text-xs text-stone-500 mt-0.5">供应商 · Supplier #{item.id}</div></button>;
                })}
                {references.products.map(item => {
                  const i = idx++;
                  return <button key={`ref-p-${item.id}`} onClick={() => navigateTo({ kind: 'productReference', item })} className={`w-full text-left px-4 py-2.5 hover:bg-stone-50 ${cursor === i ? 'bg-stone-50' : ''}`}><div className="text-sm font-medium truncate">{item.title || `Product ${item.id}`}</div><div className="text-xs text-stone-500 mt-0.5">商品 · Product {item.id} · Supplier #{item.supplierId}</div><div className="text-xs text-stone-500 truncate">{item.supplierName}</div></button>;
                })}
              </div>);
            }

            if (results.homeownerLeads.length > 0) {
              sections.push(
                <div key="homeowner">
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-stone-400" />
                    <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">业主询单</span>
                  </div>
                  {results.homeownerLeads.map(item => {
                    const i = idx++;
                    return (
                      <button key={item.id} onMouseDown={() => navigateTo({ kind: 'homeowner', item })}
                        className={`group w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-stone-50 transition ${cursor === i ? 'bg-stone-50' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 text-sm font-medium text-[#2c2c2c]">
                            <span className="truncate">{highlight(item.name || '—', q)}</span>
                            {item.name && <CopyButton text={item.name} />}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                            <span>{highlight(item.phone, q)}</span>
                            {item.city && <span>· {item.city}</span>}
                            <span className="text-stone-400">· 来源: {item.source}</span>
                          </div>
                        </div>
                        {item.crmStatus && <span className="shrink-0 text-[10px] text-stone-400">{CRM_LABEL[item.crmStatus] || item.crmStatus}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            }

            if (results.companyLeads.length > 0) {
              sections.push(
                <div key="company">
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
                    <Building2 className="w-3.5 h-3.5 text-stone-400" />
                    <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">公司线索</span>
                  </div>
                  {results.companyLeads.map(item => {
                    const i = idx++;
                    return (
                      <button key={item.id} onMouseDown={() => navigateTo({ kind: 'company', item })}
                        className={`group w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-stone-50 transition ${cursor === i ? 'bg-stone-50' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 text-sm font-medium text-[#2c2c2c]">
                            <span className="truncate">{highlight(item.name || '—', q)}</span>
                            {item.name && <CopyButton text={item.name} />}
                            {item.companyName && <span className="text-stone-400 font-normal ml-1 flex items-center gap-1">· <span className="truncate">{highlight(item.companyName, q)}</span><CopyButton text={item.companyName} /></span>}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                            <span>{highlight(item.phone, q)}</span>
                            {item.city && <span>· {item.city}</span>}
                            <span className="text-stone-400">· 渠道: {item.channel}</span>
                          </div>
                        </div>
                        {item.crmStatus && <span className="shrink-0 text-[10px] text-stone-400">{CRM_LABEL[item.crmStatus] || item.crmStatus}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            }

            if (results.users.length > 0) {
              sections.push(
                <div key="users">
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
                    <Users className="w-3.5 h-3.5 text-stone-400" />
                    <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">用户</span>
                  </div>
                  {results.users.map(item => {
                    const i = idx++;
                    return (
                      <button key={item.id} onMouseDown={() => navigateTo({ kind: 'user', item })}
                        className={`group w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-stone-50 transition ${cursor === i ? 'bg-stone-50' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 text-sm font-medium text-[#2c2c2c]">
                            <span className="truncate">{highlight(item.name, q)}</span>
                            <CopyButton text={item.name} />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                            {item.phone && <span>{highlight(item.phone, q)}</span>}
                            <span className="text-stone-400">· {highlight(item.email, q)}</span>
                            <span>· {item.source}</span>
                          </div>
                        </div>
                        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${item.status === 'suspended' ? 'bg-red-50 text-red-500' : 'bg-stone-100 text-stone-500'}`}>
                          {item.role === 'company' ? '装企' : item.role === 'homeowner' ? '业主' : item.role}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            }

            if (results.registeredCompanies.length > 0 || results.directoryCompanies.length > 0) {
              sections.push(
                <div key="companies">
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
                    <Building2 className="w-3.5 h-3.5 text-stone-400" />
                    <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">公司</span>
                  </div>
                  {results.registeredCompanies.map(item => {
                    const i = idx++;
                    return (
                      <button key={`cp-${item.id}`} onMouseDown={() => navigateTo({ kind: 'registeredCompany', item })}
                        className={`group w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-stone-50 transition ${cursor === i ? 'bg-stone-50' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 text-sm font-medium text-[#2c2c2c]">
                            <span className="truncate">{highlight(item.name, q)}</span>
                            <CopyButton text={item.name} />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                            {item.phone && <span>{highlight(item.phone, q)}</span>}
                            {item.city && <span>· {item.city}</span>}
                            <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full">已注册</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {results.directoryCompanies.map(item => {
                    const i = idx++;
                    return (
                      <button key={`uc-${item.id}`} onMouseDown={() => navigateTo({ kind: 'directoryCompany', item })}
                        className={`group w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-stone-50 transition ${cursor === i ? 'bg-stone-50' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 text-sm font-medium text-[#2c2c2c]">
                            <span className="truncate">{highlight(item.name, q)}</span>
                            <CopyButton text={item.name} />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                            {item.phone && <span>{highlight(item.phone, q)}</span>}
                            {item.city && <span>· {item.city}</span>}
                            <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full">目录</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            }

            if ((results.suppliers || []).length > 0) {
              sections.push(
                <div key="suppliers">
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
                    <Package className="w-3.5 h-3.5 text-stone-400" />
                    <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">供应商</span>
                  </div>
                  {(results.suppliers || []).map(item => {
                    const i = idx++;
                    return (
                      <button key={`sp-${item.id}`} onMouseDown={() => navigateTo({ kind: 'supplier', item })}
                        className={`group w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-stone-50 transition ${cursor === i ? 'bg-stone-50' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 text-sm font-medium text-[#2c2c2c]">
                            <span className="truncate">{highlight(item.name, q)}</span>
                            <CopyButton text={item.name} />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                            <span>{highlight(item.email, q)}</span>
                            <span>· {item.origin === 'china' ? '🇨🇳 China' : '🇦🇪 Dubai'}</span>
                          </div>
                        </div>
                        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ${item.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : item.status === 'rejected' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600'}`}>
                          {item.status}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            }


            return <>{sections}<div className="h-2" /></>;
          })()}
        </div>
      )}
    </div>
  );
}
