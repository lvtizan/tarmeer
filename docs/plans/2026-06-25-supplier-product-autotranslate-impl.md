# 供应商产品自动翻译 实现计划

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development。Steps 用 `- [ ]`。

**Goal:** 供应商填的产品名称/描述用免费 Google 端点翻成站点语言（ae→en/vn→vi），表单可改、写入存译文、官网展示译文(缺则原文)。无任何付费 token。

**Architecture:** DB 加 2 列 → 后端纯翻译 lib(可单测)+鉴权端点+存储 → 前端表单失焦自动翻译可改 → 公开页展示译文。后端编辑 `server/dist/**/*.js`(无 TS 源)。币种/国家从 `supplier_profiles.country` 取。

**承接** [[2026-06-25-supplier-product-autotranslate-design]]。

## 背景约束
- 后端无 TS 源，直接改 `server/dist`；改后 rsync + `pm2 restart tarmeer-api`。
- worktree 构建用 `next build --webpack`（turbopack 对软链 node_modules panic）。
- 本地后端 3002 已可跑（`server/.env`、`server/node_modules` 已软链）。测试供应商 `supplierUserId:910`(ae) / VN 可用 979。
- Google 端点：`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=<lang>&dt=t&q=<encoded>`；返回 `[[["译","原",...],...],...]`，译文 = `data[0].map(s=>s[0]).join('')`。

## 文件
| 文件 | 动作 |
|------|------|
| `server/dist/lib/translate.js` | 新建：`parseGoogleTranslate(body)` + `translate(text,target)`（无 DB 依赖） |
| `server/dist/lib/translate.test.mjs` | 新建：解析函数单测 |
| `server/dist/lib/autoMigrate.js` | 加 2 列 |
| `server/dist/controllers/supplierProductController.js` | translate 端点 handler + add/update 存译文 |
| `server/dist/routes/suppliers.js` | 注册 `POST /me/translate` |
| `src/app/supplier/products/page.tsx` | 译文框 + 失焦自动翻译 + 重新翻译 + 提交带译文 |
| `src/components/materials/SupplierDetailClient.tsx` | 公开页展示译文‖原文 |
| `scripts/harness/supplier-product-translate.mjs` | 端到端回归 |

---

## Task 1: 翻译 lib + 单测（TDD）

**Files:** Create `server/dist/lib/translate.js`, `server/dist/lib/translate.test.mjs`

- [ ] **Step 1: 失败测试** `server/dist/lib/translate.test.mjs`:

```js
import assert from 'node:assert';
import { test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parseGoogleTranslate } = require('./translate.js');

test('parseGoogleTranslate: 拼接 data[0] 各段译文', () => {
  const body = JSON.stringify([[["Marble tiles ","大理石砖 ",null,null,3],["800x800","800x800",null,null,3]],null,"zh-CN"]);
  assert.equal(parseGoogleTranslate(body), 'Marble tiles 800x800');
});
test('parseGoogleTranslate: 畸形/空输入返回空串', () => {
  assert.equal(parseGoogleTranslate('not json'), '');
  assert.equal(parseGoogleTranslate('null'), '');
  assert.equal(parseGoogleTranslate(''), '');
  assert.equal(parseGoogleTranslate('[]'), '');
});
```

- [ ] **Step 2: 跑→失败** `node --test server/dist/lib/translate.test.mjs`（Cannot find module './translate.js'）

- [ ] **Step 3: 实现** `server/dist/lib/translate.js`:

```js
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGoogleTranslate = parseGoogleTranslate;
exports.translate = translate;

/** 解析 Google gtx 返回：data[0] 各段 seg[0] 拼接。畸形输入返回 ''。 */
function parseGoogleTranslate(body) {
    try {
        const data = JSON.parse(body);
        if (!Array.isArray(data) || !Array.isArray(data[0])) return '';
        return data[0].map(seg => (Array.isArray(seg) ? seg[0] : '') || '').join('').trim();
    }
    catch {
        return '';
    }
}

/** 调 Google 免费端点把 text 翻成 target(如 'en'/'vi')。失败/空 → 返回原 text。8s 超时。 */
async function translate(text, target) {
    const src = (text || '').trim();
    if (!src) return '';
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(src)}`;
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok) return src;
        const out = parseGoogleTranslate(await res.text());
        return out || src;
    }
    catch {
        return src; // 容错：失败返回原文，绝不抛
    }
}
```

- [ ] **Step 4: 跑→通过** `cd <root> && node --test server/dist/lib/translate.test.mjs` → 2 passing

- [ ] **Step 5: commit**
```bash
git add server/dist/lib/translate.js server/dist/lib/translate.test.mjs
git commit -m "feat(supplier): 免费翻译 lib(Google gtx) + 解析单测"
```

---

## Task 2: DB 加列

**Files:** `server/dist/lib/autoMigrate.js`

- [ ] **Step 1:** 在 `REQUIRED_COLUMNS` 里 supplier_products 价格列(`price_from`)之后加：
```js
    // Supplier product auto-translation (site-language; original kept in title/description)
    { table: 'supplier_products', column: 'title_translated', type: 'VARCHAR(255) NULL' },
    { table: 'supplier_products', column: 'description_translated', type: 'TEXT NULL' },
