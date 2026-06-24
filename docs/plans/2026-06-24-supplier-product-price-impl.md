# 供应商产品上传带价格+单位 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 供应商在个人中心上传"产品"时必须填写价格 + 单位（建材外贸常用单位，下拉+自定义，可选"起价"），价格币种跟随供应商所属国家，公共详情页同步展示。

**Architecture:** 三层改动 —— ① DB：`supplier_products` 经 autoMigrate 幂等加 3 列；② 后端：`supplierProductController.js`（直接改 dist，无 TS 源）增删改带价格 + 强制校验；③ 前端：共享单位/格式化 util（`src/lib`，单一真相源）→ 供应商表单 `products/page.tsx` + 公共详情 `SupplierDetailClient.tsx`。币种由 `getCountry(country).currency` 推导，不入库。

**Tech Stack:** Next.js (client components, TS/TSX) + Express (编译后的 dist JS) + MySQL；前端 `<AdminSelect>`、`getCountry`（`src/lib/country.ts`）。

---

## 背景约束（实现前必读）

- **后端无 TS 源**：`server/src/` 为空，直接编辑 `server/dist/**/*.js`。改后部署需 rsync + `pm2 restart tarmeer-api`（见 AGENTS.md）。
- **币种**：`src/lib/country.ts` 当前只有 `ae`(AED) / `vn`(VND)，**无 sa**。`getCountry(code)` 对未知码兜底 `ae`→AED。SA 若日后加入 country.ts，币种自动跟随，无需改本功能。
- **单一真相源铁律**：单位列表与价格格式化只在 `src/lib/supplierProductUnits.ts` 定义一处，三处（供应商表单卡片 / 公共详情 / 未来）共用。
- **全量搜索铁律**：读 `supplier_products` 的 SELECT 用的是 `SELECT *`（`listProducts`/`listMyProducts`/`addProduct` 回读），加列后自动带出，无需改 SELECT 语句；但**公共详情/供应商端的 TS interface 必须补字段**否则前端读不到。
- **DB 列可空**：存量旧产品无价格，DB 列 NULL，公共页/卡片"无价格则不显示价格块"；新上传在表单+后端强制必填。

---

## 文件结构

| 文件 | 责任 | 动作 |
|------|------|------|
| `src/lib/supplierProductUnits.ts` | 单位字典 + `formatProductPrice` 格式化（单一真相源） | 新建 |
| `src/lib/supplierProductUnits.test.mjs` | 格式化函数单测 | 新建 |
| `server/dist/lib/autoMigrate.js` | `supplier_products` 加 3 列 | 改 |
| `server/dist/controllers/supplierProductController.js` | add/update 接收+校验+落库价格 | 改 |
| `src/app/supplier/products/page.tsx` | 供应商上传表单 + 卡片展示价格 | 改 |
| `src/components/materials/SupplierDetailClient.tsx` | 公共详情页产品展示价格 | 改 |
| `scripts/harness/supplier-product-price.mjs` | 端到端 API 回归（不填价格→400 / 填了→201 持久化） | 新建 |

---

## Task 1: 单位字典 + 价格格式化 util（含单测，TDD）

**Files:**
- Create: `src/lib/supplierProductUnits.ts`
- Test: `src/lib/supplierProductUnits.test.mjs`

- [ ] **Step 1: 写失败的测试**

`src/lib/supplierProductUnits.test.mjs`：

