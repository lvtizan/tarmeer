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

/**
 * Safely extract a display string from a value that may be:
 *  - a plain string → return as-is
 *  - a multilang object like { en: "…", vi: "…" } → return en, then vi, then first non-empty value
 *  - anything else → return ''
 * NEVER returns an object or '[object Object]'.
 */
function pickLang(map: unknown): string {
  if (map === null || map === undefined) return '';
  if (typeof map === 'string') return map;
  if (typeof map !== 'object' || Array.isArray(map)) return '';
  const obj = map as Record<string, unknown>;
  if (typeof obj.en === 'string' && obj.en) return obj.en;
  if (typeof obj.vi === 'string' && obj.vi) return obj.vi;
  for (const v of Object.values(obj)) {
    if (typeof v === 'string' && v) return v;
  }
  return '';
}

/**
 * Render ALL language entries of a multilang object as an array of [lang, value] pairs,
 * so the reviewer can see every language key explicitly.
 * If the value is a plain string, returns [['', value]].
 */
function allLangs(map: unknown): Array<[string, string]> {
  if (map === null || map === undefined) return [];
  if (typeof map === 'string') return map ? [['', map]] : [];
  if (typeof map !== 'object' || Array.isArray(map)) return [];
  const obj = map as Record<string, unknown>;
  const result: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && v) result.push([k, v]);
  }
  return result;
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

/** Resolve the leaf category label from a category_path multilang map or a plain category field. */
function resolveCategoryLeaf(catPath: unknown, categoryField: unknown): string {
  if (catPath && typeof catPath === 'object' && !Array.isArray(catPath)) {
    const cpObj = catPath as Record<string, unknown>;
    const firstArr = Object.values(cpObj).find(v => Array.isArray(v)) as string[] | undefined;
    if (firstArr && firstArr.length > 0) return String(firstArr[firstArr.length - 1]);
  }
  return pickLang(categoryField);
}

/** Build breadcrumb string from category_path for one lang. */
function categoryBreadcrumb(catPath: unknown, lang: string): string {
  if (!catPath || typeof catPath !== 'object' || Array.isArray(catPath)) return '';
  const cpObj = catPath as Record<string, unknown>;
  const arr = cpObj[lang];
  if (!Array.isArray(arr)) return '';
  return arr.filter((v): v is string => typeof v === 'string').join(' › ');
}

