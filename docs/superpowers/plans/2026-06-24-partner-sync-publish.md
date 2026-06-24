# 合作方同步 · 发布/扇出到现网（Plan 2/2）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Plan 1 入暂存层的合作方数据，经审核「发布」到现网 `supplier_profiles`/`supplier_products`，按国家扇出成各国单语言行，并配套图片多档缓存管线 + 最小 admin 审核接口，让合作方供应商和商品在站上可见。

**Architecture:** 合作方 = 无登录账号的"供应商"（`supplier_user_id=NULL`，靠 MySQL UNIQUE 允许多 NULL）。审核通过触发 publish service：对 `partner.countries[]` 每国 upsert 一行 supplier_profiles（该国语言）+ 其下 supplier_products；下架/删除则删 live 商品行。图片下载→`gen-image-variants`→落 `public/images/partner/`→替换占位图。改一处 INNER JOIN 为 LEFT JOIN 让 NULL-user 供应商可展示。

**Tech Stack:** Node CommonJS（`server/dist/`），mysql2/promise，Node `https/fs`，`scripts/gen-image-variants.mjs`（sharp），admin `requirePermission('can_approve')` 中间件。

---

## 环境与前置

- 实现 + 运行均在 Code checkout `/Users/kp/Code/tarmeer-4.0-local`，分支从 `feat/partner-sync-ingestion` 续建 `feat/partner-sync-publish`（Plan 1 已在前者）。
- 本地 MySQL `mysql -u root -proot123 tarmeer`；Plan 1 的 4 张 `partner_*` 表与 `/api/partner-sync` 已就绪。
- 后端起停：`lsof -i :3002 | grep LISTEN | awk '{print $2}' | xargs kill; PORT=3002 DEV_SKIP_EMAIL=true node server/dist/app.js > /tmp/tarmeer-api-3002.log 2>&1 &`
- 关联：Spec `接口/docs/superpowers/specs/2026-06-24-partner-sync-api-design.md` §6.5 是本计划地基。

## 已查实的现网约束（写代码依据）

- 供应商公开可见 = `status='approved'` AND `is_published=1`。
- **主详情查询 INNER JOIN supplier_users**（`supplierProfileController.js`，取 `su.email AS user_email`、`su.full_name`）→ NULL-user 行被排除，必须改 LEFT JOIN。其余 catalog/product/project 查询是 `WHERE slug=? AND status='approved'` 不 JOIN 用户，无需改。
- `supplier_profiles` 必填 `company_name`/`slug`(UNIQUE)；有列 `description/contact_phone/website/whatsapp/store_address/cover_image_url/categories/origin('china'|'dubai')`。
- `supplier_products.image_url` NOT NULL 无默认 → 用占位图。其余 title/description/category/sort_order/image_urls 可空。
- 现成 `slugify`（在 supplierProfileController，未导出，本计划在 publish service 内复制同款）。
- admin 写接口鉴权：`(0, adminAuth_1.requirePermission)('can_approve')`。

## 文件结构

- Create `server/dist/db/partner-publish-schema.sql` — ALTER 现网表 + 占位图说明。
- Create `server/dist/lib/partnerPublishService.js` — slugify/pickText/ensureSupplier/publishProduct/publishCompany/unpublish。
- Create `server/dist/lib/partnerImageService.js` — 下载 URL → gen-image-variants → 返回路径。
- Create `server/dist/controllers/partnerAdminController.js` — approve/reject 列表 handler。
- Modify `server/dist/routes/admin.js` — 注册 partner-sync admin 路由。
- Modify `server/dist/controllers/supplierProfileController.js` — INNER→LEFT JOIN。
- Create placeholder 图片资产（脚本生成）。
- Create `scripts/harness/partner-sync-publish-walkthrough.mjs` — 发布验收。

---

### Task 1: 现网表结构改动（可空 user + source 标记）

**Files:**
- Create: `server/dist/db/partner-publish-schema.sql`

- [ ] **Step 1: 写 ALTER DDL**

`server/dist/db/partner-publish-schema.sql`:
```sql
-- 合作方发布层：让 supplier 表容纳无账号的合作方数据。可重复执行需谨慎（ALTER 非幂等，下方用存在性判断）。
ALTER TABLE supplier_profiles MODIFY COLUMN supplier_user_id INT NULL;
ALTER TABLE supplier_profiles ADD COLUMN source ENUM('manual','partner') NOT NULL DEFAULT 'manual';
ALTER TABLE supplier_profiles ADD COLUMN partner_id INT NULL;
ALTER TABLE supplier_products ADD COLUMN source ENUM('manual','partner') NOT NULL DEFAULT 'manual';
ALTER TABLE supplier_products ADD COLUMN partner_external_id VARCHAR(128) NULL;
CREATE INDEX idx_sp_partner ON supplier_profiles (source, partner_id, country);
CREATE INDEX idx_sprod_partner ON supplier_products (source, partner_external_id);
```

