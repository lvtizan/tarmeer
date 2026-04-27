# Admin UI — 4 小改动实现计划

**Goal:** 改善后台操作体验：用户表删除按钮可见性、注册时间加时分、侧栏今日新增徽章可消除、供应商详情改为左右布局。

**Architecture:** 全部为纯前端改动，无需新 API、无需改后端。

**Tech Stack:** React + TypeScript + TailwindCSS，localStorage 持久化 badge seen 状态。

---

## Task 1: AdminUsersPage — 删除按钮移到 Actions 列（始终可见）

**Files:**
- Modify: `src/pages/admin/AdminUsersPage.tsx:391-425`

**Step 1: 删除 Registered 列里的 HoverDeleteIconButton**

找到 line 391 的 `<td className="relative px-4 py-3 text-stone-500 text-xs">` 块，将其改为：

```tsx
<td className="px-4 py-3 text-stone-500 text-xs">
  <span>{new Date(user.created_at).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  })}</span>
  <div className="text-[10px] text-stone-400 mt-0.5">
    {new Date(user.created_at).toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit'
    })}
  </div>
</td>
```

注意：同时移除 `relative` className 和整个 `<HoverDeleteIconButton ... />` 组件。

**Step 2: 在 Actions 列加 Delete 按钮**

找到 line 400 的 `<td className="px-4 py-3 flex gap-2">` 里，在 Suspend/Activate 按钮之后加：

```tsx
<button
  onClick={(e) => { e.stopPropagation(); handleDeleteUser(user); }}
  disabled={deleteLoadingId === user.id}
  className="text-xs px-3 py-1 rounded-lg font-medium transition bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1 disabled:opacity-50"
  title="Delete user"
>
  <Trash2 size={12} /> {deleteLoadingId === user.id ? '...' : 'Delete'}
</button>
```

**Step 3: 清理无用 import**

检查 `HoverDeleteIconButton` import（line 7）是否还有其他引用。若无，删除该 import。

**Step 4: tsc 检查**

```bash
./node_modules/.bin/tsc --noEmit --skipLibCheck
```

Expected: 0 errors

---

## Task 2: AdminUsersPage — Registered 列加时分（已含在 Task 1 Step 1 里）

Task 1 Step 1 的代码已同时修改了时间格式，显示为两行：
- 第一行：`25 Apr 2026`
- 第二行：`14:32`（小字，stone-400）

无需额外步骤。

---

## Task 3: AdminLayout — todayNew 徽章看完后消失

**Files:**
- Modify: `src/components/admin/AdminLayout.tsx`

### 设计方案

用 `localStorage` 记录今天已访问的页面。key：`todayNew_seen_YYYY-MM-DD`，value：JSON 数组，如 `["users","companies"]`。

**规则：**
- 访问 `/admin/users` → 标记 `users` 已读
- 访问 `/admin/companies` → 标记 `companies` 已读
- 访问 `/admin/suppliers` → 标记 `suppliers` 已读
- 每天零点自动重置（因 key 含日期，新的一天 key 不同，相当于自动过期）

**Step 1: 加 helper 函数（文件顶部，在 navItems 之前）**

```ts
const TODAY_KEY = () => `todayNew_seen_${new Date().toISOString().slice(0, 10)}`;

function getTodaySeen(): Set<string> {
  try {
    const raw = localStorage.getItem(TODAY_KEY());
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function markTodaySeen(key: string) {
  try {
    const seen = getTodaySeen();
    seen.add(key);
    localStorage.setItem(TODAY_KEY(), JSON.stringify([...seen]));
  } catch {}
}
```

**Step 2: 加 state**

在 `AdminLayout` 组件的 state 区域（约 line 91）加：

```ts
const [todaySeen, setTodaySeen] = useState<Set<string>>(getTodaySeen);
```

**Step 3: 定义 path → seen key 映射**

在 `NOTIFICATION_MAP` 下面（约 line 85）加：

```ts
const TODAY_NEW_PAGE_MAP: Record<string, string> = {
  '/admin/users': 'homeowners',
  '/admin/companies': 'companies',
  '/admin/suppliers': 'suppliers',
};
```

**Step 4: 在 location 变化 effect 里标记 seen**

