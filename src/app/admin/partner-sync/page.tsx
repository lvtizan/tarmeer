'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { adminApi } from '@/lib/adminApi';
import { TableSpinner } from '@/components/ui/Spinner';
import { useAdminT } from '@/hooks/useAdminLang';
import { useAdminCountry } from '@/contexts/AdminCountryContext';
import { formatAdminDateTime, ADMIN_TIME_CLS } from '@/lib/formatTime';
import DeleteReasonModal from '@/components/admin/DeleteReasonModal';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CompanyRow {
  id: number;
  partner_id: number;
  partner_key: string;
  supplier_ref: string;
  payload_json: string | Record<string, unknown>;
  review_status: string;
  synced_at: string;
}

interface ProductRow {
  id: number;
  partner_id: number;
  partner_key: string;
  supplier_ref: string;
  external_id: string;
  payload_json: string | Record<string, unknown>;
  review_status: string;
  listing_status: string | null;
  is_deleted: number | null;
  synced_at: string;
}

/** One entry in Level 1 — one row per unique (partner_id + supplier_ref) */
interface PartnerGroup {
  groupKey: string;             // composite `${partner_id}::${supplier_ref}`
  partner_id: number;
  partner_key: string;
  supplier_ref: string;
  company: CompanyRow | null;   // pending company record, if any
  products: ProductRow[];       // pending products for this seller
  latestSyncedAt: string;       // max(company.synced_at, max products.synced_at)
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

/** Resolve the best category breadcrumb string (first lang that has content). */
function resolveBestBreadcrumb(catPath: unknown, categoryField: unknown): string {
  const langs = categoryPathLangs(catPath);
  for (const lang of langs) {
    const bc = categoryBreadcrumb(catPath, lang);
    if (bc) return bc;
  }
  return pickLang(categoryField);
}

/** Extract image URL list from payload */
function extractImages(payload: Record<string, unknown>): string[] {
  const images = payload.images;
  if (!Array.isArray(images)) return [];
  return images.reduce<string[]>((acc, img) => {
    const url = typeof img === 'string' ? img
      : (img && typeof img === 'object' && 'url' in img)
        ? String((img as Record<string, unknown>).url)
        : '';
    if (url) acc.push(url);
    return acc;
  }, []);
}

/** Build composite group key from partner_id and supplier_ref */
function makeGroupKey(partner_id: number, supplier_ref: string): string {
  return `${partner_id}::${supplier_ref}`;
}

/** Group companies and products by (partner_id + supplier_ref) */
function groupBySeller(companies: CompanyRow[], products: ProductRow[]): PartnerGroup[] {
  const map = new Map<string, PartnerGroup>();

  for (const c of companies) {
    const key = makeGroupKey(c.partner_id, c.supplier_ref || '');
    const existing = map.get(key);
    if (existing) {
      existing.company = c;
      if (c.synced_at > existing.latestSyncedAt) existing.latestSyncedAt = c.synced_at;
    } else {
      map.set(key, {
        groupKey: key,
        partner_id: c.partner_id,
        partner_key: c.partner_key,
        supplier_ref: c.supplier_ref || '',
        company: c,
        products: [],
        latestSyncedAt: c.synced_at,
      });
    }
  }

  for (const p of products) {
    const key = makeGroupKey(p.partner_id, p.supplier_ref || '');
    let group = map.get(key);
    if (!group) {
      group = {
        groupKey: key,
        partner_id: p.partner_id,
        partner_key: p.partner_key,
        supplier_ref: p.supplier_ref || '',
        company: null,
        products: [],
        latestSyncedAt: p.synced_at,
      };
      map.set(key, group);
    }
    group.products.push(p);
    if (p.synced_at > group.latestSyncedAt) group.latestSyncedAt = p.synced_at;
  }

  return Array.from(map.values()).sort((a, b) => b.latestSyncedAt.localeCompare(a.latestSyncedAt));
}

/** Display label for supplier_ref: empty string = 默认/单一 */
function displaySupplierRef(supplier_ref: string): string {
  return supplier_ref || '默认/单一';
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
        className="h-9 px-4 text-sm font-medium rounded-lg bg-[#b8864a] text-white hover:bg-[#a07640] disabled:opacity-40"
      >
        {busy ? '…' : '通过'}
      </button>
      <button
        onClick={onReject}
        disabled={busy}
        className="h-9 px-4 text-sm font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-40"
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

// ── Image Lightbox ─────────────────────────────────────────────────────────────

interface LightboxProps {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

function Lightbox({ images, initialIndex, onClose }: LightboxProps) {
  const [idx, setIdx] = useState(initialIndex);

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const prev = () => setIdx(i => (i - 1 + images.length) % images.length);
  const next = () => setIdx(i => (i + 1) % images.length);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70"
      onClick={handleBackdrop}
    >
      <div className="relative max-w-3xl w-full mx-4 flex flex-col items-center gap-3">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-0 right-0 -translate-y-10 text-white/80 hover:text-white text-2xl leading-none"
        >
          ✕
        </button>

        {/* Counter */}
        {images.length > 1 && (
          <div className="text-white/60 text-xs self-end">{idx + 1} / {images.length}</div>
        )}

        {/* Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[idx]}
          alt={`图片 ${idx + 1}`}
          referrerPolicy="no-referrer"
          className="max-h-[75vh] max-w-full rounded-xl object-contain bg-black/30"
          onError={(e) => { (e.currentTarget as HTMLImageElement).alt = '图片加载失败'; }}
        />

        {/* Prev / Next */}
        {images.length > 1 && (
          <div className="flex gap-4">
            <button
              onClick={prev}
              className="px-4 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 text-sm"
            >
              ‹ 上一张
            </button>
            <button
              onClick={next}
              className="px-4 py-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 text-sm"
            >
              下一张 ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Level 1: Seller List ───────────────────────────────────────────────────────

interface SellerListProps {
  groups: PartnerGroup[];
  onSelect: (groupKey: string) => void;
  selected: Set<string>;
  onToggleOne: (groupKey: string) => void;
  onToggleAll: (checked: boolean) => void;
}

function SellerList({ groups, onSelect, selected, onToggleOne, onToggleAll }: SellerListProps) {
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selected.size > 0 && selected.size < groups.length;
    }
  }, [selected, groups.length]);
  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="px-4 py-3 w-10">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={groups.length > 0 && selected.size === groups.length}
                  onChange={(e) => onToggleAll(e.target.checked)}
                  className="rounded cursor-pointer"
                />
              </th>
              <th className="text-left px-4 py-3 font-medium text-stone-600">企业名称</th>
              <th className="text-left px-4 py-3 font-medium text-stone-600">合作方 Key</th>
              <th className="text-left px-4 py-3 font-medium text-stone-600">供应商ID</th>
              <th className="text-center px-4 py-3 font-medium text-stone-600">待审商品</th>
              <th className="text-center px-4 py-3 font-medium text-stone-600">企业信息</th>
              <th className="text-left px-4 py-3 font-medium text-stone-600">最近同步</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => {
              const companyPayload = g.company ? parsePayload(g.company.payload_json) : null;
              const displayName = companyPayload
                ? (pickLang(companyPayload.company_name) || pickLang(companyPayload.name) || g.partner_key)
                : g.partner_key;

              return (
                <tr
                  key={g.groupKey}
                  className={`border-b border-stone-100 hover:bg-stone-50 cursor-pointer ${selected.has(g.groupKey) ? 'bg-amber-50/40' : ''}`}
                  onClick={() => onSelect(g.groupKey)}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(g.groupKey)}
                      onChange={() => onToggleOne(g.groupKey)}
                      className="rounded cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-stone-800 hover:text-[#b8864a] max-w-[220px]">
                    {truncate(displayName, 45)}
                  </td>
                  <td className="px-4 py-3 text-stone-500 text-xs font-mono">{g.partner_key}</td>
                  <td className="px-4 py-3 text-xs">
                    {g.supplier_ref ? (
                      <span className="font-mono text-stone-700">{g.supplier_ref}</span>
                    ) : (
                      <span className="text-stone-400 italic">默认/单一</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {g.products.length > 0 ? (
                      <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                        {g.products.length}
                      </span>
                    ) : (
                      <span className="text-stone-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {g.company ? (
                      <span className="inline-flex items-center justify-center h-5 px-2 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">有</span>
                    ) : (
                      <span className="text-stone-300 text-xs">无</span>
                    )}
                  </td>
                  <td className={`px-4 py-3 ${ADMIN_TIME_CLS}`}>{formatAdminDateTime(g.latestSyncedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Level 2: Partner Detail ────────────────────────────────────────────────────

interface PartnerDetailProps {
  group: PartnerGroup;
  busy: Record<string, boolean>;
  onBack: () => void;
  onCompanyAction: (id: number, action: 'approve' | 'reject') => void;
  onProductAction: (id: number, action: 'approve' | 'reject') => void;
}

function PartnerDetail({ group, busy, onBack, onCompanyAction, onProductAction }: PartnerDetailProps) {
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  const companyPayload = group.company ? parsePayload(group.company.payload_json) : null;
  const companyName = companyPayload
    ? (pickLang(companyPayload.company_name) || pickLang(companyPayload.name) || group.partner_key)
    : group.partner_key;

  return (
    <div className="space-y-6">
      {/* ── Header / Back ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800 transition-colors"
        >
          ← 返回列表
        </button>
        <span className="text-stone-300">|</span>
        <h2 className="text-base font-semibold text-stone-800">{truncate(companyName, 50)}</h2>
        <span className="text-xs font-mono text-stone-400">{group.partner_key}</span>
        <span className="text-xs text-stone-400">
          供应商ID：<span className="font-mono text-stone-600">{displaySupplierRef(group.supplier_ref)}</span>
        </span>
      </div>

      {/* ── 企业信息区 ── */}
      <section>
        <h3 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-3">企业信息</h3>
        {!group.company ? (
          <div className="bg-white rounded-xl border border-stone-200 px-6 py-8 text-center text-stone-400 text-sm">
            无待审企业信息
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-5">
            {/* Meta */}
            <div className="flex flex-wrap gap-4 text-xs text-stone-500">
              <span>ID：<span className="font-mono text-stone-700">#{group.company.id}</span></span>
              <span>合作方：<span className="font-mono text-stone-700">{group.company.partner_key}</span></span>
              <span>供应商ID：<span className="font-mono text-stone-700">{displaySupplierRef(group.company.supplier_ref)}</span></span>
              <span>审核状态：<span className="font-medium text-stone-700">{group.company.review_status}</span></span>
              <span>同步时间：<span className="text-stone-700">{formatAdminDateTime(group.company.synced_at)}</span></span>
            </div>

            {companyPayload && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
                  <LangBlock label="企业名称" map={companyPayload.company_name !== undefined ? companyPayload.company_name : companyPayload.name} />
                  <LangBlock label="店铺地址" map={companyPayload.store_address} />
                  <LangBlock label="描述" map={companyPayload.description} />
                  <LangBlock label="分类" map={companyPayload.categories} />

                  {!!(companyPayload.contact_phone || companyPayload.website || companyPayload.whatsapp) && (
                    <div>
                      <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">联系方式</div>
                      <div className="space-y-1 text-sm text-stone-700">
                        {!!companyPayload.contact_phone && <div>电话：{String(companyPayload.contact_phone)}</div>}
                        {!!companyPayload.website && (
                          <div>网站：<a href={String(companyPayload.website)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{String(companyPayload.website)}</a></div>
                        )}
                        {!!companyPayload.whatsapp && <div>WhatsApp：{String(companyPayload.whatsapp)}</div>}
                      </div>
                    </div>
                  )}
                </div>

                {!!companyPayload.attributes && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-stone-500 hover:text-stone-700 select-none">属性 (JSON)</summary>
                    <pre className="mt-1 bg-stone-50 border border-stone-200 rounded-lg p-3 overflow-x-auto text-stone-600 whitespace-pre-wrap break-all">
                      {JSON.stringify(companyPayload.attributes, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Company action buttons — 仅 pending 时可审核；已通过则显示状态（作为待审商品的上下文） */}
            {group.company.review_status === 'pending' ? (
              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => onCompanyAction(group.company!.id, 'reject')}
                  disabled={!!busy[`c-${group.company!.id}`]}
                  className="h-9 px-4 text-sm font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-40"
                >
                  {busy[`c-${group.company!.id}`] ? '…' : '拒绝企业信息'}
                </button>
                <button
                  onClick={() => onCompanyAction(group.company!.id, 'approve')}
                  disabled={!!busy[`c-${group.company!.id}`]}
                  className="h-9 px-4 text-sm font-medium rounded-lg bg-[#b8864a] text-white hover:bg-[#a07640] disabled:opacity-40"
                >
                  {busy[`c-${group.company!.id}`] ? '…' : '通过企业信息'}
                </button>
              </div>
            ) : (
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium">
                  企业信息已通过（以下为待审商品）
                </span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── 商品列表区 ── */}
      <section>
        <h3 className="text-sm font-semibold text-stone-600 uppercase tracking-wide mb-3">
          待审商品
          <span className="ml-2 text-xs font-normal text-stone-400 normal-case">({group.products.length})</span>
        </h3>

        {group.products.length === 0 ? (
          <div className="bg-white rounded-xl border border-stone-200 px-6 py-8 text-center text-stone-400 text-sm">
            无待审商品
          </div>
        ) : (
          <div className="space-y-3">
            {group.products.map(p => {
              const payload = parsePayload(p.payload_json);
              const title = pickLang(payload.title) || '—';
              const breadcrumb = resolveBestBreadcrumb(payload.category_path, payload.category);
              const images = extractImages(payload);
              const listingStatus = p.listing_status || 'unlisted';
              const isBusy = !!busy[`p-${p.id}`];

              return (
                <div key={p.id} className="bg-white rounded-xl border border-stone-200 p-4">
                  <div className="flex gap-4 items-center">
                    {/* Content */}
                    <div className="min-w-0 space-y-1.5 shrink-0 w-[340px]">
                      <div className="font-medium text-stone-800 text-sm leading-snug">
                        {truncate(title, 80)}
                      </div>

                      {breadcrumb && (
                        <div className="text-xs text-stone-500 leading-snug">{truncate(breadcrumb, 80)}</div>
                      )}

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-400">
                        {p.external_id && (
                          <span>外部ID：<span className="font-mono text-stone-500">{truncate(p.external_id, 20)}</span></span>
                        )}
                        <span>
                          上架：
                          <span className={`inline-flex ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${LISTING_BADGE[listingStatus] || LISTING_BADGE.unlisted}`}>
                            {listingStatus}
                          </span>
                        </span>
                        <span className={ADMIN_TIME_CLS}>{formatAdminDateTime(p.synced_at)}</span>
                      </div>
                    </div>

                    {/* Images spread out (after meta/date, filling the space) */}
                    <div className="flex-1 min-w-0 flex flex-wrap gap-2 content-center">
                      {images.length === 0 ? (
                        <span className="text-xs text-stone-300">无图</span>
                      ) : (
                        images.map((src, i) => (
                          <button
                            key={i}
                            onClick={() => setLightbox({ images, index: i })}
                            className="w-12 h-12 rounded-md overflow-hidden border border-stone-200 hover:ring-2 hover:ring-[#b8864a] transition-all focus:outline-none"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src}
                              alt={`图 ${i + 1}`}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
                            />
                          </button>
                        ))
                      )}
                    </div>

                    {/* Actions */}
                    <div className="shrink-0 self-center">
                      <ActionButtons
                        busy={isBusy}
                        onApprove={() => onProductAction(p.id, 'approve')}
                        onReject={() => onProductAction(p.id, 'reject')}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
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

  // Level 2 navigation: composite key `${partner_id}::${supplier_ref}` (null = Level 1)
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // 多选删除（Level 1）：selected 存 groupKey
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
  }, [country, t]);

  useEffect(() => { load(); }, [load]);

  // Reset to Level 1 + 清空多选 when country changes
  useEffect(() => { setSelectedKey(null); setSelected(new Set()); }, [country]);

  // ── Company actions ──

  const handleCompanyAction = async (id: number, action: 'approve' | 'reject') => {
    const key = `c-${id}`;
    setBusy(prev => ({ ...prev, [key]: true }));
    try {
      if (action === 'approve') await adminApi.approvePartnerCompany(id);
      else await adminApi.rejectPartnerCompany(id);
      // Optimistic: remove from local state
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
      // Optimistic: remove from local state
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t('Action failed', '操作失败'));
    } finally {
      setBusy(prev => ({ ...prev, [key]: false }));
    }
  };

  // ── Derived data ──

  const groups = groupBySeller(companies, products);
  const isEmpty = groups.length === 0;

  // ── 多选删除 ──
  const toggleOne = (groupKey: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(groupKey) ? next.delete(groupKey) : next.add(groupKey);
      return next;
    });
  };
  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(groups.map(g => g.groupKey)) : new Set());
  };
  const handleBulkDelete = async (reason: string) => {
    const targets = groups.filter(g => selected.has(g.groupKey));
    if (targets.length === 0) return;
    setDeleteLoading(true);
    try {
      await adminApi.bulkDeletePartnerSync(
        targets.map(g => ({ partner_id: g.partner_id, supplier_ref: g.supplier_ref })),
        reason
      );
      setSelected(new Set());
      setDeleteModalOpen(false);
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t('Delete failed', '删除失败'));
    } finally {
      setDeleteLoading(false);
    }
  };
  // 选中项的显示名（供删除确认弹窗）
  const selectedNames = groups
    .filter(g => selected.has(g.groupKey))
    .map(g => {
      const cp = g.company ? parsePayload(g.company.payload_json) : null;
      return cp ? (pickLang(cp.company_name) || pickLang(cp.name) || g.partner_key) : g.partner_key;
    });

  // After optimistic removal a seller group may become empty — navigate back if so
  const selectedGroup = selectedKey !== null
    ? groups.find(g => g.groupKey === selectedKey) ?? null
    : null;

  // If the selected seller no longer has any pending items, go back to level 1
  useEffect(() => {
    if (
      selectedKey !== null &&
      !loading &&
      !groups.find(g => g.groupKey === selectedKey)
    ) {
      setSelectedKey(null);
    }
  }, [groups, selectedKey, loading]);

  // ── Render ──

  return (
    <div className="space-y-6">
      {deleteModalOpen && (
        <DeleteReasonModal
          names={selectedNames}
          onConfirm={(reason) => handleBulkDelete(reason)}
          onCancel={() => setDeleteModalOpen(false)}
          loading={deleteLoading}
        />
      )}
      <h1 className="text-2xl font-bold text-stone-800">{t('Partner Sync Review', '合作方同步审核')}</h1>

      {error && (
        <div className="text-red-600 bg-red-50 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm"><tbody><TableSpinner colSpan={7} /></tbody></table>
        </div>
      ) : isEmpty ? (
        <div className="bg-white rounded-xl border border-stone-200 px-6 py-16 text-center text-stone-400 text-sm">
          {t('No pending items', '暂无待审数据')}
        </div>
      ) : selectedGroup !== null ? (
        /* ── Level 2: Partner Detail ── */
        <PartnerDetail
          group={selectedGroup}
          busy={busy}
          onBack={() => setSelectedKey(null)}
          onCompanyAction={handleCompanyAction}
          onProductAction={handleProductAction}
        />
      ) : (
        /* ── Level 1: Seller List ── */
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-stone-500">
              共 <span className="font-medium text-stone-700">{groups.length}</span> 个卖家/供应商有待审数据，点击行进入详情。
            </p>
            {selected.size > 0 && (
              <button
                onClick={() => setDeleteModalOpen(true)}
                className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 shrink-0"
              >
                删除所选 {selected.size} 家
              </button>
            )}
          </div>
          <SellerList
            groups={groups}
            onSelect={setSelectedKey}
            selected={selected}
            onToggleOne={toggleOne}
            onToggleAll={toggleAll}
          />
        </>
      )}
    </div>
  );
}
