'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { MapPin, Clock, Package, Search, X, ArrowRight } from 'lucide-react';
import { resolveVariantUrl, resolveImageUrl } from '@/lib/imageUrl';
import { ORIGIN_LABEL, ORIGIN_BADGE_CLASS } from '@/lib/supplierConstants';
import AdminSelect from '@/components/ui/AdminSelect';
import { GOOGLE_MAPS_URL } from '@/lib/constants';
// TODO: migrate SupplierLeadModal
// import SupplierLeadModal from '@/components/suppliers/SupplierLeadModal';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || '/api';

const CATEGORY_OPTIONS_FALLBACK = [
  { value: 'furniture', label: 'Furniture' },
  { value: 'stone', label: 'Tile & Stone' },
  { value: 'lighting', label: 'Lighting' },
  { value: 'plants', label: 'Plants & Landscaping' },
  { value: 'flooring', label: 'Flooring' },
  { value: 'kitchen', label: 'Kitchen & Bath' },
  { value: 'curtains', label: 'Curtains & Textiles' },
  { value: 'paint', label: 'Paint & Coatings' },
  { value: 'hardware', label: 'Doors & Windows' },
  { value: 'other', label: 'Other' },
];

export interface Supplier {
  id: number;
  company_name: string;
  slug: string;
  description: string;
  logo_url: string | null;
  cover_image_url: string | null;
  first_product_image?: string | null;
  origin: 'china' | 'dubai';
  categories: string[] | string | null;
  has_physical_store: number;
  store_address: string | null;
  google_maps_url: string | null;
  contact_phone: string | null;
}

function parseCategories(c: Supplier['categories']): string[] {
  if (!c) return [];
  if (Array.isArray(c)) return c;
  try { const p = JSON.parse(c); return Array.isArray(p) ? p : [c]; } catch { return [c]; }
}

// 紧凑网格卡：封面 16:9 + 名称 + 品类 chips（整卡可点）——替代旧整宽长行，页面不再天梯般长
const SUPPLIER_CARD_FALLBACK = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80';