- [ ] **Step 2: 应用（ADD COLUMN 若已存在会报错，先查再跑）**

Run:
```bash
mysql -u root -proot123 tarmeer -N -e "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='tarmeer' AND TABLE_NAME='supplier_profiles' AND COLUMN_NAME='source';"
# 若返回 0，则执行：
mysql -u root -proot123 tarmeer < server/dist/db/partner-publish-schema.sql
```
Expected: 首次返回 0，应用后无报错。

- [ ] **Step 3: 验证**

Run:
```bash
mysql -u root -proot123 tarmeer -N -e "SELECT COLUMN_NAME, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='tarmeer' AND TABLE_NAME='supplier_profiles' AND COLUMN_NAME IN ('supplier_user_id','source','partner_id');"
```
Expected: `supplier_user_id YES`、`source NO`、`partner_id YES`。

- [ ] **Step 4: 确认现有供应商不受影响**

Run:
```bash
mysql -u root -proot123 tarmeer -N -e "SELECT COUNT(*) FROM supplier_profiles WHERE source='manual';"
```
Expected: 44（全部存量行默认 source='manual'）。

- [ ] **Step 5: Commit**
```bash
cd /Users/kp/Code/tarmeer-4.0-local
git checkout -b feat/partner-sync-publish 2>/dev/null || git checkout feat/partner-sync-publish
git add server/dist/db/partner-publish-schema.sql
git commit -m "feat(partner-publish): supplier 表加 source/partner_id，supplier_user_id 改可空"
```

---

### Task 2: 公开详情查询兼容 NULL-user（INNER→LEFT JOIN）

**Files:**
- Modify: `server/dist/controllers/supplierProfileController.js`

- [ ] **Step 1: 定位并改 JOIN**

在 `supplierProfileController.js` 找到（公开详情/列表查询）：
```js
        FROM supplier_profiles sp
        JOIN supplier_users su ON su.id = sp.supplier_user_id
```
改为：
```js
        FROM supplier_profiles sp
        LEFT JOIN supplier_users su ON su.id = sp.supplier_user_id
```
（`SELECT sp.*, su.email as user_email` 保持不变；合作方行 `user_email` 为 NULL，前端/响应已是可选字段。）

- [ ] **Step 2: grep 确认是否还有其它 INNER JOIN supplier_users 漏改**

Run:
```bash
grep -rn "JOIN supplier_users" server/dist/controllers/ | grep -v "LEFT JOIN"
```
Expected: 仅剩按 `supplier_user_id=?`(供应商自己后台，需要用户) 的查询；公开（按 slug/列表）的都应是 LEFT JOIN。若发现其它公开查询是 INNER，一并改 LEFT（在报告里列出改了哪些行）。

- [ ] **Step 3: 重启 + 验证现有供应商详情仍正常**

Run:
```bash
lsof -i :3002 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null; sleep 1
PORT=3002 DEV_SKIP_EMAIL=true node server/dist/app.js > /tmp/tarmeer-api-3002.log 2>&1 &
sleep 2
SLUG=$(mysql -u root -proot123 tarmeer -N -e "SELECT slug FROM supplier_profiles WHERE status='approved' AND is_published=1 LIMIT 1;")
curl -s --noproxy '*' -o /dev/null -w "%{http_code}\n" "http://localhost:3002/api/suppliers/$SLUG"
```
Expected: 200（现有真实供应商详情未被破坏）。注意实际路由前缀以 `routes/suppliers.js` 为准，若非 `/api/suppliers/:slug` 用正确路径。

- [ ] **Step 4: Commit**
```bash
git add server/dist/controllers/supplierProfileController.js
git commit -m "fix(partner-publish): 供应商详情查询 INNER→LEFT JOIN supplier_users（容纳无账号合作方供应商）"
```

---

### Task 3: 占位图资产

**Files:**
- Create: `public/images/partner/placeholder.webp`（+ 变体）

- [ ] **Step 1: 生成一张中性占位图并跑变体**

Run（用 sharp 直接造一张 1200×900 浅灰占位，再过多档缓存脚本）:
```bash
cd /Users/kp/Code/tarmeer-4.0-local
node -e "const sharp=require('./node_modules/sharp');sharp({create:{width:1200,height:900,channels:3,background:{r:238,g:236,b:233}}}).png().toFile('/tmp/partner-placeholder.png').then(()=>console.log('ok'))"
node scripts/gen-image-variants.mjs '/tmp/partner-placeholder.png::public/images/partner/placeholder'
```
Expected: 生成 `public/images/partner/placeholder{,-blur,-thumb,-medium}.webp`，权限 644。

