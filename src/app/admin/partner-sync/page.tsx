'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '@/lib/adminApi';
import { TableSpinner } from '@/components/ui/Spinner';
import { useAdminT } from '@/hooks/useAdminLang';
import { useAdminCountry } from '@/contexts/AdminCountryContext';
import { formatAdminDateTime, ADMIN_TIME_CLS } from '@/lib/formatTime';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CompanyRow {
  id: number;
  partner_id: number;
  partner_key: string;
  payload_json: string | Record<string, unknown>;
  review_status: string;
  synced_at: string;
}

interface ProductRow {
  id: number;
  partner_id: number;
  partner_key: string;
  external_id: string;
  payload_json: string | Record<string, unknown>;
  review_status: string;
  listing_status: string | null;
  is_deleted: number | null;
  synced_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function pickLang(map: unknown): string {
  if (!map || typeof map !== 'object') return '';
  const obj = map as Record<string, unknown>;
  if (typeof obj.en === 'string' && obj.en) return obj.en;
  for (const v of Object.values(obj)) {
    if (typeof v === 'string' && v) return v;
  }
  return '';
}

function parsePayload(raw: string | Record<string, unknown>): Record<string, unknown> {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw || {};
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// ── Status Badge ───────────────────────────────────────────────────────────────

const LISTING_BADGE: Record<string, string> = {
  listed: 'bg-green-100 text-green-700',
  unlisted: 'bg-stone-100 text-stone-600',
  draft: 'bg-amber-100 text-amber-700',
};

// ── Review Action Buttons ──────────────────────────────────────────────────────

function ActionButtons({
  onApprove, onReject, busy,
}: { onApprove: () => void; onReject: () => void; busy: boolean }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onApprove}
        disabled={busy}
        className="h-7 px-3 text-xs font-medium rounded-lg bg-[#b8864a] text-white hover:bg-[#a07640] disabled:opacity-40"
      >
        {busy ? '…' : '通过'}
      </button>
      <button
        onClick={onReject}
        disabled={busy}
        className="h-7 px-3 text-xs font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-40"
      >
        {busy ? '…' : '拒绝'}
      </button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function PartnerSyncPage() {
  const { t } = useAdminT();
  const { country } = useAdminCountry();

  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Per-row busy state: key = `c-{id}` or `p-{id}`
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cRes, pRes] = await Promise.all([
        adminApi.getPartnerSyncCompanies(country || undefined),
        adminApi.getPartnerSyncProducts(country || undefined),
      ]);
      setCompanies(cRes.items ?? []);
      setProducts(pRes.items ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('Load failed', '加载失败'));
    } finally {
      setLoading(false);
    }
  }, [country]);

  useEffect(() => { load(); }, [load]);

  // ── Company actions ──

  const handleCompanyAction = async (id: number, action: 'approve' | 'reject') => {
    const key = `c-${id}`;
    setBusy(prev => ({ ...prev, [key]: true }));
    try {
      if (action === 'approve') await adminApi.approvePartnerCompany(id);
      else await adminApi.rejectPartnerCompany(id);
      setCompanies(prev => prev.filter(c => c.id !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t('Action failed', '操作失败'));
    } finally {
      setBusy(prev => ({ ...prev, [key]: false }));
    }
  };

  // ── Product actions ──

  const handleProductAction = async (id: number, action: 'approve' | 'reject') => {
    const key = `p-${id}`;
    setBusy(prev => ({ ...prev, [key]: true }));
    try {
      if (action === 'approve') await adminApi.approvePartnerProduct(id);
      else await adminApi.rejectPartnerProduct(id);
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t('Action failed', '操作失败'));
    } finally {
      setBusy(prev => ({ ...prev, [key]: false }));
    }
  };

  // ── Render ──

  const isEmpty = companies.length === 0 && products.length === 0;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-stone-800">{t('Partner Sync Review', '合作方同步审核')}</h1>

      {error && (
        <div className="text-red-600 bg-red-50 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm"><tbody><TableSpinner colSpan={6} /></tbody></table>
        </div>
      ) : isEmpty ? (
        <div className="bg-white rounded-xl border border-stone-200 px-6 py-16 text-center text-stone-400 text-sm">
          {t('No pending items', '暂无待审数据')}
        </div>
      ) : (
        <>
          {/* ── 待审企业 ── */}
          <section>
            <h2 className="text-base font-semibold text-stone-700 mb-3">
              {t('Pending Companies', '待审企业')}
              <span className="ml-2 text-xs font-normal text-stone-400">({companies.length})</span>
            </h2>

            {companies.length === 0 ? (
              <p className="text-stone-400 text-sm px-1">{t('No pending companies', '暂无待审企业')}</p>
            ) : (
              <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200">
                        <th className="text-left px-4 py-3 font-medium text-stone-600">ID</th>
                        <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Company Name', '企业名称')}</th>
                        <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Description', '描述')}</th>
                        <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Partner', '合作方')}</th>
                        <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Synced', '同步时间')}</th>
                        <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Actions', '操作')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companies.map(c => {
                        const payload = parsePayload(c.payload_json);
                        const name = pickLang(payload.company_name) || pickLang(payload.name) || String(payload.company_name || payload.name || '—');
                        const desc = pickLang(payload.description) || String(payload.description || '');
                        return (
                          <tr key={c.id} className="border-b border-stone-100 hover:bg-stone-50">
                            <td className="px-4 py-3 text-stone-400 text-xs">{c.id}</td>
                            <td className="px-4 py-3 font-medium text-stone-800 max-w-[180px]">{truncate(name, 40)}</td>
                            <td className="px-4 py-3 text-stone-500 max-w-[220px]">{truncate(desc, 60)}</td>
                            <td className="px-4 py-3 text-stone-500 text-xs font-mono">{c.partner_key}</td>
                            <td className={`px-4 py-3 ${ADMIN_TIME_CLS}`}>{formatAdminDateTime(c.synced_at)}</td>
                            <td className="px-4 py-3">
                              <ActionButtons
                                busy={!!busy[`c-${c.id}`]}
                                onApprove={() => handleCompanyAction(c.id, 'approve')}
                                onReject={() => handleCompanyAction(c.id, 'reject')}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* ── 待审商品 ── */}
          <section>
            <h2 className="text-base font-semibold text-stone-700 mb-3">
              {t('Pending Products', '待审商品')}
              <span className="ml-2 text-xs font-normal text-stone-400">({products.length})</span>
            </h2>

            {products.length === 0 ? (
              <p className="text-stone-400 text-sm px-1">{t('No pending products', '暂无待审商品')}</p>
            ) : (
              <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-stone-50 border-b border-stone-200">
                        <th className="text-left px-4 py-3 font-medium text-stone-600">ID</th>
                        <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Title', '商品名称')}</th>
                        <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Category', '分类')}</th>
                        <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Images', '图片数')}</th>
                        <th className="text-left px-4 py-3 font-medium text-stone-600">{t('External ID', '外部 ID')}</th>
                        <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Partner', '合作方')}</th>
                        <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Listing', '上架状态')}</th>
                        <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Synced', '同步时间')}</th>
                        <th className="text-left px-4 py-3 font-medium text-stone-600">{t('Actions', '操作')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map(p => {
                        const payload = parsePayload(p.payload_json);

                        // Title: multilang map or plain string
                        const title = pickLang(payload.title) || String(payload.title || '—');

                        // Category: last item of category_path[lang] or category field
                        let category = '';
                        const catPath = payload.category_path;
                        if (catPath && typeof catPath === 'object') {
                          const cpObj = catPath as Record<string, unknown>;
                          const firstLang = Object.values(cpObj).find(v => Array.isArray(v)) as string[] | undefined;
                          if (firstLang && firstLang.length > 0) category = firstLang[firstLang.length - 1];
                        }
                        if (!category) {
                          category = pickLang(payload.category) || String(payload.category || '');
                        }

                        // Image count
                        const images = payload.images;
                        const imgCount = Array.isArray(images) ? images.length : 0;

                        const listingStatus = p.listing_status || 'unlisted';

                        return (
                          <tr key={p.id} className="border-b border-stone-100 hover:bg-stone-50">
                            <td className="px-4 py-3 text-stone-400 text-xs">{p.id}</td>
                            <td className="px-4 py-3 font-medium text-stone-800 max-w-[200px]">{truncate(title, 40)}</td>
                            <td className="px-4 py-3 text-stone-500 max-w-[120px]">{truncate(category, 30)}</td>
                            <td className="px-4 py-3 text-stone-500 text-center">{imgCount}</td>
                            <td className="px-4 py-3 text-stone-400 text-xs font-mono">{truncate(p.external_id || '', 20)}</td>
                            <td className="px-4 py-3 text-stone-500 text-xs font-mono">{p.partner_key}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${LISTING_BADGE[listingStatus] || LISTING_BADGE.unlisted}`}>
                                {listingStatus}
                              </span>
                            </td>
                            <td className={`px-4 py-3 ${ADMIN_TIME_CLS}`}>{formatAdminDateTime(p.synced_at)}</td>
                            <td className="px-4 py-3">
                              <ActionButtons
                                busy={!!busy[`p-${p.id}`]}
                                onApprove={() => handleProductAction(p.id, 'approve')}
                                onReject={() => handleProductAction(p.id, 'reject')}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