找到 line 141 的 `useEffect` (location.pathname 触发)，在末尾添加：

```ts
// Mark todayNew seen for this page
const todayKey = TODAY_NEW_PAGE_MAP[location.pathname] ??
  Object.entries(TODAY_NEW_PAGE_MAP).find(([p]) => location.pathname.startsWith(p))?.[1];
if (todayKey) {
  markTodaySeen(todayKey);
  setTodaySeen(getTodaySeen());
}
```

**Step 5: 渲染时检查 seen 状态**

找到约 line 222 的 `todayCount` 计算：

```tsx
// 旧
const todayCount =
  item.to === '/admin/users' ? todayNew.homeowners :
  item.to === '/admin/companies' ? todayNew.companies :
  item.to === '/admin/suppliers' ? todayNew.suppliers : 0;

// 新（加 seen 过滤）
const todayNewKey =
  item.to === '/admin/users' ? 'homeowners' :
  item.to === '/admin/companies' ? 'companies' :
  item.to === '/admin/suppliers' ? 'suppliers' : null;
const todayCount = todayNewKey && !todaySeen.has(todayNewKey)
  ? (todayNew as Record<string, number>)[todayNewKey] ?? 0
  : 0;
```

**Step 6: tsc 检查**

```bash
./node_modules/.bin/tsc --noEmit --skipLibCheck
```

Expected: 0 errors

---

## Task 4: AdminSupplierDetailPage — 改为左右布局

**Files:**
- Modify: `src/pages/admin/AdminSupplierDetailPage.tsx`

参考模板：`AdminRegisteredCompanyDetailPage.tsx` 的 `flex gap-6 items-start` 布局。

### 新布局结构

```
flex gap-6 items-start
├── LEFT  w-80 flex-shrink-0          ← 供应商信息 + 操作按钮
│   ├── 公司名 + 状态 badge
│   ├── 详情字段（origin/phone/whatsapp/website/store/joined）
│   ├── 品类标签
│   ├── 描述
│   └── Approve / Reject / Reset / Delete + 查看公开页面
└── RIGHT flex-1                      ← 产品 + 目录
    ├── Products grid (grid-cols-3 gap-3)
    └── Catalogs list
```

**Step 1: 重构 JSX**

将现有 `<div className="grid grid-cols-1 lg:grid-cols-3 gap-5">` 改为 `<div className="flex gap-6 items-start">`:

