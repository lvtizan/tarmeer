# Tarmeer 项目脚手架

> 本项目是 **Next.js 16 App Router + Express 后端**。
> 前端：`src/app/` 目录路由；后端：TypeScript 源码不在本地，只有编译后的 `server/dist/`。
> 新增功能必须直接改 `server/dist/` 的 JS 文件。

---

## 技术栈速查

| 层 | 技术 | 注意 |
|----|------|------|
| 前端框架 | Next.js 16, App Router | 不是 Vite，不是 Pages Router |
| UI | Tailwind CSS v4, Lucide React | 无 shadcn/ui |
| 状态 | React useState/useEffect | 无 Redux/Zustand |
| HTTP（前端→后端） | `adminApi` / `api` / `fieldApi`（见 `src/lib/adminApi.ts`） | 统一用这三个，不要裸 fetch |
| 后端框架 | Express.js | 编译产物在 `server/dist/` |
| 数据库 | MySQL（阿里云 RDS） | `server/dist/config/database.js` |
| 认证 | JWT Bearer token（localStorage） | admin token key: `admin_token` |
| 环境变量 | `NEXT_PUBLIC_*`（前端），无前缀（后端） | 禁止用 `VITE_*` |

---

## 一、Auth 模块（登录 / 会话）

### 前端：AdminContext（全局会话）

**位置**：`src/contexts/AdminContext.tsx`

每个 admin 页面通过 `useAdmin()` 取当前管理员：

```tsx
const { admin, login, logout, isLoading, isInstalled } = useAdmin();
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `admin` | `AdminUser \| null` | 当前登录管理员，null = 未登录 |
| `isLoading` | `boolean` | 正在从后端验证 token |
| `isInstalled` | `boolean \| null` | false → 跳 /admin/install；null → 还在判断 |
| `login(email, password)` | `Promise` | 登录，存 token，更新 admin |
| `logout()` | `void` | 清 token，admin 置 null |

### 前端：Admin Layout 鉴权（必须的模板）

`src/app/admin/layout.tsx` 中每个 admin 页面共享这个保护逻辑：

```tsx
// 未登录时跳转，必须放在 useEffect 里，不能在 render 体里调用 router
useEffect(() => {
  if (!isLoading && !admin) {
    router.replace('/admin/login');
  }
}, [isLoading, admin, router]);

if (isLoading || !admin) {
  return <LoadingSpinner />;
}
```

**禁止写法**（会触发 React render-phase 警告）：
```tsx
// 错误！不能在 render 体直接调 router
if (!admin) { router.replace('/admin/login'); return null; }
```

### 前端：登录页模板

`src/app/admin/login/page.tsx` 核心结构：

```tsx
'use client';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAdmin } from '@/contexts/AdminContext';

// useSearchParams() 必须放在 <Suspense> 子组件里，否则 Next.js build 报错
function LoginContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { login, admin, isInstalled, isLoading: contextLoading } = useAdmin();

  // 已登录 → 自动跳转
  useEffect(() => {
    if (admin) router.push('/admin');
  }, [admin, router]);

  // 系统未初始化 → 跳安装页
  useEffect(() => {
    if (isInstalled === false) router.push('/admin/install');
  }, [isInstalled, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      router.push('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    }
  };

  // 加载中不渲染表单
  if (contextLoading || isInstalled === null) return <Loading />;

  return <form onSubmit={handleSubmit}>...</form>;
}

export default function AdminLoginPage() {
  // 必须用 Suspense 包裹含 useSearchParams 的组件
  return (
    <Suspense fallback={<Loading />}>
      <LoginContent />
    </Suspense>
  );
}
```

### 前端：tab 标题（client 组件专用）

client 组件不能 export metadata，用 useEffect 设置：

```tsx
useEffect(() => { document.title = '页面名称 — Tarmeer Admin'; }, []);
```

### 后端：Auth 路由（`server/dist/routes/auth.js`）

关键模式：

```js
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1小时
  max: 5,                      // 最多5次
  message: 'Too many registration attempts.'
});