- [ ] **Step 2: 验证**
```bash
ls -l public/images/partner/placeholder*.webp
```
Expected: 4 个 webp 文件，权限 `-rw-r--r--`。

- [ ] **Step 3: Commit**
```bash
git add public/images/partner/placeholder*.webp
git commit -m "feat(partner-publish): 合作方商品占位图（4 档 webp）"
```

---

### Task 4: 发布/扇出 service

**Files:**
- Create: `server/dist/lib/partnerPublishService.js`

- [ ] **Step 1: 写 service**

`server/dist/lib/partnerPublishService.js`:
```js
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool = require("../config/database").default;

const PLACEHOLDER = "/images/partner/placeholder.webp";
const LANG_BY_COUNTRY = { ae: "en", vn: "vi", sa: "ar" };

function slugify(name) {
  return String(name || "").toLowerCase().trim()
    .replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
// 从「语言→值」对象取该国文案，缺则回退 default_lang，再回退任意非空
function pickText(map, lang, defLang) {
  if (map == null) return null;
  if (typeof map === "string") return map;
  if (typeof map !== "object") return null;
  if (map[lang]) return map[lang];
  if (map[defLang]) return map[defLang];
  const any = Object.values(map).find((v) => typeof v === "string" && v.trim());
  return any || null;
}
function pickArray(map, lang, defLang) {
  if (!map) return [];
  if (Array.isArray(map)) return map;
  return map[lang] || map[defLang] || [];
}
function countriesOf(partner) {
  try { const c = JSON.parse(partner.countries_json || "[]"); return Array.isArray(c) ? c : []; }
  catch { return []; }
}

// 确保 (partner, country) 有一行 supplier_profiles；company 为可选的最新企业 payload
async function ensurePartnerSupplier(partner, country, company) {
  const lang = LANG_BY_COUNTRY[country] || partner.default_lang || "en";
  const defLang = partner.default_lang || "en";
  const name = (company && pickText(company.company_name, lang, defLang)) || `Partner ${partner.id}`;
  const desc = company ? pickText(company.description, lang, defLang) : null;
  const addr = company ? pickText(company.store_address, lang, defLang) : null;
  const phone = company?.contact_phone || null;
  const website = company?.website || null;
  const whatsapp = company?.whatsapp || null;
  const [existing] = await pool.execute(
    "SELECT id FROM supplier_profiles WHERE source='partner' AND partner_id=? AND country=? LIMIT 1",
    [partner.id, country]);
  if (existing[0]) {
    await pool.execute(
      "UPDATE supplier_profiles SET company_name=?, description=COALESCE(?,description), store_address=COALESCE(?,store_address), contact_phone=COALESCE(?,contact_phone), website=COALESCE(?,website), whatsapp=COALESCE(?,whatsapp), status='approved', is_published=1 WHERE id=?",
      [name, desc, addr, phone, website, whatsapp, existing[0].id]);
    return existing[0].id;
  }
  // 唯一 slug：base-country-p<partnerId>，撞则追加时间戳尾巴
  let slug = `${slugify(name) || "partner-" + partner.id}-${country}-p${partner.id}`;
  const [clash] = await pool.execute("SELECT id FROM supplier_profiles WHERE slug=? LIMIT 1", [slug]);
  if (clash[0]) slug = `${slug}-${Date.now() % 100000}`;
  const [r] = await pool.execute(
    "INSERT INTO supplier_profiles (supplier_user_id, company_name, slug, description, store_address, contact_phone, website, whatsapp, country, origin, source, partner_id, status, is_published) VALUES (NULL,?,?,?,?,?,?,?,?, 'china', 'partner', ?, 'approved', 1)",
    [name, slug, desc, addr, phone, website, whatsapp, country, partner.id]);
  return r.insertId;
}

// 发布一条商品暂存行到所有国家（扇出）。imageResolver(urls)→Promise<string|null> 可选，失败用占位图。
async function publishProduct(partner, stagingRow, imageResolver) {
  const item = typeof stagingRow.payload_json === "string" ? JSON.parse(stagingRow.payload_json) : stagingRow.payload_json;
  const defLang = partner.default_lang || "en";
  const removed = stagingRow.listing_status === "inactive" || stagingRow.is_deleted === 1 || stagingRow.is_deleted === true;
  let imageUrl = PLACEHOLDER;
  if (!removed && imageResolver && Array.isArray(item.images) && item.images.length) {
    try { const u = await imageResolver(item.images, stagingRow.external_id); if (u) imageUrl = u; }
    catch (e) { console.error("[partner-publish] image resolve failed", stagingRow.external_id, e.message); }
  }
  for (const country of countriesOf(partner)) {
    const lang = LANG_BY_COUNTRY[country] || defLang;
    const supplierId = await ensurePartnerSupplier(partner, country, null);
    const [exist] = await pool.execute(
      "SELECT id FROM supplier_products WHERE supplier_profile_id=? AND source='partner' AND partner_external_id=? LIMIT 1",
      [supplierId, stagingRow.external_id]);
    if (removed) {
      if (exist[0]) await pool.execute("DELETE FROM supplier_products WHERE id=?", [exist[0].id]);
      continue;
    }
    const title = pickText(item.title, lang, defLang);
    const desc = pickText(item.description, lang, defLang);
    const catPath = pickArray(item.category_path, lang, defLang);
    const category = catPath.length ? catPath[catPath.length - 1] : (item.category || null);
    const imageUrls = JSON.stringify([imageUrl]);
    if (exist[0]) {
      await pool.execute(
        "UPDATE supplier_products SET title=?, description=?, category=?, image_url=?, image_urls=?, sort_order=? WHERE id=?",
        [title, desc, category, imageUrl, imageUrls, item.sort_order || 0, exist[0].id]);
    } else {
      await pool.execute(
        "INSERT INTO supplier_products (supplier_profile_id, title, description, category, image_url, image_urls, sort_order, source, partner_external_id) VALUES (?,?,?,?,?,?,?, 'partner', ?)",
        [supplierId, title, desc, category, imageUrl, imageUrls, item.sort_order || 0, stagingRow.external_id]);
    }
  }
}

// 撤下（reject）：删该商品所有国家 live 行
async function unpublishProduct(partner, externalId) {
  const [rows] = await pool.execute(
    "SELECT id FROM supplier_profiles WHERE source='partner' AND partner_id=?", [partner.id]);
  for (const sp of rows) {
    await pool.execute(
      "DELETE FROM supplier_products WHERE supplier_profile_id=? AND source='partner' AND partner_external_id=?",
      [sp.id, externalId]);
  }
}

// 发布企业：更新该 partner 所有国家 supplier_profiles 的企业字段
async function publishCompany(partner, companyPayload) {
  for (const country of countriesOf(partner)) {
    await ensurePartnerSupplier(partner, country, companyPayload);
  }
}

module.exports = { slugify, pickText, pickArray, countriesOf, ensurePartnerSupplier, publishProduct, unpublishProduct, publishCompany, PLACEHOLDER };
```

