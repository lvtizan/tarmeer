# Materials Page Redesign + Supplier SEO Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 `/materials` 页面改成"左筛选右列表"布局，同时补全供应商 SEO（sitemap + seoMetaInjector + JSON-LD）。

**Architecture:**
- 前端：重写 `src/pages/ShowroomsPage.tsx`，保留数据请求逻辑，替换 Hero 为 CompaniesPage 同款 dark header，左侧 240px sticky 筛选栏 + 右侧横向行式卡片列表。
- 后端：在 `server/src/app.ts` sitemap 中加入 supplier detail URL；在 `server/src/lib/seoMetaInjector.ts` 加入 `/materials` 静态 meta 与 `/materials/suppliers/:slug` 动态 meta。
- SEO：在 `SupplierDetailPage.tsx` 的 `<Helmet>` 里补 JSON-LD（BreadcrumbList + Organization），在新 ShowroomsPage 里补 JSON-LD（CollectionPage + ItemList）。

**Tech Stack:** React 18, TypeScript, Tailwind CSS, react-helmet-async, MySQL (pool.execute)

---

## Task 1: `/materials` 页面 — Header + 布局骨架

**Files:**
- Modify: `src/pages/ShowroomsPage.tsx`

**Context:**
- 现有文件已有全部数据请求逻辑（`originFilter`, `categoryFilter`, `suppliers` state）— 保留，只改 JSX。
- 目标样式参考 `src/pages/CompaniesPage.tsx` 第 358-406 行（dark header section）。
- MUST: 不用原生 `<select>`，category 下拉改用 `<AdminSelect>` from `src/components/ui/AdminSelect.tsx`。

**Step 1: 替换 return 中的 Hero section**

把现有 `<section className="relative h-[420px]...">` 整块删掉，换成：

```tsx
{/* Header */}
<section className="relative bg-[#2c2620] overflow-hidden">
  <div className="absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.8)_1px,transparent_0)] [background-size:32px_32px]" />
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(184,134,74,0.12),transparent_70%)]" />
  <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 flex items-center justify-between">
    <div>
      <h1 className="font-serif text-[28px] sm:text-[36px] text-white font-medium leading-tight mb-2">
        Find Premium Material Suppliers in UAE
      </h1>
      <p className="text-white/60 text-[15px]">
        Verified suppliers from China and Dubai — furniture, stone, lighting, and more.
      </p>
    </div>
    <button
      type="button"
      onClick={() => setLeadModalOpen(true)}
      className="shrink-0 hidden sm:inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#b8864a] hover:bg-[#a67c47] text-white font-semibold text-sm transition"
    >
      Apply to Join
    </button>
  </div>
</section>
```

**Step 2: 把主体区改成两栏布局**

删掉现有 `<PageContainer className="py-10 sm:py-14">` 内的全部内容，换成：

```tsx
<div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex gap-8 items-start">
  {/* Left Sidebar */}
  <aside className="w-60 flex-shrink-0 hidden lg:block">
    <div className="lg:sticky lg:top-24">
      {/* 筛选器 — Task 2 填充 */}
      {/* 展厅 infobox — Task 2 填充 */}
    </div>
  </aside>

  {/* Right Content */}
  <div className="flex-1 min-w-0">
    {/* 结果数量 + 移动端筛选 — Task 3 填充 */}
    {/* 供应商列表 — Task 3 填充 */}
  </div>
</div>
```

**Step 3: 在文件顶部补 import**

```tsx
import AdminSelect from '../components/ui/AdminSelect';
```

**Step 4: 构建验证**

```bash
cd /Users/kp/Code/tarmeer-4.0-local
npm run build 2>&1 | tail -20
```

期望：无 TS 错误（页面暂时内容为空是正常的）。

**Step 5: Commit**

```bash
git add src/pages/ShowroomsPage.tsx
git commit -m "feat: materials page — replace hero with dark header + two-col layout skeleton"
```