```js
import assert from 'node:assert';
import { test } from 'node:test';
import { PRODUCT_UNITS, isValidUnit, formatProductPrice } from './supplierProductUnits.ts';

test('PRODUCT_UNITS 覆盖建材外贸常用单位', () => {
  const values = PRODUCT_UNITS.map(u => u.value);
  for (const v of ['PCS', 'SET', 'SQM', 'LM', 'M', 'CBM', 'KG', 'TON', 'ROLL', 'CTN', 'BAG', 'SHEET', 'CONTAINER']) {
    assert.ok(values.includes(v), `缺单位 ${v}`);
  }
});

test('isValidUnit：预设值或非空自定义文本为真，空为假', () => {
  assert.equal(isValidUnit('SQM'), true);
  assert.equal(isValidUnit('每托盘'), true); // 自定义文本
  assert.equal(isValidUnit(''), false);
  assert.equal(isValidUnit('   '), false);
  assert.equal(isValidUnit(null), false);
});

test('formatProductPrice：千分位 + 币种 + 起价 + 单位', () => {
  assert.equal(formatProductPrice(1200, 'SQM', false, 'AED'), 'AED 1,200 / ㎡');
  assert.equal(formatProductPrice(1200, 'SQM', true, 'AED'), 'AED 1,200 起 / ㎡');
  assert.equal(formatProductPrice(50000, 'PCS', false, 'VND'), 'VND 50,000 / 件');
  // 自定义单位原样显示
  assert.equal(formatProductPrice(80, '每托盘', false, 'AED'), 'AED 80 / 每托盘');
});

test('formatProductPrice：无价格返回空串（旧产品不显示价格块）', () => {
  assert.equal(formatProductPrice(null, 'SQM', false, 'AED'), '');
  assert.equal(formatProductPrice(undefined, null, false, 'AED'), '');
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd /Users/kp/orca/workspaces/tarmeer-4.0-local/供应商上传东西要带上价格 && node --experimental-strip-types --test src/lib/supplierProductUnits.test.mjs`
Expected: FAIL — `Cannot find module './supplierProductUnits.ts'`

- [ ] **Step 3: 写最小实现**

`src/lib/supplierProductUnits.ts`：

```ts
// 供应商产品价格单位 — 建材外贸常用单位（单一真相源，禁止他处硬编码）。
// 中英标签：供应商门户用 useAdminT 选 zh/en；公共详情默认显示 label（zh）。

export interface ProductUnit {
  /** 入库存储值（预设用大写英文码；自定义直接存用户文本） */
  value: string;
  /** 英文显示 */
  en: string;
  /** 中文显示 */
  zh: string;
}

/** 建材外贸常用单位。CONTAINER 用于整柜报价。 */
export const PRODUCT_UNITS: ProductUnit[] = [
  { value: 'PCS', en: 'pcs', zh: '件' },
  { value: 'SET', en: 'set', zh: '套' },
  { value: 'SQM', en: '㎡', zh: '㎡' },
  { value: 'LM', en: 'linear m', zh: '延米' },
  { value: 'M', en: 'm', zh: '米' },
  { value: 'CBM', en: 'm³', zh: 'm³' },
  { value: 'KG', en: 'kg', zh: '千克' },
  { value: 'TON', en: 'ton', zh: '吨' },
  { value: 'ROLL', en: 'roll', zh: '卷' },
  { value: 'CTN', en: 'carton', zh: '箱' },
  { value: 'BAG', en: 'bag', zh: '袋' },
  { value: 'SHEET', en: 'sheet', zh: '张' },
  { value: 'CONTAINER', en: 'container', zh: '货柜' },
];

const UNIT_MAP = new Map(PRODUCT_UNITS.map(u => [u.value, u]));

/** 单位是否有效：预设码 或 非空自定义文本。 */
export function isValidUnit(unit: unknown): boolean {
  if (typeof unit !== 'string') return false;
  return unit.trim().length > 0;
}

/** 把存储的 unit 值转成显示文本（预设码→中文 label；自定义→原样）。 */
export function unitLabel(unit?: string | null, lang: 'zh' | 'en' = 'zh'): string {
  if (!unit) return '';
  const preset = UNIT_MAP.get(unit);
  if (preset) return lang === 'en' ? preset.en : preset.zh;
  return unit; // 自定义文本
}

/**
 * 格式化价格展示。无价格(null/undefined)返回空串 → 调用方据此不渲染价格块。
 * 例：formatProductPrice(1200, 'SQM', true, 'AED') => 'AED 1,200 起 / ㎡'
 */
export function formatProductPrice(
  price: number | null | undefined,
  unit: string | null | undefined,
  from: boolean,
  currency: string,
  lang: 'zh' | 'en' = 'zh',
): string {
  if (price == null || Number.isNaN(Number(price))) return '';
  const num = Number(price);
  const amount = num.toLocaleString('en-US', { maximumFractionDigits: 2 });
  const fromTxt = from ? (lang === 'en' ? ' (from)' : ' 起') : '';
  const u = unitLabel(unit, lang);
  const unitTxt = u ? ` / ${u}` : '';
  return `${currency} ${amount}${fromTxt}${unitTxt}`;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `node --experimental-strip-types --test src/lib/supplierProductUnits.test.mjs`
Expected: PASS（4 tests）

> 若本机 node 不支持 `--experimental-strip-types` 读 .ts import，改用 `node --test`+把测试里 import 路径换成编译后路径，或临时 `npx tsx --test`。优先 `node --experimental-strip-types`（node ≥ 22.6）。

- [ ] **Step 5: 提交**

```bash
git add src/lib/supplierProductUnits.ts src/lib/supplierProductUnits.test.mjs
git commit -m "feat(supplier): 产品价格单位字典 + 格式化工具(含单测)"
```

---

## Task 2: DB 加列（autoMigrate 幂等）

**Files:**
- Modify: `server/dist/lib/autoMigrate.js`（`REQUIRED_COLUMNS` 数组，紧跟现有 `supplier_products` 的 `image_urls`/`category` 两行之后）

- [ ] **Step 1: 在 REQUIRED_COLUMNS 加 3 列**

找到（约 line 421-422）：

```js
    // Supplier product multi-image + category
    { table: 'supplier_products', column: 'image_urls', type: 'JSON NULL' },
    { table: 'supplier_products', column: 'category', type: 'VARCHAR(100) NULL' },