```

- [ ] **Step 2: 重启本地后端验列**
```bash
cd <root>; set -a; . server/.env; set +a
lsof -i :3002 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null; sleep 1
PORT=3002 DEV_SKIP_EMAIL=true node server/dist/app.js > /tmp/tarmeer-api-3002.log 2>&1 &
sleep 5
mysql -uroot -proot123 -e "USE tarmeer; SHOW COLUMNS FROM supplier_products LIKE '%translated%';"
```
Expected: `title_translated` / `description_translated` 两行。

- [ ] **Step 3: commit**
```bash
git add server/dist/lib/autoMigrate.js
git commit -m "feat(supplier): supplier_products 加 title_translated/description_translated"
```

---

## Task 3: 后端端点 + 存储

**Files:** `server/dist/controllers/supplierProductController.js`, `server/dist/routes/suppliers.js`

- [ ] **Step 1: controller 顶部引入 translate lib**（在现有 require 之后，约 line 18）：
```js
const translate_1 = require("../lib/translate");
```

- [ ] **Step 2: 加国家→语言 helper + translateText handler**（getProfileId 附近）：
```js
async function getProfileCountry(supplierUserId) {
    const [rows] = await database_1.default.execute('SELECT country FROM supplier_profiles WHERE supplier_user_id = ? LIMIT 1', [supplierUserId]);
    return rows[0]?.country || 'ae';
}
async function translateText(req, res) {
    try {
        const { text } = req.body;
        if (!text || !String(text).trim()) return res.json({ translated: '' });
        const country = await getProfileCountry(req.supplierUser.id);
        const target = country === 'vn' ? 'vi' : 'en';
        const translated = await translate_1.translate(String(text), target);
        res.json({ translated });
    }
    catch (error) {
        console.error('Translate error:', error);
        res.json({ translated: req.body?.text || '' }); // 容错
    }
}
```
并在文件底部 exports 区加：`exports.translateText = translateText;`（与其它 `exports.addProduct=...` 并列）。

- [ ] **Step 3: addProduct 存译文** — 解构(line ~95)加 `title_translated, description_translated`；INSERT 列+占位+值都加这两列：
```js
        const { title, description, category, image_url, image_urls, sort_order, price, price_unit, price_from, title_translated, description_translated } = req.body;