---

## Task 2: 左侧筛选栏内容

**Files:**
- Modify: `src/pages/ShowroomsPage.tsx`

**Context:**
- 复用 CompaniesPage 的 `FilterOption` 组件写法（inline 函数组件，不需要单独文件）。
- Origin 单选：All / China / Dubai。
- Category 单选：All + 10 个选项（文件里已有 `CATEGORY_OPTIONS` 常量）。
- 底部展厅 infobox：地址 + 营业时间 + View on Map 按钮（从原有 Showroom section 拆出）。
- 需要 import: `MapPin`, `Clock` from lucide-react（已有）。

**Step 1: 在组件文件顶部（组件函数外）加 FilterOption helper**

```tsx
function FilterOption({
  selected, onClick, children,
}: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
        selected
          ? 'bg-[#f5f0e8] border border-[#d4c4a8] text-[#1c1917]'
          : 'text-stone-500 hover:bg-stone-50'
      }`}>
      <div className="flex items-center gap-3">
        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
          selected ? 'border-[#b8860b] bg-white' : 'border-stone-300'
        }`}>
          {selected && <span className="w-2 h-2 rounded-sm bg-[#b8860b] block" />}
        </div>
        {children}
      </div>
    </button>
  );
}
```

**Step 2: 填充左侧 aside 内容**

把 Task 1 Step 2 中 `{/* 筛选器 — Task 2 填充 */}` 替换为：

```tsx
<div className="bg-white rounded-[22px] border border-stone-100 p-5 shadow-sm space-y-6">
  {/* Origin */}
  <div>
    <h4 className="text-xs font-medium text-[#1c1917] uppercase tracking-wider mb-3">Origin</h4>
    <div className="space-y-1">
      <FilterOption selected={originFilter === ''} onClick={() => setOriginFilter('')}>All Origins</FilterOption>
      <FilterOption selected={originFilter === 'china'} onClick={() => setOriginFilter('china')}>🇨🇳 China</FilterOption>
      <FilterOption selected={originFilter === 'dubai'} onClick={() => setOriginFilter('dubai')}>🇦🇪 Dubai</FilterOption>
    </div>
  </div>

  <hr className="border-stone-100" />

  {/* Category */}
  <div>
    <h4 className="text-xs font-medium text-[#1c1917] uppercase tracking-wider mb-3">Category</h4>
    <div className="space-y-1">
      {CATEGORY_OPTIONS.map(opt => (
        <FilterOption key={opt.value} selected={categoryFilter === opt.value} onClick={() => setCategoryFilter(opt.value)}>
          {opt.label}
        </FilterOption>
      ))}
    </div>
  </div>
</div>

{/* Showroom Infobox */}
<div className="mt-4 bg-white rounded-[22px] border border-stone-100 p-4 shadow-sm space-y-3">
  <h4 className="text-xs font-medium text-[#1c1917] uppercase tracking-wider">Our Showroom</h4>
  <div className="space-y-2 text-xs text-stone-500">
    <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-[#b8864a]" /> Industrial Area 2, Sharjah</span>
    <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-[#b8864a]" /> 9 AM – 8 PM (Sat–Thu)</span>
  </div>
  <a href={GOOGLE_MAPS_URL} target="_blank" rel="noopener noreferrer"
    className="inline-flex items-center gap-1.5 text-xs text-[#b8864a] hover:underline font-medium">
    <MapPin className="w-3 h-3" /> View on Map
  </a>
</div>
```

**Step 3: 构建验证**

```bash
npm run build 2>&1 | tail -10
```

**Step 4: Commit**

```bash
git add src/pages/ShowroomsPage.tsx
git commit -m "feat: materials page — left sidebar filters (origin + category) + showroom infobox"
```

---

## Task 3: 右侧横向供应商卡片列表

**Files:**
- Modify: `src/pages/ShowroomsPage.tsx`