```tsx
<div className="flex gap-6 items-start">

  {/* LEFT: Supplier Info + Actions */}
  <div className="w-80 flex-shrink-0 space-y-4">

    {/* Info card */}
    <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
      <div>
        <h1 className="text-lg font-bold text-[#2c2c2c]">{supplier.company_name}</h1>
        <p className="text-sm text-stone-500 mt-0.5">{supplier.user_email} · {supplier.user_name}</p>
        <span className={`inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full ${
          supplier.status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
          supplier.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
        }`}>{supplier.status}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-stone-400">{t('Origin', '产地')}</span>
          <p className="font-medium mt-0.5">{supplier.origin === 'china' ? '🇨🇳 China' : '🇦🇪 Dubai'}</p></div>
        <div><span className="text-stone-400">{t('Phone', '电话')}</span>
          <p className="font-medium mt-0.5">{supplier.contact_phone || '—'}</p></div>
        <div><span className="text-stone-400">{t('WhatsApp', 'WhatsApp')}</span>
          <p className="font-medium mt-0.5">{supplier.whatsapp || '—'}</p></div>
        <div><span className="text-stone-400">{t('Website', '网站')}</span>
          <p className="font-medium mt-0.5">{supplier.website
            ? <a href={supplier.website} target="_blank" rel="noopener noreferrer"
                className="text-[#b8864a] hover:underline flex items-center gap-1">
                {supplier.website} <ExternalLink className="w-3 h-3" /></a>
            : '—'}
          </p></div>
        <div><span className="text-stone-400">{t('Store', '线下店')}</span>
          <p className="font-medium mt-0.5">{supplier.has_physical_store ? supplier.store_address || 'Yes' : 'No'}</p></div>
        <div><span className="text-stone-400">{t('Joined', '加入时间')}</span>
          <p className="font-medium mt-0.5">{new Date(supplier.created_at).toLocaleString(undefined, {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
          })}</p></div>
      </div>

      {cats.length > 0 && (
        <div>
          <span className="text-stone-400 text-sm">{t('Categories', '品类')}</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {cats.map((c: string) => (
              <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">{c}</span>
            ))}
          </div>
        </div>
      )}

      {supplier.description && (
        <div>
          <span className="text-stone-400 text-sm">{t('Description', '简介')}</span>
          <p className="text-sm text-[#2c2c2c] mt-1 whitespace-pre-line">{supplier.description}</p>
        </div>
      )}
    </div>

    {/* Actions card */}
    <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
      <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider">{t('Actions', '操作')}</h2>
      {supplier.status !== 'approved' && (
        <button onClick={() => handleStatus('approved')}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition">
          <Check className="w-4 h-4" /> {t('Approve', '通过')}
        </button>
      )}
      {supplier.status !== 'rejected' && (
        <button onClick={() => handleStatus('rejected')}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-stone-100 text-stone-600 text-sm font-semibold hover:bg-stone-200 transition">
          <X className="w-4 h-4" /> {t('Reject', '拒绝')}
        </button>
      )}
      {supplier.status !== 'pending' && (
        <button onClick={() => handleStatus('pending')}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-stone-100 text-stone-600 text-sm font-semibold hover:bg-stone-200 transition">
          {t('Reset to Pending', '重置为待审核')}
        </button>
      )}
      <hr className="border-stone-100" />
      <button onClick={handleDelete}
        className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition">
        <Trash2 className="w-4 h-4" /> {t('Delete', '删除')}
      </button>
      {supplier.slug && (
        <a href={`/materials/suppliers/${supplier.slug}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 h-10 rounded-xl border border-stone-200 text-sm text-stone-600 hover:bg-stone-50 transition">
          <ExternalLink className="w-4 h-4" /> {t('View Public Page', '查看公开页面')}
        </a>
      )}
    </div>
  </div>

  {/* RIGHT: Products + Catalogs */}
  <div className="flex-1 space-y-5">
    {products.length > 0 ? (
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">
          {t('Products', '产品')} ({products.length})
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {products.map(p => (
            <div key={p.id}>
              <div className="aspect-[4/3] rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
                <img src={p.image_url} alt={p.title || ''} className="w-full h-full object-cover" />
              </div>
              {p.title && <p className="text-[11px] text-stone-500 mt-1 truncate">{p.title}</p>}
            </div>
          ))}
        </div>
      </div>
    ) : (
      <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-400 text-sm">
        {t('No products uploaded yet', '暂无产品')}
      </div>
    )}

    {catalogs.length > 0 && (
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">
          {t('Catalogs', '目录')} ({catalogs.length})
        </h2>
        <div className="space-y-2">
          {catalogs.map(c => (
            <a key={c.id} href={c.file_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg bg-stone-50 hover:bg-stone-100 transition text-sm">
              📄 {c.title}
            </a>
          ))}
        </div>
      </div>
    )}
  </div>

</div>
```

**Step 2: tsc 检查**

```bash
./node_modules/.bin/tsc --noEmit --skipLibCheck
```

Expected: 0 errors

---

## 验证步骤

1. `npm run dev:all` 启动本地
2. 打开 `http://localhost:5173/admin/users`
   - Registered 列显示日期两行（日期 + 时间，无悬浮删除按钮）
   - Actions 列有 Edit / Permissions / Suspend / **Delete** 四个按钮，Delete 始终可见
   - 点 Delete → 弹出 DeleteReasonModal
3. 打开 `http://localhost:5173/admin/suppliers` 点进一条记录
   - 左边固定宽度信息 + 操作按钮
   - 右边产品网格
4. 侧栏 todayNew 徽章测试：
   - 新的一天（或清掉 localStorage）→ 徽章出现
   - 点击 Homeowners / Companies / Suppliers 对应菜单 → 该徽章消失
   - 刷新页面后徽章不再出现（localStorage 已记录）

---

## 部署

1. 全部改完 → `npm run build` → 验证无报错
2. 通知用户 + 提供本地测试截图
3. 等用户确认后 `rsync` 部署前端