```
INSERT 改为（在 price_from 后追加两列）：
```js
        const [result] = await database_1.default.execute('INSERT INTO supplier_products (supplier_profile_id, title, description, category, image_url, image_urls, sort_order, price, price_unit, price_from, title_translated, description_translated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [profileId, title || null, description || null, category || null, primaryUrl, urlsJson, sort_order || 0, Number(price), price_unit.trim(), price_from ? 1 : 0, title_translated || null, description_translated || null]);
```

- [ ] **Step 4: updateProduct 存译文** — 解构(line ~127)加同样两字段；UPDATE 的 SET 追加 `title_translated=?, description_translated=?`（在 price_from=? 之后、WHERE 之前），值数组对应加 `title_translated || null, description_translated || null`（注意 id 仍在最后）。

- [ ] **Step 5: 注册路由** `server/dist/routes/suppliers.js` 在 `router.post('/me/products', ...)` 之前或之后加：
```js
router.post('/me/translate', supplierAuth_1.authenticateSupplier, products.translateText);
```

- [ ] **Step 6: 验证**
```bash
cd <root>; node --check server/dist/controllers/supplierProductController.js && echo "ctrl OK"
node --check server/dist/routes/suppliers.js && echo "routes OK"
set -a; . server/.env; set +a
lsof -i :3002 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null; sleep 1
PORT=3002 DEV_SKIP_EMAIL=true node server/dist/app.js > /tmp/tarmeer-api-3002.log 2>&1 &
sleep 5
curl -s --noproxy '*' -o /dev/null -w "translate(no auth)=%{http_code}\n" -X POST http://localhost:3002/api/suppliers/me/translate -H 'Content-Type: application/json' -d '{"text":"测试"}'
```
Expected: `ctrl OK`/`routes OK`；curl 返回 401（鉴权先拦，证明路由+controller加载无误）。

- [ ] **Step 7: commit**
```bash
git add server/dist/controllers/supplierProductController.js server/dist/routes/suppliers.js
git commit -m "feat(supplier): /me/translate 端点(按国家定目标语言) + add/update 存译文"
```

---

## Task 4: 供应商表单译文框 + 自动翻译

**Files:** `src/app/supplier/products/page.tsx`

- [ ] **Step 1: interface Product 加** `title_translated?: string | null; description_translated?: string | null;`

- [ ] **Step 2: state**（价格 state 之后）：
```tsx
  const [newTitleEn, setNewTitleEn] = useState('');
  const [newDescEn, setNewDescEn] = useState('');
  const [translating, setTranslating] = useState<'title' | 'desc' | null>(null);
```

- [ ] **Step 3: 翻译辅助**（handleAdd 之前）：
```tsx
  const translateField = async (text: string): Promise<string> => {
    if (!text.trim()) return '';
    const res = await fetch(`${API_BASE}/suppliers/me/translate`, {
      method: 'POST', headers: authHeaders() as HeadersInit, body: JSON.stringify({ text }),
    });
    const data = await res.json();
    return data?.translated || '';
  };
  const autoTranslateTitle = async (force = false) => {
    if (!newTitle.trim() || (newTitleEn.trim() && !force)) return;
    setTranslating('title');
    try { setNewTitleEn(await translateField(newTitle)); } finally { setTranslating(null); }
  };
  const autoTranslateDesc = async (force = false) => {
    if (!newDesc.trim() || (newDescEn.trim() && !force)) return;
    setTranslating('desc');
    try { setNewDescEn(await translateField(newDesc)); } finally { setTranslating(null); }
  };
```

- [ ] **Step 4: 名称/描述输入加 onBlur 自动翻译，下方加可编辑译文框 + 重新翻译按钮。**
名称输入加 `onBlur={() => autoTranslateTitle()}`；其所在 `<div>` 内、输入框之后加：
```tsx
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-stone-400">{t('English name (auto, editable)', '英文名称（自动翻译，可改）')}</span>
                  <button type="button" onClick={() => autoTranslateTitle(true)} disabled={!newTitle.trim() || translating === 'title'}
                    className="text-xs text-[#b8864a] hover:underline disabled:opacity-40">
                    {translating === 'title' ? t('Translating…', '翻译中…') : t('Re-translate', '重新翻译')}
                  </button>
                </div>
                <input type="text" value={newTitleEn} onChange={e => setNewTitleEn(e.target.value)}
                  placeholder={t('Auto-filled after you type the name', '填完名称后自动翻译')} className={inputCls} />
              </div>
```
描述 textarea 加 `onBlur={() => autoTranslateDesc()}`；其后加同构译文块（用 textarea，文案换描述、调 autoTranslateDesc、绑 newDescEn）。

- [ ] **Step 5: handleAdd body 加** `title_translated: newTitleEn || null, description_translated: newDescEn || null,`。成功后及 resetForm 内清空 `setNewTitleEn(''); setNewDescEn('');`。

- [ ] **Step 6: 构建验证** `cd <root> && node_modules/.bin/next build --webpack 2>&1 | grep -iE "Compiled successfully|Failed|Type error"`（exit 0）

- [ ] **Step 7: commit**
```bash
git add src/app/supplier/products/page.tsx
git commit -m "feat(supplier): 产品名称/描述失焦自动翻译(可改)+重新翻译, 提交存译文"
```

---

## Task 5: 公开页展示译文 + 端到端验收

**Files:** `src/components/materials/SupplierDetailClient.tsx`, `scripts/harness/supplier-product-translate.mjs`

- [ ] **Step 1: SupplierDetailClient Product interface 加** `title_translated: string | null; description_translated: string | null;`（line 32-39 段）

- [ ] **Step 2: 卡片展示译文优先**（line 368-369）：
```tsx
                        {(p.title_translated || p.title) && <p className="text-[15px] font-medium text-[#2c2c2c] mt-0.5 truncate">{p.title_translated || p.title}</p>}
                        {(p.description_translated || p.description) && <p className="text-xs text-[#6b6b6b] mt-0.5 line-clamp-2">{p.description_translated || p.description}</p>}
```
lightbox 标题(line 357 `products.map(x => x.title)`)可保持原文，不强制改。

- [ ] **Step 3: 端到端脚本** `scripts/harness/supplier-product-translate.mjs`（参考 supplier-product-price.mjs 的 token 签发）：
```js
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(ROOT, 'server/dist/app.js'));
const jwt = require('jsonwebtoken');
const BASE = process.env.API_BASE || 'http://localhost:3002/api';
const secret = (fs.readFileSync(path.join(ROOT,'server/.env'),'utf8').match(/^JWT_SECRET=(.*)$/m)||[])[1]?.trim() || 'dev_jwt_secret_min_32_chars_for_local_testing_only';
const token = jwt.sign({ supplierUserId: 910 }, secret); // ae → en
const H = { 'Content-Type':'application/json', Authorization:`Bearer ${token}` };
let pass=0, fail=0; const ck=(n,c,d)=>{ c?(pass++,console.log('  ✓ '+n)):(fail++,console.log('  ✗ '+n+' — '+d)); };