**Context:**
- 横向卡片：左侧封面图 `280×180px` + 中间文字（公司名 + origin badge + categories + description） + 最右侧 "View Profile" 按钮。
- `Link` to `/materials/suppliers/${s.slug}`（已有 import）。
- Loading / empty state 保留。
- 移动端（< lg）：在列表上方展示一个 origin pill-tab 行（3个按钮：All / China / Dubai）作为代替侧边栏的简化筛选。

**Step 1: 在组件函数外加 SupplierCard 子组件**

```tsx
function SupplierCard({ s, parseCategories }: {
  s: Supplier;
  parseCategories: (c: Supplier['categories']) => string[];
}) {
  const cats = parseCategories(s.categories);
  return (
    <Link to={`/materials/suppliers/${s.slug}`}
      className="group flex border-b border-stone-200/60 hover:bg-[#faf8f5] transition-colors duration-150 py-5 gap-5">
      {/* Cover image */}
      <div className="w-[220px] sm:w-[280px] h-[160px] sm:h-[180px] flex-shrink-0 overflow-hidden rounded-xl bg-stone-100">
        <img
          src={s.cover_image_url || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80'}
          alt={s.company_name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h3 className="text-[17px] font-semibold text-[#1c1917] group-hover:text-[#b8860b] transition-colors">
              {s.company_name}
            </h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              s.origin === 'china' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
            }`}>
              {s.origin === 'china' ? '🇨🇳 China' : '🇦🇪 Dubai'}
            </span>
            {s.has_physical_store ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                Showroom
              </span>
            ) : null}
          </div>
          {s.description && (
            <p className="text-stone-500 text-[13px] leading-relaxed line-clamp-2 mb-2.5">{s.description}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {cats.slice(0, 4).map(c => (
              <span key={c} className="px-2.5 py-0.5 text-[11px] text-stone-500 border border-stone-200 rounded capitalize">{c}</span>
            ))}
          </div>
        </div>
      </div>
      {/* CTA */}
      <div className="hidden sm:flex flex-col items-center justify-center flex-shrink-0 w-[140px] pl-4 border-l border-stone-100">
        <span className="w-full flex items-center justify-center px-4 py-2.5 rounded-lg border border-[#b8860b] text-[#b8860b] font-semibold text-sm group-hover:bg-[#b8860b] group-hover:text-white transition-colors duration-200">
          View Profile
        </span>
      </div>
    </Link>
  );
}
```

**Step 2: 填充右侧 `<div className="flex-1 min-w-0">` 内容**

把 Task 1 中的注释替换为：

```tsx
{/* Mobile origin filter */}
<div className="lg:hidden flex gap-1.5 bg-stone-100 rounded-full p-1 mb-5 w-fit">
  {[{ value: '', label: 'All' }, { value: 'china', label: '🇨🇳 China' }, { value: 'dubai', label: '🇦🇪 Dubai' }].map(opt => (
    <button key={opt.value} onClick={() => setOriginFilter(opt.value)}
      className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${
        originFilter === opt.value ? 'bg-white text-[#2c2c2c] shadow-sm' : 'text-stone-500 hover:text-stone-700'
      }`}>
      {opt.label}
    </button>
  ))}
</div>

{/* Result count */}
{!loading && suppliers.length > 0 && (
  <p className="text-sm text-stone-500 mb-4">
    {suppliers.length} verified supplier{suppliers.length !== 1 ? 's' : ''}
    {originFilter && ` from ${originFilter === 'china' ? 'China' : 'Dubai'}`}
    {categoryFilter && ` · ${CATEGORY_OPTIONS.find(o => o.value === categoryFilter)?.label}`}
  </p>
)}

{/* List */}
{loading ? (
  <div className="py-20 text-center text-stone-400">Loading suppliers...</div>
) : suppliers.length === 0 ? (
  <div className="py-16 text-center">
    <Package className="w-10 h-10 text-stone-300 mx-auto mb-3" />
    <p className="text-stone-500 text-[15px]">No suppliers found.</p>
  </div>
) : (
  <div>
    {suppliers.map(s => (
      <SupplierCard key={s.id} s={s} parseCategories={parseCategories} />
    ))}
  </div>
)}

{/* Supplier CTA — mobile apply button */}
<div className="mt-10 sm:hidden">
  <button type="button" onClick={() => setLeadModalOpen(true)}
    className="w-full py-3.5 rounded-xl bg-[#b8864a] text-white font-bold text-[15px]">
    Apply to Join as Supplier
  </button>
</div>
```

**Step 3: 确保 `scrollToSuppliers` 函数和 header CTA 删除干净**

`scrollToSuppliers` 函数不再需要，删掉。原有 Showroom Section、Supplier CTA section、WhatsApp CTA section 也删掉（已被新布局替代）。

**Step 4: 构建验证**

```bash
npm run build 2>&1 | tail -20
```

期望：build 成功，无 TS 错误。

**Step 5: Commit**

```bash
git add src/pages/ShowroomsPage.tsx
git commit -m "feat: materials page — horizontal supplier card list + mobile filter"
```

---

## Task 4: ShowroomsPage JSON-LD（CollectionPage + ItemList）

**Files:**
- Modify: `src/pages/ShowroomsPage.tsx`

**Context:**
- 在现有 `<Helmet>` 中追加两个 JSON-LD script。
- CollectionPage：描述整个 `/materials` 页面。
- ItemList：前 20 家供应商的 ListItem，供 Google 理解列表内容。

**Step 1: 在 Helmet 中补充 JSON-LD**

在 `<link rel="canonical" .../>` 后追加：

```tsx
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
<script type="application/ld+json">{JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'Material Suppliers in UAE — Tarmeer',
  description: 'Verified building material suppliers from China and Dubai for renovation projects in the UAE.',
  url: 'https://www.tarmeer.com/materials',
  publisher: {
    '@type': 'Organization',
    name: 'Tarmeer',
    url: 'https://www.tarmeer.com',
    logo: { '@type': 'ImageObject', url: 'https://www.tarmeer.com/images/tarmeer_logo.svg' },
  },
})}</script>
<script type="application/ld+json">{JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Material Suppliers in UAE',
  numberOfItems: suppliers.length,
  itemListElement: suppliers.slice(0, 20).map((s, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'Organization',
      name: s.company_name,
      url: `https://www.tarmeer.com/materials/suppliers/${s.slug}`,
    },
  })),
})}</script>
```

**Step 2: 构建验证**

```bash
npm run build 2>&1 | tail -10
```

**Step 3: Commit**

```bash
git add src/pages/ShowroomsPage.tsx
git commit -m "feat: materials page — CollectionPage + ItemList JSON-LD"
```

---

## Task 5: SupplierDetailPage — 补全 Helmet + JSON-LD

**Files:**
- Modify: `src/pages/SupplierDetailPage.tsx`

**Context:**
- 现有 Helmet（第 141-148 行）已有 title / description / canonical / og，但缺 robots / twitter / JSON-LD。
- 需要在 `supplier` 数据加载后（return 语句里、`if (!supplier)` 之后）的 Helmet 里补全。
- 补两个 JSON-LD：BreadcrumbList + Organization（如有实体店加 `address`）。

**Step 1: 替换现有 Helmet 块（第 141-148 行）**

```tsx
<Helmet>
  <title>{supplier.company_name} — Material Supplier UAE | Tarmeer</title>
  <meta name="description" content={
    (supplier.description?.slice(0, 155) || `${supplier.company_name} — building material supplier in UAE`)
    + ' | Tarmeer'
  } />
  <link rel="canonical" href={`https://www.tarmeer.com/materials/suppliers/${slug}`} />
  <meta property="og:title" content={`${supplier.company_name} — Material Supplier UAE | Tarmeer`} />
  <meta property="og:description" content={supplier.description?.slice(0, 200) || `${supplier.company_name} — building material supplier on Tarmeer UAE`} />
  <meta property="og:url" content={`https://www.tarmeer.com/materials/suppliers/${slug}`} />
  <meta property="og:type" content="website" />
  {heroImage && <meta property="og:image" content={heroImage} />}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={`${supplier.company_name} | Tarmeer`} />
  <meta name="twitter:description" content={supplier.description?.slice(0, 160) || ''} />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <script type="application/ld+json">{JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.tarmeer.com' },
      { '@type': 'ListItem', position: 2, name: 'Materials', item: 'https://www.tarmeer.com/materials' },
      { '@type': 'ListItem', position: 3, name: supplier.company_name, item: `https://www.tarmeer.com/materials/suppliers/${slug}` },
    ],
  })}</script>
  <script type="application/ld+json">{JSON.stringify({
    '@context': 'https://schema.org',
    '@type': supplier.has_physical_store ? 'LocalBusiness' : 'Organization',
    name: supplier.company_name,
    description: supplier.description?.slice(0, 300) || undefined,
    url: `https://www.tarmeer.com/materials/suppliers/${slug}`,
    ...(heroImage && { image: heroImage }),
    ...(supplier.logo_url && { logo: supplier.logo_url }),
    ...(supplier.website && { sameAs: [supplier.website] }),
    ...(supplier.has_physical_store && supplier.store_address && {
      address: {
        '@type': 'PostalAddress',
        streetAddress: supplier.store_address,
        addressCountry: 'AE',
      },
    }),
  })}</script>