- [ ] **Step 2: 语法检查**

Run: `node -c server/dist/lib/partnerPublishService.js`
Expected: 无输出 exit 0。

- [ ] **Step 3: Commit**
```bash
git add server/dist/lib/partnerPublishService.js
git commit -m "feat(partner-publish): 发布/扇出 service（按国家 upsert supplier_profiles+products，下架删行）"
```

---

### Task 5: 图片下载→多档缓存 service

**Files:**
- Create: `server/dist/lib/partnerImageService.js`

- [ ] **Step 1: 写 service**

`server/dist/lib/partnerImageService.js`:
```js
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");
const http = require("http");
const { execFile } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", ".."); // server/dist/lib → 项目根
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);
    const req = lib.get(url, (res) => {
      if (res.statusCode !== 200) { file.close(); fs.unlink(dest, () => {}); return reject(new Error(`HTTP ${res.statusCode}`)); }
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve(dest)));
    });
    req.on("error", (e) => { file.close(); fs.unlink(dest, () => {}); reject(e); });
    req.setTimeout(15000, () => req.destroy(new Error("timeout")));
  });
}

function genVariants(srcAbs, outRel) {
  return new Promise((resolve, reject) => {
    execFile("node", [path.join(PROJECT_ROOT, "scripts", "gen-image-variants.mjs"), `${srcAbs}::${outRel}`],
      { cwd: PROJECT_ROOT }, (err, stdout, stderr) => err ? reject(new Error(stderr || err.message)) : resolve(stdout));
  });
}

// 处理一组图片 URL：下载第一张 → 多档缓存 → 返回 -medium webp 的站点路径（失败抛错，调用方兜底占位图）
async function resolveFirstImage(urls, externalId) {
  const url = urls.find((u) => typeof u === "string" && /^https?:\/\//.test(u));
  if (!url) throw new Error("no http(s) image url");
  const safeExt = String(externalId).replace(/[^\w-]/g, "_");
  const tmp = path.join(os.tmpdir(), `partner-${safeExt}-${Date.now()}.img`);
  await download(url, tmp);
  const outRel = `public/images/partner/items/${safeExt}/cover`;
  await genVariants(tmp, outRel);
  fs.unlink(tmp, () => {});
  return `/images/partner/items/${safeExt}/cover-medium.webp`;
}

module.exports = { download, genVariants, resolveFirstImage };
```