```

在其后插入：

```js
    // Supplier product pricing (price required at API/form layer; column nullable for legacy rows)
    { table: 'supplier_products', column: 'price', type: 'DECIMAL(12,2) NULL' },
    { table: 'supplier_products', column: 'price_unit', type: 'VARCHAR(32) NULL' },
    { table: 'supplier_products', column: 'price_from', type: 'TINYINT(1) NOT NULL DEFAULT 0' },
```

- [ ] **Step 2: 重启本地后端触发 autoMigrate 并验证列已加**

```bash
source server/.env
lsof -i :3002 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null; sleep 1
PORT=3002 DEV_SKIP_EMAIL=true node server/dist/app.js > /tmp/tarmeer-api-3002.log 2>&1 &
sleep 4
mysql -uroot -proot123 -e "USE tarmeer; SHOW COLUMNS FROM supplier_products LIKE 'price%';"
```

Expected: 输出 `price` / `price_unit` / `price_from` 三行。

- [ ] **Step 3: 提交**

```bash
git add server/dist/lib/autoMigrate.js
git commit -m "feat(supplier): supplier_products 加 price/price_unit/price_from 列"
```

---

## Task 3: 后端校验 + 落库

**Files:**
- Modify: `server/dist/controllers/supplierProductController.js`（`addProduct` line 79-106、`updateProduct` line 107-128）

- [ ] **Step 1: 在文件顶部校验辅助（紧跟 require 之后，约 line 18 后）加入价格校验函数**

```js
function validatePrice(body) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0) {
        return 'A valid price greater than 0 is required.';
    }
    const unit = typeof body.price_unit === 'string' ? body.price_unit.trim() : '';
    if (unit.length === 0) {
        return 'Price unit is required.';
    }
    return null; // ok
}
```

- [ ] **Step 2: 改 `addProduct`**

把 line 84 解构改为带价格：

```js
        const { title, description, category, image_url, image_urls, sort_order, price, price_unit, price_from } = req.body;
```

在 `if (urls.length === 0)` 校验块之后、`const primaryUrl` 之前插入价格校验：

```js
        const priceErr = validatePrice(req.body);
        if (priceErr)
            return res.status(400).json({ error: priceErr });