// UC1: translate 端点中文→英文
let r = await fetch(`${BASE}/suppliers/me/translate`,{method:'POST',headers:H,body:JSON.stringify({text:'大理石地砖'})});
let j = await r.json();
ck('translate 200', r.status===200, 'got '+r.status);
ck('返回非空译文', !!(j.translated && j.translated.trim()), JSON.stringify(j));
ck('译文是英文(ASCII,非中文)', /[a-zA-Z]/.test(j.translated||'') && !/[一-龥]/.test(j.translated||''), j.translated);

// UC2: 空 text → 空译文
r = await fetch(`${BASE}/suppliers/me/translate`,{method:'POST',headers:H,body:JSON.stringify({text:''})});
j = await r.json(); ck('空 text → 空译文', j.translated==='', JSON.stringify(j));

// UC3: addProduct 存译文
r = await fetch(`${BASE}/suppliers/me/products`,{method:'POST',headers:H,body:JSON.stringify({image_urls:['/uploads/x.jpg'],price:100,price_unit:'SQM',title:'实木门',title_translated:'Solid wood door',description:'描述',description_translated:'desc en'})});
j = await r.json();
ck('addProduct 201', r.status===201, 'got '+r.status);
ck('title_translated 落库', j.product?.title_translated==='Solid wood door', JSON.stringify(j.product));
ck('description_translated 落库', j.product?.description_translated==='desc en', JSON.stringify(j.product));
const id=j.product?.id; if(id){ const d=await fetch(`${BASE}/suppliers/me/products/${id}`,{method:'DELETE',headers:H}); ck('cleanup DELETE 200', d.status===200,'got '+d.status); }
console.log(`\nsupplier-product-translate: ${pass}/${pass+fail} PASS`);
process.exit(fail===0?0:1);
```
> 注：UC1/UC3 实调 Google，需联网；偶发网络失败时端点容错回原文，UC1「英文」断言可能失败——若 CI 无外网则跳过 UC1，但本地有外网应通过。

- [ ] **Step 4: 跑全套**
```bash
cd <root>
node --test server/dist/lib/translate.test.mjs
# 重启后端
set -a; . server/.env; set +a
lsof -i :3002 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null; sleep 1
PORT=3002 DEV_SKIP_EMAIL=true node server/dist/app.js > /tmp/tarmeer-api-3002.log 2>&1 &
sleep 5
node scripts/harness/supplier-product-translate.mjs
node scripts/harness/supplier-product-price.mjs   # 回归:价格未被破坏
node scripts/harness/smoke-test.mjs
node_modules/.bin/next build --webpack 2>&1 | grep -iE "Compiled successfully|Failed|Type error"
```
Expected: 单测通过；translate `7/7 PASS`；price `9/9 PASS`；smoke 全绿；build Compiled successfully。

- [ ] **Step 5: commit**
```bash
git add src/components/materials/SupplierDetailClient.tsx scripts/harness/supplier-product-translate.mjs
git commit -m "feat(supplier): 公开页展示产品译文(缺则原文) + 翻译端到端回归"
```

---

## 自检
- 覆盖：免费翻译✅(T1) / DB✅(T2) / 端点+存储✅(T3) / 表单可改✅(T4) / 公开展示✅(T5) / 容错✅(translate catch 回原文) / 测试✅。
- 类型一致：`title_translated`/`description_translated` 在 DB列、controller、前端 interface、公开 interface 命名统一。
- 无占位符：代码完整。Google 实调在 T5 已标注外网依赖与容错。

## 部署（用户说"部署"后）
1. `git push origin HEAD:main`
2. 后端 rsync：`autoMigrate.js` + `controllers/supplierProductController.js` + `routes/suppliers.js` + `lib/translate.js`（**4 个文件分开 rsync 到各自路径**）+ `pm2 restart tarmeer-api`。
3. 前端：服务器 `git pull && next build && pm2 restart tarmeer-next`。
4. 无头浏览器实测 + curl 验证生产 `/api/suppliers/me/translate`(需 token) 与公开详情页译文。