/** Get the unique lang keys present in a category_path object. */
function categoryPathLangs(catPath: unknown): string[] {
  if (!catPath || typeof catPath !== 'object' || Array.isArray(catPath)) return [];
  return Object.keys(catPath as Record<string, unknown>);
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

// ── Multilang Display ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LangBlock({ label, map }: { label: string; map: any }) {
  const entries = allLangs(map);
  if (entries.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="space-y-1">
        {entries.map(([lang, val]) => (
          <div key={lang} className="flex gap-2 text-sm">
            {lang && (
              <span className="shrink-0 text-xs font-mono bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded self-start mt-0.5">{lang}</span>
            )}
            <span className="text-stone-800 leading-snug">{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Company Detail Modal ───────────────────────────────────────────────────────

interface CompanyDetailModalProps {
  row: CompanyRow;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
}

function CompanyDetailModal({ row, busy, onApprove, onReject, onClose }: CompanyDetailModalProps) {
  const payload = parsePayload(row.payload_json);

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={handleBackdrop}
    >
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 shrink-0">
          <h2 className="text-base font-semibold text-stone-800">企业详情 <span className="text-stone-400 font-normal text-sm">#{row.id}</span></h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl leading-none px-1">✕</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {/* Meta */}
          <div className="flex flex-wrap gap-4 text-xs text-stone-500">
            <span>合作方：<span className="font-mono text-stone-700">{row.partner_key}</span></span>
            <span>审核状态：<span className="font-medium text-stone-700">{row.review_status}</span></span>
            <span>同步时间：<span className="text-stone-700">{formatAdminDateTime(row.synced_at)}</span></span>
          </div>

          <LangBlock label="企业名称" map={payload.company_name !== undefined ? payload.company_name : payload.name} />
          <LangBlock label="描述" map={payload.description} />

          {/* Contact info */}
          {!!(payload.contact_phone || payload.website || payload.whatsapp) && (
            <div>
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">联系方式</div>
              <div className="space-y-1 text-sm text-stone-700">
                {!!payload.contact_phone && <div>电话：{String(payload.contact_phone)}</div>}
                {!!payload.website && <div>网站：<a href={String(payload.website)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{String(payload.website)}</a></div>}
                {!!payload.whatsapp && <div>WhatsApp：{String(payload.whatsapp)}</div>}
              </div>
            </div>
          )}

          <LangBlock label="店铺地址" map={payload.store_address} />
          <LangBlock label="分类" map={payload.categories} />

          {/* Attributes */}
          {!!payload.attributes && (
            <div>
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">属性 (JSON)</div>
              <pre className="text-xs bg-stone-50 border border-stone-200 rounded-lg p-3 overflow-x-auto text-stone-600 whitespace-pre-wrap break-all">
                {JSON.stringify(payload.attributes, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-stone-100 shrink-0 bg-stone-50 rounded-b-2xl">
          <button onClick={onClose} className="text-sm text-stone-500 hover:text-stone-700">关闭</button>
          <div className="flex gap-2">
            <button
              onClick={onReject}
              disabled={busy}
              className="h-9 px-4 text-sm font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-40"
            >
              {busy ? '…' : '拒绝'}
            </button>
            <button
              onClick={onApprove}
              disabled={busy}
              className="h-9 px-4 text-sm font-medium rounded-lg bg-[#b8864a] text-white hover:bg-[#a07640] disabled:opacity-40"
            >
              {busy ? '…' : '通过'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Product Detail Modal ───────────────────────────────────────────────────────

interface ProductDetailModalProps {
  row: ProductRow;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
}

interface SkuItem {
  sku_id?: string | number;
  spec?: string | Record<string, unknown>;
  [key: string]: unknown;
}

function ProductDetailModal({ row, busy, onApprove, onReject, onClose }: ProductDetailModalProps) {
  const payload = parsePayload(row.payload_json);
  const attrs = (payload.attributes && typeof payload.attributes === 'object' && !Array.isArray(payload.attributes))
    ? payload.attributes as Record<string, unknown>
    : null;
  const skus: SkuItem[] = (attrs && Array.isArray(attrs.skus)) ? attrs.skus as SkuItem[] : [];
  const images: unknown[] = Array.isArray(payload.images) ? payload.images : [];
  const catLangs = categoryPathLangs(payload.category_path);

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={handleBackdrop}
    >
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 shrink-0">
          <h2 className="text-base font-semibold text-stone-800">商品详情 <span className="text-stone-400 font-normal text-sm">#{row.id}</span></h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl leading-none px-1">✕</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {/* Meta */}
          <div className="flex flex-wrap gap-4 text-xs text-stone-500">
            <span>合作方：<span className="font-mono text-stone-700">{row.partner_key}</span></span>
            <span>外部 ID：<span className="font-mono text-stone-700">{row.external_id || '—'}</span></span>
            <span>上架状态：<span className="font-medium text-stone-700">{row.listing_status || '—'}</span></span>
            <span>同步时间：<span className="text-stone-700">{formatAdminDateTime(row.synced_at)}</span></span>
          </div>

          <LangBlock label="商品名称" map={payload.title} />
          <LangBlock label="描述" map={payload.description} />

          {/* Category path — breadcrumb per language */}
          {catLangs.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">分类路径</div>
              <div className="space-y-1">
                {catLangs.map(lang => {
                  const bc = categoryBreadcrumb(payload.category_path, lang);
                  if (!bc) return null;
                  return (
                    <div key={lang} className="flex gap-2 text-sm">
                      <span className="shrink-0 text-xs font-mono bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded self-start mt-0.5">{lang}</span>
                      <span className="text-stone-800">{bc}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {catLangs.length === 0 && !!payload.category && (
            <LangBlock label="分类" map={payload.category} />
          )}

          {/* Images */}
          <div>
            <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">图片 ({images.length})</div>
            {images.length === 0 ? (
              <span className="text-sm text-stone-400">无图</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {images.map((img, i) => {
                  const url = typeof img === 'string' ? img
                    : (img && typeof img === 'object' && 'url' in img) ? String((img as Record<string, unknown>).url)
                    : '';
                  if (!url) return null;
                  return (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`图片 ${i + 1}`}
                        className="w-20 h-20 object-cover rounded-lg border border-stone-200 hover:opacity-80 transition-opacity"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* SKU list */}
          {skus.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">SKU 列表 ({skus.length})</div>
              <div className="space-y-1">
                {skus.map((sku, i) => {
                  const skuId = sku.sku_id !== undefined ? String(sku.sku_id) : `#${i + 1}`;
                  const spec = typeof sku.spec === 'string'
                    ? sku.spec
                    : (sku.spec && typeof sku.spec === 'object')
                      ? Object.entries(sku.spec as Record<string, unknown>).map(([k, v]) => `${k}: ${v}`).join(', ')
                      : '';
                  return (
                    <div key={i} className="flex gap-2 text-xs">
                      <span className="font-mono bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded">{skuId}</span>
                      {spec && <span className="text-stone-600">{spec}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Full attributes JSON */}
          {!!payload.attributes && (
            <div>
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">属性 (JSON)</div>
              <pre className="text-xs bg-stone-50 border border-stone-200 rounded-lg p-3 overflow-x-auto text-stone-600 whitespace-pre-wrap break-all">
                {JSON.stringify(payload.attributes, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-stone-100 shrink-0 bg-stone-50 rounded-b-2xl">
          <button onClick={onClose} className="text-sm text-stone-500 hover:text-stone-700">关闭</button>
          <div className="flex gap-2">
            <button
              onClick={onReject}
              disabled={busy}
              className="h-9 px-4 text-sm font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-40"
            >
              {busy ? '…' : '拒绝'}
            </button>
            <button
              onClick={onApprove}
              disabled={busy}
              className="h-9 px-4 text-sm font-medium rounded-lg bg-[#b8864a] text-white hover:bg-[#a07640] disabled:opacity-40"
            >
              {busy ? '…' : '通过'}
            </button>
          </div>
        </div>
      </div>
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

  // Detail modal state
  const [companyModal, setCompanyModal] = useState<CompanyRow | null>(null);
  const [productModal, setProductModal] = useState<ProductRow | null>(null);

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
      // Close modal if it was showing this company
      setCompanyModal(prev => prev?.id === id ? null : prev);
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
      // Close modal if it was showing this product
      setProductModal(prev => prev?.id === id ? null : prev);
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
              {companies.length >= 200 && (
                <span className="ml-2 text-xs font-normal text-amber-500">显示前 200 条</span>
              )}
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
                        // pickLang is safe: always returns a string
                        const name = pickLang(payload.company_name) || pickLang(payload.name) || '—';
                        const desc = pickLang(payload.description) || '—';
                        const isBusy = !!busy[`c-${c.id}`];
                        return (
                          <tr
                            key={c.id}
                            className="border-b border-stone-100 hover:bg-stone-50"
                          >
                            <td className="px-4 py-3 text-stone-400 text-xs">{c.id}</td>
                            <td className="px-4 py-3 font-medium max-w-[180px]">
                              <span
                                className="text-stone-800 cursor-pointer hover:text-[#b8864a] hover:underline"
                                onClick={() => setCompanyModal(c)}
                              >
                                {truncate(name, 40)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-stone-500 max-w-[220px]">{truncate(desc, 60)}</td>
                            <td className="px-4 py-3 text-stone-500 text-xs font-mono">{c.partner_key}</td>
                            <td className={`px-4 py-3 ${ADMIN_TIME_CLS}`}>{formatAdminDateTime(c.synced_at)}</td>
                            <td className="px-4 py-3">
                              <ActionButtons
                                busy={isBusy}
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
              {products.length >= 200 && (
                <span className="ml-2 text-xs font-normal text-amber-500">显示前 200 条</span>
              )}
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

                        // Title: multilang map or plain string — pickLang always returns a string
                        const title = pickLang(payload.title) || '—';

                        // Category: safe string only
                        const category = resolveCategoryLeaf(payload.category_path, payload.category);

                        // Image count
                        const imgCount = Array.isArray(payload.images) ? payload.images.length : 0;

                        const listingStatus = p.listing_status || 'unlisted';
                        const isBusy = !!busy[`p-${p.id}`];

                        return (
                          <tr key={p.id} className="border-b border-stone-100 hover:bg-stone-50">
                            <td className="px-4 py-3 text-stone-400 text-xs">{p.id}</td>
                            <td className="px-4 py-3 font-medium max-w-[200px]">
                              <span
                                className="text-stone-800 cursor-pointer hover:text-[#b8864a] hover:underline"
                                onClick={() => setProductModal(p)}
                              >
                                {truncate(title, 40)}
                              </span>
                            </td>
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
                                busy={isBusy}
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

      {/* ── Company Detail Modal ── */}
      {companyModal && (
        <CompanyDetailModal
          row={companyModal}
          busy={!!busy[`c-${companyModal.id}`]}
          onApprove={() => handleCompanyAction(companyModal.id, 'approve')}
          onReject={() => handleCompanyAction(companyModal.id, 'reject')}
          onClose={() => setCompanyModal(null)}
        />
      )}

      {/* ── Product Detail Modal ── */}
      {productModal && (
        <ProductDetailModal
          row={productModal}
          busy={!!busy[`p-${productModal.id}`]}
          onApprove={() => handleProductAction(productModal.id, 'approve')}
          onReject={() => handleProductAction(productModal.id, 'reject')}
          onClose={() => setProductModal(null)}
        />
      )}
    </div>
  );
}