</Helmet>
```

**Step 2: 构建验证**

```bash
npm run build 2>&1 | tail -10
```

**Step 3: TypeScript 类型验证（后端）**

```bash
cd server && npx tsc --noEmit 2>&1 | tail -10
cd ..
```

**Step 4: Commit**

```bash
git add src/pages/SupplierDetailPage.tsx
git commit -m "feat: supplier detail — complete Helmet (robots/twitter/og) + BreadcrumbList + Organization JSON-LD"
```

---

## Task 6: 后端 Sitemap — 加入 supplier detail URLs

**Files:**
- Modify: `server/src/app.ts` (第 212-238 行附近，在 Article pages 之前)

**Context:**
- Sitemap 生成在 `/api/sitemap.xml` endpoint（第 164 行）。
- `supplier_profiles` 表有 `slug`、`updated_at`、`status` 字段（status='active' 表示已上线）。
- 插在 Article pages 查询之前。

**Step 1: 在 `// Article pages` 注释前插入**

```typescript
// Supplier detail pages
const [supplierRows] = await pool.execute(
  "SELECT slug, updated_at FROM supplier_profiles WHERE status = 'active' AND slug IS NOT NULL ORDER BY updated_at DESC"
);
for (const sup of supplierRows as any[]) {
  if (sup.slug) {
    const lastmod = sup.updated_at ? new Date(sup.updated_at).toISOString().slice(0, 10) : today;
    xml += `  <url><loc>${baseUrl}/materials/suppliers/${sup.slug}</loc><changefreq>weekly</changefreq><priority>0.7</priority><lastmod>${lastmod}</lastmod></url>\n`;
  }
}
```