- [ ] **Step 2: 语法检查 + 单测下载+变体（用本地起的 HTTP 文件服务避免外网依赖）**

Run:
```bash
node -c server/dist/lib/partnerImageService.js
# 用占位图当源，起个本地静态服务，验证下载+变体
node -e "const http=require('http'),fs=require('fs');const s=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'image/webp'});fs.createReadStream('public/images/partner/placeholder.webp').pipe(r)}).listen(8099,async()=>{const svc=require('./server/dist/lib/partnerImageService');try{const p=await svc.resolveFirstImage(['http://localhost:8099/x.webp'],'TEST-IMG');console.log('result',p);console.log('exists',fs.existsSync('public'+p))}catch(e){console.log('ERR',e.message)}finally{s.close()}})"
```
Expected: 打印 `result /images/partner/items/TEST-IMG/cover-medium.webp` 且 `exists true`。

- [ ] **Step 3: 清理测试产物 + Commit**
```bash
rm -rf public/images/partner/items/TEST-IMG
git add server/dist/lib/partnerImageService.js
git commit -m "feat(partner-publish): 图片下载→gen-image-variants 多档缓存 service"
```

> 部署注意（写入报告，勿在本地执行）：上线后 `public/images/partner/` 需 rsync 到 portal 目录 `root@47.91.108.104:/tarmeer/tarmeer_web_portal/images/partner/`，否则线上 404（见 AGENTS.md 图片铁律）。

---

### Task 6: 最小 admin 审核接口（approve/reject + 列表）

**Files:**
- Create: `server/dist/controllers/partnerAdminController.js`
- Modify: `server/dist/routes/admin.js`

- [ ] **Step 1: 写 controller**

`server/dist/controllers/partnerAdminController.js`:
```js
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool = require("../config/database").default;
const publish = require("../lib/partnerPublishService");
const images = require("../lib/partnerImageService");

async function loadPartner(partnerId) {
  const [rows] = await pool.execute("SELECT * FROM partner_accounts WHERE id=?", [partnerId]);
  return rows[0] || null;
}

// GET /api/admin/partner-sync/products?status=pending
async function listPendingProducts(req, res) {
  try {
    const status = req.query.status || "pending";
    const [rows] = await pool.execute(
      "SELECT id, partner_id, external_id, review_status, listing_status, is_deleted, synced_at FROM partner_sync_products WHERE review_status=? ORDER BY synced_at DESC LIMIT 200",
      [status]);
    res.json({ items: rows });
  } catch (e) { console.error("[partner-admin] list error", e); res.status(500).json({ error: "internal error" }); }
}

// POST /api/admin/partner-sync/products/:id/approve
async function approveProduct(req, res) {
  try {
    const [rows] = await pool.execute("SELECT * FROM partner_sync_products WHERE id=?", [req.params.id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: "not found" });
    const partner = await loadPartner(row.partner_id);
    if (!partner) return res.status(400).json({ error: "partner missing" });
    await publish.publishProduct(partner, row, images.resolveFirstImage);
    await pool.execute("UPDATE partner_sync_products SET review_status='approved', reviewed_at=NOW() WHERE id=?", [row.id]);
    res.json({ ok: true, review_status: "approved" });
  } catch (e) { console.error("[partner-admin] approve error", e); res.status(500).json({ error: "internal error" }); }
}

// POST /api/admin/partner-sync/products/:id/reject
async function rejectProduct(req, res) {
  try {
    const [rows] = await pool.execute("SELECT * FROM partner_sync_products WHERE id=?", [req.params.id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: "not found" });
    const partner = await loadPartner(row.partner_id);
    if (partner) await publish.unpublishProduct(partner, row.external_id);
    await pool.execute("UPDATE partner_sync_products SET review_status='rejected', reviewed_at=NOW() WHERE id=?", [row.id]);
    res.json({ ok: true, review_status: "rejected" });
  } catch (e) { console.error("[partner-admin] reject error", e); res.status(500).json({ error: "internal error" }); }
}

// POST /api/admin/partner-sync/companies/:id/approve
async function approveCompany(req, res) {
  try {
    const [rows] = await pool.execute("SELECT * FROM partner_sync_companies WHERE id=?", [req.params.id]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: "not found" });
    const partner = await loadPartner(row.partner_id);
    if (!partner) return res.status(400).json({ error: "partner missing" });
    const company = typeof row.payload_json === "string" ? JSON.parse(row.payload_json) : row.payload_json;
    await publish.publishCompany(partner, company);
    await pool.execute("UPDATE partner_sync_companies SET review_status='approved', reviewed_at=NOW() WHERE id=?", [row.id]);
    res.json({ ok: true, review_status: "approved" });
  } catch (e) { console.error("[partner-admin] approve company error", e); res.status(500).json({ error: "internal error" }); }
}

module.exports = { listPendingProducts, approveProduct, rejectProduct, approveCompany };
```