function SupplierCard({ s }: { s: Supplier }) {
  const cats = parseCategories(s.categories);
  // 封面优先级：手动封面 → 首张产品图 → 通用占位。
  // 注：只有画册的供应商暂用通用占位（不拿画册首页当封面，避免暴露厂家 logo/封面；待 AI 统一封面方案）
  const coverSrc = s.cover_image_url
    ? resolveVariantUrl(s.cover_image_url, 'thumb')
    : s.first_product_image
      ? resolveVariantUrl(s.first_product_image, 'thumb')
      : SUPPLIER_CARD_FALLBACK;
  return (
    <Link
      href={`/materials/suppliers/${s.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-[#b8864a]/40 hover:shadow-sm"
    >
      {/* Cover 16:9 */}
      <div className="aspect-video overflow-hidden bg-stone-100">
        <img
          src={coverSrc}
          onError={(e) => {
            // 变体缺失→回退原图；再不行→通用占位（画册页 404 也走这里）
            const primary = s.cover_image_url || s.first_product_image || null;
            const fallback = resolveImageUrl(primary);
            if (fallback && e.currentTarget.src !== fallback) {
              e.currentTarget.src = fallback;
            } else if (e.currentTarget.src !== SUPPLIER_CARD_FALLBACK) {
              e.currentTarget.src = SUPPLIER_CARD_FALLBACK;
            }
          }}
          alt={s.company_name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center gap-2 flex-wrap">
          <h3 className="line-clamp-1 text-[15px] font-semibold text-[#1c1917] transition-colors group-hover:text-[#b8864a]">
            {s.company_name}
          </h3>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${ORIGIN_BADGE_CLASS[s.origin]}`}>
            {ORIGIN_LABEL[s.origin]}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {cats.slice(0, 3).map(c => (
            <span key={c} className="rounded-2xl border border-stone-200 px-2 py-0.5 text-[11px] capitalize text-stone-500">
              {c}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

function FilterOption({
  selected, onClick, children,
}: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${
        selected
          ? 'bg-[#f5f0e8] border border-[#d4c4a8] text-[#1c1917]'
          : 'text-stone-500 hover:bg-stone-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
          selected ? 'border-[#b8864a] bg-white' : 'border-stone-300'
        }`}>
          {selected && <span className="w-2 h-2 rounded-sm bg-[#b8864a] block" />}
        </div>
        {children}
      </div>
    </button>
  );
}

interface MaterialsClientProps {
  initialSuppliers: Supplier[];
  /** AE 站在 hero 显示「Explore New Materials」入口（→ /materials/new-materials）；VN 站不显示。 */
  showNewMaterialsEntry?: boolean;
}

export default function MaterialsClient({ initialSuppliers, showNewMaterialsEntry }: MaterialsClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers);
  const [loading, setLoading] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState(CATEGORY_OPTIONS_FALLBACK);

  const originFilter = searchParams.get('origin') || '';
  const categoryFilter = searchParams.get('category') || '';
  const searchFilter = searchParams.get('search') || '';
  // 客户端搜索：受控输入即时过滤，防抖后镜像到 URL（?search=）以便分享/深链
  const [searchInput, setSearchInput] = useState(searchFilter);

  function setOriginFilter(val: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (val) params.set('origin', val); else params.delete('origin');
    router.replace(`/materials?${params.toString()}`);
  }

  function setCategoryFilter(val: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (val) params.set('category', val); else params.delete('category');
    router.replace(`/materials?${params.toString()}`);
  }

  useEffect(() => {
    fetch(`${API_BASE}/suppliers/categories`)
      .then(r => r.json())
      .then(data => {
        // API returns { groups: [{value, label, categories: [{value, label}]}], ungrouped: [{value, label}] }
        const flat: { value: string; label: string }[] = [];
        if (Array.isArray(data.groups)) {
          for (const g of data.groups) {
            if (Array.isArray(g.categories)) flat.push(...g.categories.map((c: { value: string; label: string }) => ({ value: c.value, label: c.label })));
          }
        }
        if (Array.isArray(data.ungrouped)) {
          flat.push(...data.ungrouped.map((c: { value: string; label: string }) => ({ value: c.value, label: c.label })));
        }
        if (flat.length) setCategoryOptions(flat);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (originFilter) params.set('origin', originFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    // 一次加载全部符合条件的供应商（当前 ~55 家），前端本地按名字过滤——不再被旧的 limit=50 静默截断
    params.set('limit', '200');
    params.set('order', 'list');

    fetch(`${API_BASE}/suppliers?${params}`)
      .then(r => r.json())
      .then(data => setSuppliers(data.suppliers || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [originFilter, categoryFilter]);

  // 输入防抖后镜像到 URL（仅为可分享/可后退；实际过滤走本地即时计算，见下方 visibleSuppliers）
  useEffect(() => {
    const t = setTimeout(() => {
      const cur = searchParams.get('search') || '';
      const next = searchInput.trim();
      if (next === cur) return;
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set('search', next); else params.delete('search');
      router.replace(`/materials?${params.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // 反向同步：URL 的 ?search= 变化（浏览器后退/前进、深链）回填输入框，避免输入框与 URL/列表不一致
  useEffect(() => {
    setSearchInput(prev => (prev.trim() === searchFilter ? prev : searchFilter));
  }, [searchFilter]);

  // 本地即时过滤：按公司名（英文/拼音，库里存的就是这个）不区分大小写子串匹配
  const q = searchInput.trim().toLowerCase();
  const visibleSuppliers = q
    ? suppliers.filter(s => (s.company_name || '').toLowerCase().includes(q))
    : suppliers;

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Hero：真实供应商室内图（Suofeiya 定制家居，走多档 webp）+ 左深右浅遮罩保证白字可读 + 金色光晕 + 金色 eyebrow + 衬线标题 + 顶部搜索条 */}
      <section className="relative overflow-hidden bg-[#201b17]">
        {/* 背景照片：本地(public/images)与线上(rsync 到 portal)同路径均可显 */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-70"
          style={{ backgroundImage: 'url(/images/materials/suppliers-hero.webp)' }}
        />
        {/* 文字对比遮罩：左深右浅（左侧压暗托住白字，右侧透出室内实景） */}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(24,20,16,0.92)_0%,rgba(24,20,16,0.74)_40%,rgba(24,20,16,0.30)_100%)]" />
        {/* 金色光晕（左上，衬托标题） */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_75%_at_15%_-5%,rgba(184,134,74,0.22),transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
          <p className="text-sm font-semibold text-[#c6a065] uppercase tracking-wider">
            Verified Material Suppliers
          </p>
          <h1 className="font-serif text-[28px] sm:text-[36px] text-white font-medium leading-tight mt-3 mb-2">
            Find Premium Material Suppliers in UAE
          </h1>
          <p className="text-white/60 text-[15px]">
            Verified suppliers from China and Dubai — furniture, stone, lighting, and more.
          </p>

          {/* 引导入口：新材料页（AE only，主 CTA）+ 供应商登录（次要，留在 hero 好找）。搜索已移到下方列表上方。 */}
          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
            {showNewMaterialsEntry && (
              <Link
                href="/materials/new-materials"
                className="btn-primary inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap px-6"
              >
                Explore New Materials <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            <Link
              href="/supplier/auth"
              className="inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/30 px-6 font-semibold text-white transition hover:bg-white/10"
            >
              Supplier Login
            </Link>
          </div>
        </div>
      </section>

      {/* Breadcrumb */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-0">
        <nav className="flex items-center gap-1.5 text-xs text-stone-400">
          <Link href="/" className="hover:text-[#b8864a] transition-colors">Home</Link>
          <span>/</span>
          <span className="text-stone-600 font-medium">Materials</span>
        </nav>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex gap-8 items-start">
        {/* Left Sidebar */}
        <aside className="w-60 flex-shrink-0 hidden lg:block">
          <div className="lg:sticky lg:top-24">
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-6">
              {/* Origin */}
              <div>
                <h4 className="text-xs font-medium text-[#1c1917] uppercase tracking-wider mb-3">Origin</h4>
                <div className="space-y-1">
                  <FilterOption selected={originFilter === ''} onClick={() => setOriginFilter('')}>All Origins</FilterOption>
                  <FilterOption selected={originFilter === 'dubai'} onClick={() => setOriginFilter('dubai')}>🇦🇪 Dubai</FilterOption>
                  <FilterOption selected={originFilter === 'china'} onClick={() => setOriginFilter('china')}>🇨🇳 China</FilterOption>
                </div>
              </div>

              <hr className="border-stone-100" />

              {/* Category */}
              <div>
                <h4 className="text-xs font-medium text-[#1c1917] uppercase tracking-wider mb-3">Category</h4>
                <div className="space-y-1">
                  {[{ value: '', label: 'All Categories' }, ...categoryOptions].map(opt => (
                    <FilterOption
                      key={opt.value}
                      selected={categoryFilter === opt.value}
                      onClick={() => setCategoryFilter(opt.value)}
                    >
                      {opt.label}
                    </FilterOption>
                  ))}
                </div>
              </div>
            </div>

            {/* Showroom Infobox */}
            <div className="mt-4 bg-white rounded-2xl border border-stone-200 shadow-sm p-4 space-y-3">
              <h4 className="text-xs font-medium text-[#1c1917] uppercase tracking-wider">Our Showroom</h4>
              <div className="space-y-2 text-xs text-stone-500">
                <span className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" style={{ color: 'var(--color-tarmeer-primary)' }} />
                  Industrial Area 2, Sharjah
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" style={{ color: 'var(--color-tarmeer-primary)' }} />
                  9 AM – 8 PM (Sat–Thu)
                </span>
              </div>
              <a
                href={GOOGLE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
                style={{ color: 'var(--color-tarmeer-primary)' }}
              >
                <MapPin className="w-3 h-3" /> View on Map
              </a>
            </div>
          </div>
        </aside>

        {/* Right Content */}
        <div className="flex-1 min-w-0">
          {/* 搜索条（从 hero 移下来，置于列表上方） */}
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search suppliers by name…"
              aria-label="Search suppliers by name"
              className="h-12 w-full rounded-xl border border-stone-200 bg-white pl-12 pr-11 text-left text-[15px] text-[#1c1917] placeholder:text-stone-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#b8864a]"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Mobile origin filter */}
          <div className="lg:hidden flex gap-1.5 bg-stone-100 rounded-full p-1 mb-3 w-fit">
            {[
              { value: '', label: 'All' },
              { value: 'dubai', label: '🇦🇪 Dubai' },
              { value: 'china', label: '🇨🇳 China' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setOriginFilter(opt.value)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
                  originFilter === opt.value
                    ? 'bg-white text-[#2c2c2c] shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Mobile category filter */}
          <div className="lg:hidden mb-4">
            <AdminSelect
              size="sm"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[{ value: '', label: 'All Categories' }, ...categoryOptions]}
            />
          </div>

          {/* Result count */}
          {!loading && visibleSuppliers.length > 0 && (
            <p className="text-sm text-stone-500 mb-4">
              {visibleSuppliers.length} verified supplier{visibleSuppliers.length !== 1 ? 's' : ''}
              {q && ` · matching “${searchInput.trim()}”`}
              {originFilter && ` · ${originFilter === 'china' ? '🇨🇳 China' : '🇦🇪 Dubai'}`}
              {categoryFilter && ` · ${categoryOptions.find(o => o.value === categoryFilter)?.label}`}
            </p>
          )}

          {/* List */}
          {loading ? (
            <div className="py-20 text-center text-stone-400">Loading suppliers...</div>
          ) : visibleSuppliers.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="w-10 h-10 text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500 text-[15px]">
                {q ? `No suppliers match “${searchInput.trim()}”.` : 'No suppliers found.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {visibleSuppliers.map(s => (
                <SupplierCard key={s.id} s={s} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TODO: migrate SupplierLeadModal */}
    </div>
  );
}