**Step 2: TypeScript 验证**

```bash
cd server && npx tsc --noEmit 2>&1 | tail -10
cd ..
```

**Step 3: Commit**

```bash
git add server/src/app.ts
git commit -m "feat: sitemap — add /materials/suppliers/:slug entries"
```

---

## Task 7: 后端 seoMetaInjector — 覆盖供应商路由

**Files:**
- Modify: `server/src/lib/seoMetaInjector.ts`

**Context:**
- 现有文件有 `staticMeta` 对象（第 32-81 行）和 company/project 动态 match。
- 需要：1) 在 `staticMeta` 加 `/materials` 条目，2) 在 project match 之后加 `/materials/suppliers/:slug` match。

**Step 1: 在 `staticMeta` 对象的 `/for-homeowners` 条目后，`};` 之前加**

```typescript
'/materials': {
  title: 'Material Suppliers in UAE — Furniture, Stone, Lighting | Tarmeer',
  description: 'Browse verified building material suppliers from China and Dubai. Furniture, marble, lighting, flooring and more for UAE renovation projects.',
  canonical: `${BASE_URL}/materials`,
  ogImage: DEFAULT_IMAGE,
},
```

**Step 2: 在 `projectMatch` 块结尾的 `}` 后加 supplier detail match**

```typescript
// Supplier detail: /materials/suppliers/:slug
const supplierMatch = pathname.match(/^\/materials\/suppliers\/([a-z0-9-]+)$/);
if (supplierMatch) {
  const slug = supplierMatch[1];
  const [rows] = await pool.execute(
    "SELECT company_name, description, logo_url, origin, store_address, has_physical_store FROM supplier_profiles WHERE slug = ? AND status = 'active' LIMIT 1",
    [slug]
  );
  const sup = (rows as any[])[0];
  if (sup) {
    const name = sup.company_name || slug;
    const desc = (sup.description || '').slice(0, 160) || `${name} — building material supplier in UAE`;
    const image = sup.logo_url ? `${BASE_URL}${sup.logo_url}` : DEFAULT_IMAGE;
    return {
      title: `${name} — Material Supplier UAE | Tarmeer`,
      description: desc,
      canonical: `${BASE_URL}/materials/suppliers/${slug}`,
      ogImage: image,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': sup.has_physical_store ? 'LocalBusiness' : 'Organization',
        name,
        description: desc,
        url: `${BASE_URL}/materials/suppliers/${slug}`,
        image,
        ...(sup.store_address && {
          address: { '@type': 'PostalAddress', streetAddress: sup.store_address, addressCountry: 'AE' },
        }),
      },
    };
  }
}
```