- [ ] **Step 2: 注册路由**

在 `server/dist/routes/admin.js` 顶部 require 区加：
```js
const partnerAdminController_1 = require("../controllers/partnerAdminController");
```
在其它受保护路由附近（紧跟某个 `requirePermission('can_approve')` 路由后）加：
```js
router.get('/partner-sync/products', (0, adminAuth_1.requirePermission)('can_approve'), partnerAdminController_1.listPendingProducts);
router.post('/partner-sync/products/:id/approve', (0, adminAuth_1.requirePermission)('can_approve'), partnerAdminController_1.approveProduct);
router.post('/partner-sync/products/:id/reject', (0, adminAuth_1.requirePermission)('can_approve'), partnerAdminController_1.rejectProduct);
router.post('/partner-sync/companies/:id/approve', (0, adminAuth_1.requirePermission)('can_approve'), partnerAdminController_1.approveCompany);
```
（确认 `adminAuth_1` 已在文件中被 require；若名字不同，按文件实际的 requirePermission 引入名来用。）

- [ ] **Step 3: 重启 + 验证未授权 401**
```bash
lsof -i :3002 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null; sleep 1
PORT=3002 DEV_SKIP_EMAIL=true node server/dist/app.js > /tmp/tarmeer-api-3002.log 2>&1 &
sleep 2
curl -s --noproxy '*' -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3002/api/admin/partner-sync/products/1/approve
grep -i error /tmp/tarmeer-api-3002.log | head
```
Expected: 401（无 admin token），日志无启动错误。

- [ ] **Step 4: Commit**
```bash
git add server/dist/controllers/partnerAdminController.js server/dist/routes/admin.js
git commit -m "feat(partner-publish): admin 审核接口（approve/reject 商品+approve 企业，触发扇出）"
```

---

### Task 7: 发布验收 harness

**Files:**
- Create: `scripts/harness/partner-sync-publish-walkthrough.mjs`

- [ ] **Step 1: 写 harness**

`scripts/harness/partner-sync-publish-walkthrough.mjs`:
```js
#!/usr/bin/env node
/**
 * 合作方发布/扇出验收。前提：后端 3002 起；partner_* 与 supplier 表改动已就绪；
 * admin 测试号 harness-test@tarmeer.local / Harness#Local123。
 */
import { execSync } from "child_process";
import crypto from "crypto";

const API = "http://localhost:3002/api";
const KEY = "harness-pub-key", SECRET = "harness-pub-secret";
const TS = Date.now(), MARK = `pub${TS}`;
let pass = 0, fail = 0;
const ok = (l) => { console.log(`  \x1b[32m✓\x1b[0m ${l}`); pass++; };
const ng = (l, d) => { console.log(`  \x1b[31m✗\x1b[0m ${l}${d ? " — " + d : ""}`); fail++; };
const sql = (q) => execSync(`mysql -u root -proot123 tarmeer -N -e ${JSON.stringify(q)} 2>/dev/null`, { encoding: "utf8" }).trim();

sql("DELETE FROM partner_accounts WHERE partner_key='" + KEY + "'");
sql(`INSERT INTO partner_accounts (partner_key, secret, countries_json, default_lang) VALUES ('${KEY}','${SECRET}','[\\"ae\\",\\"vn\\"]','en')`);
const PID = sql("SELECT id FROM partner_accounts WHERE partner_key='" + KEY + "'");
const cleanup = () => {
  const sids = sql(`SELECT id FROM supplier_profiles WHERE source='partner' AND partner_id=${PID}`).split(/\s+/).filter(Boolean);
  for (const sid of sids) sql(`DELETE FROM supplier_products WHERE supplier_profile_id=${sid}`);
  sql(`DELETE FROM supplier_profiles WHERE source='partner' AND partner_id=${PID}`);
  sql(`DELETE FROM partner_sync_products WHERE partner_id=${PID}`);
  sql(`DELETE FROM partner_sync_requests WHERE partner_id=${PID}`);
  sql(`DELETE FROM partner_accounts WHERE id=${PID}`);
};

async function sync(method, path, body) {
  const raw = body ? JSON.stringify(body) : "";
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac("sha256", SECRET).update(`${ts}\n${raw}`).digest("hex");
  const res = await fetch(`${API}/partner-sync${path}`, { method, headers: { "Content-Type": "application/json", "X-Partner-Key": KEY, "X-Timestamp": ts, "X-Signature": sig }, body: body ? raw : undefined });
  let j = null; try { j = await res.json(); } catch {} return { status: res.status, body: j };
}
async function adminToken() {
  const r = await fetch(`${API}/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "harness-test@tarmeer.local", password: "Harness#Local123" }) });
  const j = await r.json(); return j.token || j.accessToken;
}
async function admin(method, path, token) {
  const r = await fetch(`${API}/admin${path}`, { method, headers: { Authorization: `Bearer ${token}` } });
  let j = null; try { j = await r.json(); } catch {} return { status: r.status, body: j };
}