router.post('/register', registerLimiter, [
  body('email').isEmail().withMessage('请输入有效邮箱'),
  body('password').isLength({ min: 6 }).withMessage('密码至少6位'),
], handleValidation, userAuth.register);
```

`handleValidation` 模板（每个路由文件都需要）：

```js
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
}
```

---

## 二、Admin 列表页模板

适用场景：后台管理任何资源的分页列表（用户、公司、申请等）。

**参考文件**：`src/app/admin/feedback/page.tsx`、`src/app/admin/users/page.tsx`

```tsx
'use client';
import { useState, useEffect } from 'react';
import { adminApi } from '@/lib/adminApi';
import { showToast } from '@/components/ui/Toast';

// 1. 类型定义（对齐后端返回）
type Row = {
  id: number;
  name: string;
  created_at: string;
  // ... 按实际字段补充
};

export default function AdminXxxListPage() {
  // 2. 核心状态
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  // 可选：搜索/过滤
  const [search, setSearch] = useState('');

  // 3. tab 标题
  useEffect(() => { document.title = 'XXX 列表 — Tarmeer Admin'; }, []);

  // 4. 加载数据
  const load = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getXxxList({ page, search });
      setRows(data.items || []);
      setTotal(data.pagination?.total || 0);
      setPages(data.pagination?.pages || 1);
    } catch {
      showToast('加载失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, search]);  // eslint-disable-line

  // 5. 渲染
  return (
    <div className="w-full">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#2c2c2c]">XXX 列表</h1>
          <p className="text-xs text-stone-500 mt-0.5">共 {total} 条</p>
        </div>
        <button onClick={load} className="text-sm text-stone-500 hover:text-stone-700">
          刷新
        </button>
      </div>

      {/* 搜索栏（可选） */}
      <input
        className="mb-4 w-full max-w-xs px-3 py-2 border border-stone-200 rounded-lg text-sm"
        placeholder="搜索..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
      />

      {/* 表格 */}
      {loading ? (
        <div className="text-center py-12 text-stone-400">加载中...</div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-xs">
              <tr>
                <th className="text-left px-4 py-3">ID</th>
                <th className="text-left px-4 py-3">名称</th>
                <th className="text-left px-4 py-3">创建时间</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3 text-stone-400">{row.id}</td>
                  <td className="px-4 py-3 font-medium text-[#2c2c2c]">{row.name}</td>
                  <td className="px-4 py-3 text-stone-400">{row.created_at}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-[#b8864a] hover:underline text-xs">查看</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="text-center py-10 text-stone-400">暂无数据</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 分页 */}
      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1 text-sm rounded border border-stone-200 disabled:opacity-40">
            上一页
          </button>
          <span className="px-3 py-1 text-sm text-stone-500">{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1 text-sm rounded border border-stone-200 disabled:opacity-40">
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## 三、Admin 详情/编辑页模板

适用场景：点进某条记录查看详情、编辑字段、保存。

**参考文件**：`src/app/admin/feedback/[id]/page.tsx`、`src/app/admin/companies/[id]/page.tsx`

```tsx
'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminApi } from '@/lib/adminApi';
import { showToast } from '@/components/ui/Toast';
import { showConfirm } from '@/components/ui/ConfirmModal';

type Item = { id: number; name: string; status: string; };

export default function AdminXxxDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 编辑态
  const [name, setName] = useState('');

  useEffect(() => { document.title = `XXX 详情 — Tarmeer Admin`; }, []);

  useEffect(() => {
    adminApi.getXxx(Number(id))
      .then((data) => { setItem(data); setName(data.name); })
      .catch(() => showToast('加载失败', 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.updateXxx(Number(id), { name });
      showToast('保存成功', 'success');
      setItem(prev => prev ? { ...prev, name } : prev);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await showConfirm({ title: '确认删除？', message: '此操作不可撤销。' });
    if (!ok) return;
    try {
      await adminApi.deleteXxx(Number(id));
      showToast('已删除', 'success');
      router.push('/admin/xxx');
    } catch {
      showToast('删除失败', 'error');
    }
  };

  if (loading) return <div className="text-center py-12 text-stone-400">加载中...</div>;
  if (!item) return <div className="text-center py-12 text-stone-500">未找到记录</div>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[#2c2c2c]">#{item.id} {item.name}</h1>
        <button onClick={() => router.back()} className="text-sm text-stone-500 hover:text-stone-700">
          返回
        </button>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">名称</label>
          <input
            className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30 focus:border-[#b8864a]"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-6">
        <button onClick={handleDelete} className="text-sm text-red-500 hover:text-red-700">
          删除
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 bg-[#b8864a] text-white text-sm rounded-lg hover:bg-[#a67c47] disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}
```

---

## 四、枚举/配置管理模板（ServicesTab 双栏）

适用场景：左侧分类列表 + 右侧该分类的子项列表，支持拖拽排序、内联编辑、增删。

**参考文件**：`src/app/admin/enums/page.tsx`（ServicesTab 模式）、`src/app/admin/survey-questions/page.tsx`

### 核心数据结构

```tsx
interface Category {
  id: string;        // 唯一 key
  name: string;
  sort_order: number;
  is_enabled: number;  // 0|1
}

interface Item {
  id: string;
  name: string;
  category_id: string;
  sort_order: number;
  active: number;
}
```

### 拖拽排序（HTML5 原生）

```tsx
// 状态
const [dragIdx, setDragIdx] = useState<number | null>(null);
const [overIdx, setOverIdx] = useState<number | null>(null);

// 事件
onDragStart={() => setDragIdx(idx)}
onDragEnter={() => setOverIdx(idx)}
onDragEnd={() => {
  if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
    const next = [...items];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(overIdx, 0, moved);
    // 重新赋 sort_order
    setItems(next.map((item, i) => ({ ...item, sort_order: i })));
    setIsDirty(true);
  }
  setDragIdx(null);
  setOverIdx(null);
}}
onDragOver={(e) => e.preventDefault()}  // 必须，否则 drop 不触发
```

### 手动保存按钮（isDirty 模式）

```tsx
const [isDirty, setIsDirty] = useState(false);
const mutate = (fn: () => void) => { fn(); setIsDirty(true); };

// 使用：mutate(() => setItems(next));

// 按钮：有改动时高亮
<button
  onClick={handleSave}
  className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
    isDirty
      ? 'bg-amber-500 text-white hover:bg-amber-600'
      : 'bg-stone-100 text-stone-400 cursor-not-allowed'
  }`}
  disabled={!isDirty || saving}
>
  {saving ? '保存中...' : isDirty ? '保存更改' : '已保存'}
</button>
```

### 双栏布局骨架

```tsx
<div className="flex gap-6 min-h-[600px]">
  {/* 左侧：分类列表 */}
  <div className="w-56 shrink-0 bg-white rounded-xl border border-stone-200 flex flex-col">
    <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
      <span className="text-sm font-medium text-stone-700">分类</span>
      <button onClick={addCategory} className="text-[#b8864a] text-lg leading-none hover:opacity-70">+</button>
    </div>
    <div className="flex-1 overflow-y-auto py-1">
      {categories.map((cat, idx) => (
        <div
          key={cat.id}
          draggable
          onDragStart={() => setCatDragIdx(idx)}
          onDragEnter={() => setCatOverIdx(idx)}
          onDragEnd={handleCatDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => setSelectedCatId(cat.id)}
          className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
            selectedCatId === cat.id
              ? 'bg-[#b8864a]/10 text-[#b8864a] font-medium'
              : 'text-stone-600 hover:bg-stone-50'
          } ${catOverIdx === idx ? 'bg-amber-50' : ''}`}
        >
          <span className="text-stone-300 cursor-grab">⠿</span>
          <input
            className="flex-1 bg-transparent text-sm focus:outline-none"
            defaultValue={cat.name}
            onBlur={(e) => mutate(() => renameCategory(cat.id, e.target.value))}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ))}
    </div>
  </div>

  {/* 右侧：当前分类的子项 */}
  <div className="flex-1 bg-white rounded-xl border border-stone-200 flex flex-col">
    {selectedCatId ? (
      <>
        <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
          <span className="text-sm font-medium text-stone-700">
            {categories.find(c => c.id === selectedCatId)?.name} 的子项
          </span>
          <button onClick={addItem} className="text-[#b8864a] text-lg leading-none hover:opacity-70">+</button>
        </div>
        <div className="flex-1 overflow-y-auto py-2 space-y-1 px-2">
          {currentItems.map((item, idx) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => setItemDragIdx(idx)}
              onDragEnter={() => setItemOverIdx(idx)}
              onDragEnd={handleItemDrop}
              onDragOver={(e) => e.preventDefault()}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                itemOverIdx === idx ? 'bg-amber-50 ring-1 ring-[#b8864a]/30' : 'hover:bg-stone-50'
              }`}
            >
              <span className="text-stone-300 cursor-grab shrink-0">⠿</span>
              <input
                className="flex-1 text-sm bg-transparent focus:outline-none"
                defaultValue={item.name}
                onBlur={(e) => mutate(() => renameItem(item.id, e.target.value))}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              />
              <button
                onClick={() => mutate(() => toggleItem(item.id))}
                className={`text-xs px-2 py-0.5 rounded-full ${item.active ? 'bg-stone-100 text-stone-400' : 'bg-green-50 text-green-700'}`}
              >
                {item.active ? '停用' : '启用'}
              </button>
              <button
                onClick={() => handleDeleteItem(item.id)}
                className="text-xs text-red-400 hover:text-red-600"
              >删除</button>
            </div>
          ))}
        </div>
      </>
    ) : (
      <div className="flex-1 flex items-center justify-center text-stone-400 text-sm">
        请先选择左侧分类
      </div>
    )}
  </div>
</div>
```

---

## 五、adminApi 扩展（新增接口）

**文件**：`src/lib/adminApi.ts`

所有 admin 接口统一在这里注册。格式：

```ts
// GET
getXxxList: (params?: { page?: number; search?: string }) => {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.search) q.set('search', params.search);
  return adminRequest(`/xxx?${q}`);
},

// GET 单条
getXxx: (id: number) => adminRequest(`/xxx/${id}`),

// POST 新增
createXxx: (data: { name: string }) => adminRequest('/xxx', {
  method: 'POST',
  body: JSON.stringify(data),
}),

// PUT 更新
updateXxx: (id: number, data: Partial<{ name: string; status: string }>) =>
  adminRequest(`/xxx/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

// DELETE
deleteXxx: (id: number) => adminRequest(`/xxx/${id}`, { method: 'DELETE' }),
```

---

## 六、后端路由 + Controller 模板

> 后端只有编译后的 `server/dist/` JS 文件，直接在 JS 里新增代码。

### 新增路由（`server/dist/routes/admin.js`）

在 `exports.default = router` **之前**插入：

```js
// GET 列表
router.get('/xxx', adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : null;

    const where = search ? 'WHERE name LIKE ?' : '';
    const params = search ? [search, limit, offset] : [limit, offset];

    const [rows] = await database_1.default.query(
      `SELECT * FROM xxx ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      params
    );
    const [[{ total }]] = await database_1.default.query(
      `SELECT COUNT(*) as total FROM xxx ${where}`,
      search ? [search] : []
    );

    res.json({ items: rows, pagination: { total, pages: Math.ceil(total / limit), page } });
  } catch (err) {
    console.error('GET /admin/xxx error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET 单条
router.get('/xxx/:id', adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, async (req, res) => {
  try {
    const [rows] = await database_1.default.execute('SELECT * FROM xxx WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: '未找到' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST 新增
router.post('/xxx', adminAuth_1.authenticateAdmin, adminAuth_1.requireSuperAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '名称不能为空' });
    const [result] = await database_1.default.execute(
      'INSERT INTO xxx (name, created_at) VALUES (?, NOW())',
      [name.trim()]
    );
    res.json({ id: result.insertId, name: name.trim() });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// PUT 更新
router.put('/xxx/:id', adminAuth_1.authenticateAdmin, adminAuth_1.requireSuperAdmin, async (req, res) => {
  try {
    const { name, status } = req.body;
    await database_1.default.execute(
      'UPDATE xxx SET name = ?, status = ?, updated_at = NOW() WHERE id = ?',
      [name, status, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE
router.delete('/xxx/:id', adminAuth_1.authenticateAdmin, adminAuth_1.requireSuperAdmin, async (req, res) => {
  try {
    await database_1.default.execute('DELETE FROM xxx WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});
```

### LIMIT/OFFSET 注意事项

`pool.execute()` 对 LIMIT/OFFSET 参数类型有限制，必须传整数：

```js
// 正确：拼字符串或用 pool.query()
const [rows] = await db.query(`SELECT * FROM t LIMIT ${limit} OFFSET ${offset}`);

// 错误（会 500）：
const [rows] = await db.execute('SELECT * FROM t LIMIT ? OFFSET ?', [limit, offset]);
// 传 number 会报 ER_PARSE_ERROR，必须用 query 或先 String() 再拼
```

### 权限中间件

| 中间件 | 含义 |
|--------|------|
| `authenticateAdmin` | 验证 Bearer token，解析出 `req.admin` |
| `requireAdmin` | 角色 >= admin（admin、super_admin） |
| `requireSuperAdmin` | 仅 super_admin |

---

## 七、导航菜单注册

新页面需要在 `src/app/admin/layout.tsx` 的 `NAV_ITEMS` 数组里加一条：

```tsx
{
  to: '/admin/xxx',
  labelEn: 'XXX Management',
  labelZh: 'XXX 管理',
  icon: SomeIcon,          // 从 lucide-react 导入
  superAdminOnly: false,   // true = 只有 super_admin 看到
  // section: 'tools',    // 可选，分组
},
```

---

## 八、Field（移动端）模块模板

适用场景：外勤人员手机端使用的表单/问卷。

**前端**：`src/app/field/*/page.tsx`
**API 客户端**：`fieldApi`（`src/lib/adminApi.ts` 末尾）
**后端路由**：`server/dist/routes/field.js`

```tsx
'use client';
import { fieldApi } from '@/lib/adminApi';

export default function FieldXxxPage() {
  // fieldApi 用 field_token（localStorage）而非 admin_token
  const submit = async (data: unknown) => {
    try {
      await fieldApi.submitXxx(data);
    } catch (err) {
      // 错误处理
    }
  };
}
```

后端 field 路由（`server/dist/routes/field.js`）：

```js
// 在 exports.default = router 之前：
router.post('/xxx', fieldInterviewController_1.someMiddleware, async (req, res) => {
  // ...
});
```

---

## 九、常用 UI 组件速查

| 需求 | 使用 | 禁止 |
|------|------|------|
| 下拉选择 | `<AdminSelect />` | 裸 `<select>` |
| 确认弹窗 | `showConfirm({ title, message })` → Promise\<boolean\> | 裸 `window.confirm` |
| 操作反馈 | `showToast('文字', 'success'|'error'|'info')` | 裸 `alert` |
| Logo | `<TarmeerLogo />` | 内联 SVG/文字 |
| 悬浮提示 | `FloatingTip`（fixed 定位） | CSS group-hover |
| 密码输入框 | `<PasswordInput />` | 自己写 eye icon |

---

## 十、开发流程速查

### 只改前端

```bash
# Vite/Next.js 热更新，一般不需要重启
# 如果改了 next.config.ts，必须重启前端：
PORT=5180 node_modules/.bin/next dev --port 5180
```

### 改了后端

```bash
# 1. 编译（如果有 TS 源码；本项目直接改 dist/ JS 则跳过）
# server/node_modules/.bin/tsc

# 2. Kill 旧进程 + 重启
lsof -i :3002 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null; sleep 1
PORT=3002 DEV_SKIP_EMAIL=true node server/dist/app.js > /tmp/tarmeer-api-3002.log 2>&1 &
```

### 验证服务正常

```bash
curl -s http://localhost:3002/api/health  # 后端
curl -s http://localhost:5180/admin/login  # 前端（看 200）
```

---

## 十一、禁止事项清单

| 禁止 | 替代 |
|------|------|
| `VITE_*` 环境变量 | `NEXT_PUBLIC_*` |
| `react-helmet-async` `<Helmet>` | server component 用 `export const metadata`；client 用 `document.title` in useEffect |
| render 体里调 `router.replace/push` | 放进 `useEffect` |
| `useSearchParams()` 直接在页面组件顶层 | 包裹在子组件 + 父层 `<Suspense>` |
| `pool.execute()` 传 number 给 LIMIT/OFFSET | 用 `pool.query()` 拼整数 |
| 裸 `<select>` 下拉 | `<AdminSelect />` |
| 在 render 体直接 async（页面组件） | 用 `useEffect` + 状态 |