**Step 3: TypeScript 验证**

```bash
cd server && npx tsc --noEmit 2>&1 | tail -10
cd ..
```

**Step 4: Commit**

```bash
git add server/src/lib/seoMetaInjector.ts
git commit -m "feat: seoMetaInjector — /materials static meta + /materials/suppliers/:slug dynamic meta"
```

---

## Task 8: 最终构建验证 + 通知用户

**Step 1: 完整前端构建**

```bash
cd /Users/kp/Code/tarmeer-4.0-local
npm run build 2>&1 | tail -20
```

期望：`built in X.Xs`，无 TS 错误。

**Step 2: 后端 TS 检查**

```bash
cd server && npx tsc --noEmit 2>&1
cd ..
```

期望：无输出（无错误）。

**Step 3: 本地预览验证清单**

启动本地 server：
```bash
PORT=3099 DEV_SKIP_EMAIL=true node server/dist/app.js &
```

检查：
- `curl http://localhost:3099/api/sitemap.xml | grep "materials/suppliers"` → 应有 URL 条目
- `curl -A "Googlebot" http://localhost:3099/materials/suppliers/test-slug` → 应有 meta title/canonical（即使 slug 不存在则应 fallback 到默认）

**Step 4: 最终 commit（如有遗漏文件）**

```bash
git status
# 如有未提交文件
git add -A
git commit -m "chore: materials redesign + supplier SEO — final cleanup"
```

**Step 5: 通知用户，等待部署确认**

汇报：
- `/materials` 页面已改为 dark header + 左筛选 + 右横向列表
- Sitemap 已纳入 `/materials/suppliers/:slug`
- seoMetaInjector 已覆盖 `/materials` 静态 + supplier 动态 meta
- SupplierDetailPage Helmet 已补全 + JSON-LD
- 构建通过，等待确认是否部署