try {
  console.log("合作方发布/扇出 walkthrough\n");
  const token = await adminToken();
  if (!token) { ng("无法取得 admin token"); throw new Error("no admin token"); }

  // 推一条多语言商品（含企业）
  await sync("POST", "/company", { version: "1", request_id: `${MARK}-co`, default_lang: "en",
    company: { company_name: { en: "Acme Wholesale", vi: "Acme Si" }, description: { en: "d", vi: "d-vi" } } });
  await sync("POST", "/products/create", { version: "1", request_id: `${MARK}-p`, default_lang: "en",
    items: [{ external_id: `${MARK}-sku1`, status: "active", title: { en: "Blue Rope", vi: "Day Xanh" }, images: [] }] });
  const stagingId = sql(`SELECT id FROM partner_sync_products WHERE partner_id=${PID} AND external_id='${MARK}-sku1'`);
  const companyStagingId = sql(`SELECT id FROM partner_sync_companies WHERE partner_id=${PID}`);

  // 审核前：不可见（无 live 供应商/商品）
  const before = sql(`SELECT COUNT(*) FROM supplier_profiles WHERE source='partner' AND partner_id=${PID}`);
  before === "0" ? ok("UC1 审核前无 live 供应商") : ng("UC1 审核前应无 live", `got ${before}`);

  // 审核通过企业 + 商品 → 扇出
  await admin("POST", `/partner-sync/companies/${companyStagingId}/approve`, token);
  const ap = await admin("POST", `/partner-sync/products/${stagingId}/approve`, token);
  ap.status === 200 ? ok("UC2 审核商品返回 200") : ng("UC2 审核失败", `status ${ap.status}`);

  // 扇出：AE + VN 各一行供应商
  const supCnt = sql(`SELECT COUNT(*) FROM supplier_profiles WHERE source='partner' AND partner_id=${PID}`);
  supCnt === "2" ? ok("UC3 扇出成 AE+VN 两个供应商") : ng("UC3 供应商行数应为2", `got ${supCnt}`);

  // 语言正确：AE 行英文、VN 行越南语（供应商名 + 商品标题）
  const aeName = sql(`SELECT company_name FROM supplier_profiles WHERE source='partner' AND partner_id=${PID} AND country='ae'`);
  const vnName = sql(`SELECT company_name FROM supplier_profiles WHERE source='partner' AND partner_id=${PID} AND country='vn'`);
  aeName === "Acme Wholesale" && vnName === "Acme Si" ? ok("UC4 供应商名按国家取对语言") : ng("UC4 语言错", `ae=${aeName} vn=${vnName}`);

  const aeTitle = sql(`SELECT p.title FROM supplier_products p JOIN supplier_profiles s ON s.id=p.supplier_profile_id WHERE s.partner_id=${PID} AND s.country='ae' AND p.partner_external_id='${MARK}-sku1'`);
  const vnTitle = sql(`SELECT p.title FROM supplier_products p JOIN supplier_profiles s ON s.id=p.supplier_profile_id WHERE s.partner_id=${PID} AND s.country='vn' AND p.partner_external_id='${MARK}-sku1'`);
  aeTitle === "Blue Rope" && vnTitle === "Day Xanh" ? ok("UC5 商品标题按国家取对语言，不串语言") : ng("UC5 商品语言错", `ae=${aeTitle} vn=${vnTitle}`);

  // 无图 → 占位图
  const img = sql(`SELECT image_url FROM supplier_products p JOIN supplier_profiles s ON s.id=p.supplier_profile_id WHERE s.partner_id=${PID} AND s.country='ae' AND p.partner_external_id='${MARK}-sku1'`);
  img === "/images/partner/placeholder.webp" ? ok("UC6 无图商品用占位图") : ng("UC6 占位图错", `img=${img}`);

  // 公开可见：供应商 status=approved + is_published=1
  const vis = sql(`SELECT COUNT(*) FROM supplier_profiles WHERE source='partner' AND partner_id=${PID} AND status='approved' AND is_published=1`);
  vis === "2" ? ok("UC7 供应商 approved+published 可见") : ng("UC7 可见性错", `got ${vis}`);

  // 下架：推 status=inactive → 重新审核 → live 商品行被删
  await sync("POST", "/products/update", { version: "1", request_id: `${MARK}-off`, default_lang: "en",
    items: [{ external_id: `${MARK}-sku1`, status: "inactive", title: { en: "Blue Rope" } }] });
  await admin("POST", `/partner-sync/products/${stagingId}/approve`, token);
  const liveAfterOff = sql(`SELECT COUNT(*) FROM supplier_products p JOIN supplier_profiles s ON s.id=p.supplier_profile_id WHERE s.partner_id=${PID} AND p.partner_external_id='${MARK}-sku1'`);
  liveAfterOff === "0" ? ok("UC8 下架后 live 商品行被删（供应商仍在）") : ng("UC8 下架未删行", `got ${liveAfterOff}`);

  // reject：重新上架后 reject → 撤下
  await sync("POST", "/products/update", { version: "1", request_id: `${MARK}-on`, default_lang: "en",
    items: [{ external_id: `${MARK}-sku1`, status: "active", title: { en: "Blue Rope" } }] });
  await admin("POST", `/partner-sync/products/${stagingId}/approve`, token);
  const liveOn = sql(`SELECT COUNT(*) FROM supplier_products p JOIN supplier_profiles s ON s.id=p.supplier_profile_id WHERE s.partner_id=${PID} AND p.partner_external_id='${MARK}-sku1'`);
  await admin("POST", `/partner-sync/products/${stagingId}/reject`, token);
  const liveRej = sql(`SELECT COUNT(*) FROM supplier_products p JOIN supplier_profiles s ON s.id=p.supplier_profile_id WHERE s.partner_id=${PID} AND p.partner_external_id='${MARK}-sku1'`);
  liveOn === "2" && liveRej === "0" ? ok("UC9 reject 撤下所有国家 live 行") : ng("UC9 reject 错", `on=${liveOn} rej=${liveRej}`);

  console.log(`\n${pass} passed, ${fail} failed`);
} finally { cleanup(); }
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: 重启后端，跑 harness**
```bash
lsof -i :3002 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null; sleep 1
PORT=3002 DEV_SKIP_EMAIL=true node server/dist/app.js > /tmp/tarmeer-api-3002.log 2>&1 &
sleep 2
node scripts/harness/partner-sync-publish-walkthrough.mjs
```
Expected: `9 passed, 0 failed`，exit 0。失败则查 controller/service/SQL，修到全绿（不得弱化断言）。