```

把 INSERT（line 93）替换为带价格列：

```js
        const [result] = await database_1.default.execute('INSERT INTO supplier_products (supplier_profile_id, title, description, category, image_url, image_urls, sort_order, price, price_unit, price_from) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [profileId, title || null, description || null, category || null, primaryUrl, urlsJson, sort_order || 0, Number(price), String(price_unit).trim(), price_from ? 1 : 0]);
```

- [ ] **Step 3: 改 `updateProduct`**

把 line 113 解构改为：

```js
        const { title, description, category, image_url, image_urls, sort_order, price, price_unit, price_from } = req.body;
```

在 `if (existing.length === 0)` 之后插入校验：

```js
        const priceErr = validatePrice(req.body);
        if (priceErr)
            return res.status(400).json({ error: priceErr });
```

把 UPDATE（line 120）替换为带价格列：

```js
        await database_1.default.execute('UPDATE supplier_products SET title=?, description=?, category=?, image_url=COALESCE(?, image_url), image_urls=COALESCE(?, image_urls), sort_order=?, price=?, price_unit=?, price_from=? WHERE id=?', [title || null, description || null, category || null, primaryUrl, urlsJson, sort_order ?? 0, Number(price), String(price_unit).trim(), price_from ? 1 : 0, id]);
```

> `listProducts` / `listMyProducts` 用 `SELECT *`，自动带出新列，无需改。

- [ ] **Step 4: 重启后端 + 手测校验分支**

```bash
lsof -i :3002 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null; sleep 1
source server/.env
PORT=3002 DEV_SKIP_EMAIL=true node server/dist/app.js > /tmp/tarmeer-api-3002.log 2>&1 &
sleep 4
# 无 token 也能验证到价格校验在 auth 之后；完整端到端在 Task 6 脚本里跑
curl -s --noproxy '*' -X POST http://localhost:3002/api/suppliers/me/products -H 'Content-Type: application/json' -d '{}' | head
```

Expected: 返回 401/403（auth 先拦）或 400 价格错误 —— 表示路由通、controller 加载成功无语法错误。

- [ ] **Step 5: 提交**

```bash
git add server/dist/controllers/supplierProductController.js
git commit -m "feat(supplier): 产品 add/update 强制校验并落库 price/unit/from"
```

---

## Task 4: 供应商上传表单 + 卡片展示

**Files:**
- Modify: `src/app/supplier/products/page.tsx`

- [ ] **Step 1: 顶部 import 与 interface 补字段**

在 import 区（line 8 后）加：

```tsx
import { PRODUCT_UNITS, formatProductPrice } from '@/lib/supplierProductUnits';
import { getCountry } from '@/lib/country';
```

`interface Product`（line 21-28）加：

```tsx
  price?: number | null;
  price_unit?: string | null;
  price_from?: 0 | 1 | boolean;
```

- [ ] **Step 2: 加表单状态 + 币种获取**

在 `const [newCat, setNewCat] = useState('');`（line 54）之后加：

```tsx
  const [newPrice, setNewPrice] = useState('');
  const [newUnit, setNewUnit] = useState('');          // '' = 未选；'__custom__' = 自定义
  const [newUnitCustom, setNewUnitCustom] = useState('');
  const [newPriceFrom, setNewPriceFrom] = useState(false);
  const [currency, setCurrency] = useState('AED');
```

在现有 `useEffect`（fetch products，line 59-65）之后新增一个 effect 取供应商国家→币种：

```tsx
  useEffect(() => {
    fetch(`${API_BASE}/suppliers/me/profile`, { headers: authHeaders() as HeadersInit })
      .then(r => r.json())
      .then(data => { if (data?.profile?.country) setCurrency(getCountry(data.profile.country).currency); })
      .catch(() => {});
  }, []);
```

构造单位下拉选项（在 `CATEGORY_OPTIONS` 定义之后，line 45 后）：

```tsx
  const UNIT_OPTIONS = [
    { value: '', label: t('Select unit', '选择单位') },
    ...PRODUCT_UNITS.map(u => ({ value: u.value, label: u.zh === u.en ? u.zh : `${u.zh} / ${u.en}` })),
    { value: '__custom__', label: t('Custom…', '自定义…') },
  ];
```

- [ ] **Step 3: 改 `handleAdd` —— 校验 + 入 body**

把 line 68 的图片校验之后、`setSaving(true)` 之前加价格校验，并改 body：

```tsx
  const handleAdd = async () => {
    if (newImageUrls.length === 0) { setMsg(t('Please upload at least one image.', '请至少上传一张图片。')); return; }
    const priceNum = Number(newPrice);
    if (!Number.isFinite(priceNum) || priceNum <= 0) { setMsg(t('Please enter a valid price.', '请输入有效价格。')); return; }
    const unitVal = newUnit === '__custom__' ? newUnitCustom.trim() : newUnit;
    if (!unitVal) { setMsg(t('Please select or enter a unit.', '请选择或填写单位。')); return; }
    setSaving(true);
    setMsg('');
    try {
      const res = await fetch(`${API_BASE}/suppliers/me/products`, {
        method: 'POST',
        headers: authHeaders() as HeadersInit,
        body: JSON.stringify({
          title: newTitle || null,
          description: newDesc || null,
          category: newCat || null,
          image_urls: newImageUrls,
          price: priceNum,
          price_unit: unitVal,
          price_from: newPriceFrom,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProducts(prev => [...prev, data.product]);
      setNewTitle(''); setNewDesc(''); setNewCat(''); setNewImageUrls([]);
      setNewPrice(''); setNewUnit(''); setNewUnitCustom(''); setNewPriceFrom(false);
      setAdding(false);
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : t('Failed.', '失败。'));
    } finally {
      setSaving(false);
    }
  };
```

- [ ] **Step 4: 表单 UI 加价格/单位/起价**

在品类那个 grid（line 138-154）里、`Category` 块之后、`Description` 块之前插入两块（价格 + 单位）：

```tsx
            <div>
              <label className={labelCls}>{t('Price *', '价格 *')}</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-stone-400 shrink-0">{currency}</span>
                <input type="number" min="0" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)}
                  placeholder="0.00" className={inputCls} />
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-stone-500 cursor-pointer">
                <input type="checkbox" checked={newPriceFrom} onChange={e => setNewPriceFrom(e.target.checked)}
                  className="rounded border-stone-300 text-[#b8864a] focus:ring-[#B8864A]/30" />
                {t('Price is "from" (starting price)', '此为起价（from）')}
              </label>
            </div>
            <div>
              <label className={labelCls}>{t('Unit *', '单位 *')}</label>
              <AdminSelect options={UNIT_OPTIONS} value={newUnit} onChange={setNewUnit} />
              {newUnit === '__custom__' && (
                <input type="text" value={newUnitCustom} onChange={e => setNewUnitCustom(e.target.value)}
                  placeholder={t('e.g. per pallet', '如：每托盘')} className={`${inputCls} mt-2`} />
              )}
            </div>
```

- [ ] **Step 5: 提交按钮 disabled 条件**

把 line 163 的提交按钮 `disabled={saving}` 改为：

```tsx
            <button onClick={handleAdd} disabled={saving || newImageUrls.length === 0 || !(Number(newPrice) > 0) || !(newUnit === '__custom__' ? newUnitCustom.trim() : newUnit)} className="btn-primary flex items-center gap-2 disabled:opacity-50">
```

- [ ] **Step 6: 产品卡片展示价格**

在卡片描述块（line 189-192）之后、`</div>`(line 193) 之前加：

```tsx
                {(() => { const txt = formatProductPrice(p.price, p.price_unit ?? null, !!p.price_from, currency); return txt ? <p className="text-sm font-semibold text-[#b8864a] mt-1">{txt}</p> : null; })()}
```

- [ ] **Step 7: 启动前端 + 目视**

```bash
lsof -i :5180 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null; sleep 1
cd /Users/kp/orca/workspaces/tarmeer-4.0-local && PORT=5180 node_modules/.bin/next dev --port 5180 > /tmp/tarmeer-next-5180.log 2>&1 &
sleep 6
curl -s --noproxy '*' -o /dev/null -w "%{http_code}\n" http://localhost:5180/supplier/products
```

Expected: 200。浏览器登录供应商→产品页：未填价格时"添加产品"按钮置灰；填价格+选单位后可提交，卡片显示 `AED 1,200 起 / ㎡`。

- [ ] **Step 8: 提交**

```bash
git add src/app/supplier/products/page.tsx
git commit -m "feat(supplier): 上传产品表单加价格/单位/起价(必填) + 卡片展示"
```

---

## Task 5: 公共详情页展示价格

**Files:**
- Modify: `src/components/materials/SupplierDetailClient.tsx`

- [ ] **Step 1: import + Product interface 补字段 + 供应商国家币种**

import 区（line 16 后）加：

```tsx
import { formatProductPrice } from '@/lib/supplierProductUnits';
import { getCountry } from '@/lib/country';
```

`interface Product`（line 32-39）加：

```tsx
  price: number | null;
  price_unit: string | null;
  price_from: 0 | 1;
```

确认 `interface SupplierProfile`（line 18）含 `country: string;`，若无则加上（公共详情 detail 接口 `SELECT *` 已返回 country，仅 TS 类型缺）。

在组件内（`supplier` 已就绪处，如 line 179 `categoryList` 附近）加：

```tsx
  const currency = getCountry(supplier?.country).currency;
```

> `getCountry(undefined)` 兜底 ae→AED，安全。

- [ ] **Step 2: 产品卡片加价格**

在产品卡片（line 367-369 那段 category/title/description）之后插入：

```tsx
                        {(() => { const txt = formatProductPrice(p.price, p.price_unit, !!p.price_from, currency); return txt ? <p className="text-[15px] font-semibold text-[#b8864a] mt-0.5">{txt}</p> : null; })()}
```

- [ ] **Step 3: build 验证 + 目视**

```bash
cd /Users/kp/orca/workspaces/tarmeer-4.0-local && node_modules/.bin/next build 2>&1 | tail -20
```

Expected: exit 0，无 TS 报错。
> ⚠️ 跑过 build 会覆盖 `.next`，之后重启 5180 dev server（见 Task 4 Step 7）。

浏览器开某供应商公共详情页 `/materials/suppliers/<slug>`，产品卡显示价格（有价格的）；旧的无价格产品不显示价格块。

- [ ] **Step 4: 提交**

```bash
git add src/components/materials/SupplierDetailClient.tsx
git commit -m "feat(supplier): 公共详情页产品卡展示价格(按国家币种)"
```

---

## Task 6: 端到端回归 + 验收

**Files:**
- Create: `scripts/harness/supplier-product-price.mjs`

- [ ] **Step 1: 写端到端脚本**

参考现有 `scripts/harness/smoke-test.mjs` 的请求写法（base URL、登录拿 token 方式）。脚本逻辑：

```js
// 用法：node scripts/harness/supplier-product-price.mjs
// 前置：本地后端 3002 已起（含本任务后端改动）；存在测试供应商账号或脚本内注册登录。
import assert from 'node:assert';

const BASE = process.env.API_BASE || 'http://localhost:3002/api';
// TODO(执行时): 复用 smoke-test.mjs 里供应商登录逻辑取 token；若无测试号则先注册。
const token = process.env.SUPPLIER_TOKEN; // 执行时由登录步骤注入
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

// UC1: 不填价格被拒
let r = await fetch(`${BASE}/suppliers/me/products`, { method: 'POST', headers: H,
  body: JSON.stringify({ image_urls: ['/uploads/x.jpg'] }) });
assert.equal(r.status, 400, 'UC1 不填价格应 400');

// UC2: 价格<=0 被拒
r = await fetch(`${BASE}/suppliers/me/products`, { method: 'POST', headers: H,
  body: JSON.stringify({ image_urls: ['/uploads/x.jpg'], price: 0, price_unit: 'SQM' }) });
assert.equal(r.status, 400, 'UC2 价格<=0 应 400');

// UC3: 缺单位被拒
r = await fetch(`${BASE}/suppliers/me/products`, { method: 'POST', headers: H,
  body: JSON.stringify({ image_urls: ['/uploads/x.jpg'], price: 100 }) });
assert.equal(r.status, 400, 'UC3 缺单位应 400');

// UC4: 合法入库并持久化
r = await fetch(`${BASE}/suppliers/me/products`, { method: 'POST', headers: H,
  body: JSON.stringify({ image_urls: ['/uploads/x.jpg'], price: 1200, price_unit: 'SQM', price_from: true }) });
assert.equal(r.status, 201, 'UC4 合法应 201');
const { product } = await r.json();
assert.equal(Number(product.price), 1200, 'UC4 price 落库');
assert.equal(product.price_unit, 'SQM', 'UC4 unit 落库');
assert.equal(Number(product.price_from), 1, 'UC4 from 落库');

// 清理
await fetch(`${BASE}/suppliers/me/products/${product.id}`, { method: 'DELETE', headers: H });
console.log('supplier-product-price: 4/4 PASS');
```

> 执行者注：依据 smoke-test.mjs 现成的供应商鉴权工具补全 token 获取。若 harness 无供应商登录工具，则在脚本内调用注册+登录端点（注意 country-walkthrough 提到注册限流 429 → 跑前重启后端）。

- [ ] **Step 2: 跑单测 + 端到端 + smoke**

```bash
cd /Users/kp/orca/workspaces/tarmeer-4.0-local
# 重启后端避免注册限流
lsof -i :3002 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null; sleep 1
source server/.env && PORT=3002 DEV_SKIP_EMAIL=true node server/dist/app.js > /tmp/tarmeer-api-3002.log 2>&1 &
sleep 4
node --experimental-strip-types --test src/lib/supplierProductUnits.test.mjs
node scripts/harness/supplier-product-price.mjs
node scripts/harness/smoke-test.mjs
```

Expected: 单测 4/4 PASS；端到端 `4/4 PASS`；smoke-test 全绿。

- [ ] **Step 3: 前端 build 终检**

```bash
node_modules/.bin/next build 2>&1 | tail -5
```

Expected: exit 0。完成后重启 5180 dev。

- [ ] **Step 4: 提交**

```bash
git add scripts/harness/supplier-product-price.mjs
git commit -m "test(supplier): 产品价格端到端回归(4 UC) — 不填价格/单位被拒, 合法落库"
```

---

## 自检（writing-plans self-review 结果）

- **Spec 覆盖**：① 仅 Products ✅(Task 3/4/5 只动产品)；② 必填价格+单位+起价 ✅(Task 3 校验 + Task 4 表单 disabled)；③ 币种跟随国家 ✅(Task 1 formatter + Task 4/5 getCountry)；④ 单位下拉+自定义 ✅(Task 1 字典 + Task 4 `__custom__`)；⑤ 旧产品不显示价格块 ✅(formatProductPrice 无价格返空)；⑥ 公共页同步 ✅(Task 5)；⑦ 测试 ✅(Task 1 单测 + Task 6 端到端 + smoke + build)。
- **类型一致**：`price/price_unit/price_from` 三处 interface 命名统一；`formatProductPrice(price, unit, from, currency, lang?)` 签名在 Task 1 定义、Task 4/5 调用一致；`__custom__` 哨兵值前后一致。
- **无占位符**：所有代码步骤含完整代码与确切命令。端到端脚本的 token 获取标注了"复用 smoke-test 鉴权"——执行者需按现成工具补全（已说明原因：避免臆造不存在的登录工具）。

## 部署（用户说"部署"后才执行）

1. `git push origin HEAD:main`
2. 后端：rsync `server/dist/lib/autoMigrate.js` + `server/dist/controllers/supplierProductController.js` → 生产，`pm2 restart tarmeer-api`（autoMigrate 启动自动加列）。
3. 前端：`git pull && next build && pm2 restart tarmeer-next`。
4. 验证：生产供应商门户上传产品须填价格；公共详情页显示价格。