- [ ] **Step 3: 回归——Plan 1 入库 harness + smoke 仍绿**
```bash
node scripts/harness/partner-sync-walkthrough.mjs ; echo "ingest exit: $?"
node scripts/harness/smoke-test.mjs ; echo "smoke exit: $?"
```
Expected: 入库 9/9；smoke 全绿（动了 supplierProfileController，确认未破坏现有供应商）。

- [ ] **Step 4: Commit**
```bash
git add scripts/harness/partner-sync-publish-walkthrough.mjs
git commit -m "test(partner-publish): 发布/扇出 walkthrough 9 用例（扇出/语言/占位图/可见/下架/reject）"
```

---

## Self-Review（计划自检）

**Spec §6.5 覆盖：**
- supplier_user_id 可空 + source/partner_id → Task 1 ✓
- NULL-user 公开展示（LEFT JOIN）→ Task 2 ✓
- 每 (partner,country) 一行 supplier_profiles + slug 生成 → Task 4 ensurePartnerSupplier ✓
- 商品扇出 upsert 键 (supplier_profile_id, partner_external_id) → Task 4 publishProduct ✓
- 状态映射（approved 发布 / inactive·deleted 删行 / reject 撤下）→ Task 4 + Task 6 + UC8/UC9 ✓
- 占位图 + 图片管线 → Task 3 + Task 5 + UC6 ✓
- 最小 admin approve/reject → Task 6 ✓
- 不串语言（AE 英文/VN 越南语）→ UC4/UC5 ✓

**占位符扫描：** 无 TBD；每步含完整代码/命令/预期。

**类型/命名一致：** `pickText/pickArray/ensurePartnerSupplier/publishProduct/unpublishProduct/publishCompany/resolveFirstImage` 在 Task 4/5 定义，Task 6 controller 调用一致；harness 字段（country/company_name/title/image_url/partner_external_id）与 service 写入一致。

**已知取舍/风险：**
- ALTER 非幂等：Task 1 Step 2 先查 `source` 列是否存在再决定是否执行，避免重复报错。
- 改 supplierProfileController 是动现网查询：Task 2 用 grep 兜底找全部 INNER JOIN，并以"现有供应商详情 200"回归验证。
- 图片处理需要能访问对方图片 URL（对方加白名单）；本地 harness 用 localhost 静态服务验证管线本身，不依赖外网。
- 部署时 `public/images/partner/` 必须 rsync 到 portal（Task 5 注记），否则线上图 404。
- `mapped_product_id` 不再使用（多国多行无法单值映射），live 行靠 `source+partner_external_id` 定位。
