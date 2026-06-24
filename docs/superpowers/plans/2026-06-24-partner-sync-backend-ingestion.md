# 合作方同步 · 后端入库（Plan 1/3）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现合作方商品/企业同步的「接收 + 入暂存层」后端：HMAC 鉴权、按 `external_id` 幂等 upsert、`request_id` 去重、上下架状态、对账软删除、多语言母本存储，并以 harness 全绿验收。

**Architecture:** 在现有 Express 后端（CommonJS，直接写 `server/dist/*.js`，无 TS 源）新增 `/api/partner-sync/*` 路由。本计划只写到「暂存表」为止 —— 不碰现网展示表（`supplier_products` 依赖登录供应商用户，扇出/发布留给 Plan 2）。暂存层完全自包含，可用 harness 直接断言。

**Tech Stack:** Node CommonJS、Express、mysql2/promise（`server/dist/config/database.js` 的 pool）、crypto HMAC-SHA256、本地 MySQL（`tarmeer` 库）。

---

## 环境与前置（Prerequisites）

- **实现 + 运行均在 Code checkout：** `/Users/kp/Code/tarmeer-4.0-local`（有 `server/node_modules`、`server/.env` `DB_HOST=localhost`、本地 MySQL）。orca `接口/` 工作树只有 `server/dist`，跑不起后端。
- 本地 MySQL：`mysql -u root -proot123 tarmeer`。
- 后端起停（改 `server/dist` 后必须重启 3002）：
  ```bash
  lsof -i :3002 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null; sleep 1
  PORT=3002 DEV_SKIP_EMAIL=true node /Users/kp/Code/tarmeer-4.0-local/server/dist/app.js > /tmp/tarmeer-api-3002.log 2>&1 &
  ```
- 关联 Spec：`接口/docs/superpowers/specs/2026-06-24-partner-sync-api-design.md`。对接文档：`接口/docs/partner-sync/合作方商品同步对接文档.md`。
- 路径约定：下文 `server/...`、`scripts/...` 均为仓库相对路径，落在 Code checkout 下。

## 范围（Scope，3 份子计划）

- **Plan 1（本计划）：接收 + 入暂存层 + harness。** 自包含、可独立验收。
- Plan 2：审核发布 → 按 `countries[]` 扇出到现网展示表（解决 `supplier_profiles.supplier_user_id` 耦合）+ 图片多档缓存管线。
- Plan 3：admin 审核 UI。

## 文件结构

- Create `server/dist/db/partner-sync-schema.sql` — 4 张新表 DDL（仅暂存层，不 ALTER 现网表）。
- Create `server/dist/lib/partnerSyncSignature.js` — HMAC 签名/验签（per-partner secret）。
- Create `server/dist/controllers/partnerSyncController.js` — 鉴权中间件 + 5 个 handler。
- Create `server/dist/routes/partnerSync.js` — 路由。
- Modify `server/dist/app.js` — 挂载 `/api/partner-sync`。
- Create `scripts/harness/partner-sync-walkthrough.mjs` — 验收 harness（自建测试 partner、跑 8 用例、清理）。

---

### Task 1: 暂存层数据库 schema

**Files:**
- Create: `server/dist/db/partner-sync-schema.sql`

- [ ] **Step 1: 写 DDL 文件**

`server/dist/db/partner-sync-schema.sql`：
```sql
-- 合作方同步 · 暂存层（Plan 1）。幂等可重复执行。
CREATE TABLE IF NOT EXISTS partner_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  partner_key VARCHAR(64) NOT NULL UNIQUE,
  secret VARCHAR(128) NOT NULL,            -- HMAC 需原文重算，故存原文（后续可改加密存储）
  company_profile_id INT NULL,
  countries_json JSON NOT NULL,            -- 发布到哪些国家站，如 ["ae","vn"]
  default_lang VARCHAR(8) NOT NULL DEFAULT 'en',
  auto_approve_updates TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS partner_sync_requests (
  request_id VARCHAR(64) PRIMARY KEY,
  partner_id INT NOT NULL,
  endpoint VARCHAR(32) NOT NULL,
  response_json JSON NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS partner_sync_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  partner_id INT NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  payload_json JSON NOT NULL,              -- 多语言母本，原样存
  review_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  listing_status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  mapped_product_id INT NULL,              -- Plan 2 发布后回填
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  UNIQUE KEY uq_partner_external (partner_id, external_id)
);

CREATE TABLE IF NOT EXISTS partner_sync_companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  partner_id INT NOT NULL,
  payload_json JSON NOT NULL,
  review_status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  mapped_company_id INT NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  UNIQUE KEY uq_partner (partner_id)
);
```

- [ ] **Step 2: 应用到本地库**

Run:
```bash
mysql -u root -proot123 tarmeer < /Users/kp/Code/tarmeer-4.0-local/server/dist/db/partner-sync-schema.sql
```
Expected: 无报错（exit 0）。

- [ ] **Step 3: 验证 4 张表存在**

Run:
```bash
mysql -u root -proot123 tarmeer -N -e "SHOW TABLES LIKE 'partner\_%';"
```
Expected: 输出 `partner_accounts` / `partner_sync_companies` / `partner_sync_products` / `partner_sync_requests` 四行。

- [ ] **Step 4: Commit**
```bash
cd /Users/kp/Code/tarmeer-4.0-local
git add server/dist/db/partner-sync-schema.sql
git commit -m "feat(partner-sync): 暂存层数据库 schema（4 表）"
```

---

### Task 2: HMAC 签名/验签库（含单测）

**Files:**
- Create: `server/dist/lib/partnerSyncSignature.js`
- Test: 内联 node 断言

- [ ] **Step 1: 写失败的单测脚本**

新建临时 `scripts/harness/_sig-test.mjs`：
```js
import { sign, verify } from '../../server/dist/lib/partnerSyncSignature.js';
const secret = 's3cr3t';
const ts = String(Math.floor(Date.now() / 1000));
const body = JSON.stringify({ a: 1 });
const sig = sign(secret, ts, body);
let pass = 0, fail = 0;
const t = (c, l) => (c ? (pass++, console.log('✓', l)) : (fail++, console.log('✗', l)));
t(verify(secret, ts, body, sig) === true, '正确签名通过');
t(verify(secret, ts, body, 'deadbeef') === false, '错误签名拒绝');
t(verify('wrong', ts, body, sig) === false, '错误密钥拒绝');
t(verify(secret, String(Number(ts) - 9999), body, sign(secret, String(Number(ts) - 9999), body)) === false, '过期时间戳拒绝');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```
> 注：`server/dist/lib/partnerSyncSignature.js` 用 `module.exports`，但本测试用 ESM `import`。Node 对 CommonJS 的命名导入做了互操作，`import { sign, verify }` 可用。

- [ ] **Step 2: 跑测试确认失败**

Run: `node /Users/kp/Code/tarmeer-4.0-local/scripts/harness/_sig-test.mjs`
Expected: FAIL（`Cannot find module .../partnerSyncSignature.js`）。

- [ ] **Step 3: 写实现**

`server/dist/lib/partnerSyncSignature.js`：
```js
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");

function sign(secret, timestamp, rawBody) {
  return crypto.createHmac("sha256", secret).update(`${timestamp}\n${rawBody}`).digest("hex");
}

function verify(secret, timestamp, rawBody, sig) {
  const ts = Number(timestamp);
  if (!timestamp || Number.isNaN(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false; // ±5 分钟防重放
  if (typeof sig !== "string") return false;
  const expected = sign(secret, timestamp, rawBody);
  if (sig.length !== expected.length) return false;
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sig, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { sign, verify };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node /Users/kp/Code/tarmeer-4.0-local/scripts/harness/_sig-test.mjs`
Expected: `4 passed, 0 failed`，exit 0。

- [ ] **Step 5: 删除临时测试 + Commit**
```bash
cd /Users/kp/Code/tarmeer-4.0-local
rm scripts/harness/_sig-test.mjs
git add server/dist/lib/partnerSyncSignature.js
git commit -m "feat(partner-sync): HMAC 签名/验签库（timestamp+\\n+rawBody, ±5min, timingSafe）"
```

---

### Task 3: 控制器 + 路由 + 挂载

**Files:**
- Create: `server/dist/controllers/partnerSyncController.js`
- Create: `server/dist/routes/partnerSync.js`
- Modify: `server/dist/app.js`（require + `app.use`）

- [ ] **Step 1: 写控制器**

`server/dist/controllers/partnerSyncController.js`：
```js
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool = require("../config/database").default;
const { verify } = require("../lib/partnerSyncSignature");

const MAX_ITEMS = 100;

// 文本字段必须是「语言码→文本」对象，且至少一种语言有值
function langMapHasValue(v) {
  return v && typeof v === "object" && !Array.isArray(v) &&
    Object.values(v).some((x) => typeof x === "string" && x.trim());
}

// 鉴权中间件：按 X-Partner-Key 取 partner，用 req.rawBody 验签
async function authenticate(req, res, next) {
  try {
    const key = req.headers["x-partner-key"];
    const ts = req.headers["x-timestamp"];
    const sig = req.headers["x-signature"];
    if (!key) return res.status(401).json({ error: "missing X-Partner-Key" });
    const [rows] = await pool.execute(
      "SELECT * FROM partner_accounts WHERE partner_key = ? AND status = 'active'", [key]);
    const partner = rows[0];
    if (!partner) return res.status(401).json({ error: "unknown partner" });
    const rawBody = req.rawBody || JSON.stringify(req.body || {});
    if (!verify(partner.secret, ts, rawBody, sig)) {
      return res.status(401).json({ error: "invalid signature" });
    }
    req.partner = partner;
    next();
  } catch (e) {
    console.error("[partner-sync] auth error", e);
    res.status(500).json({ error: "internal error" });
  }
}

async function cachedResponse(requestId) {
  const [rows] = await pool.execute(
    "SELECT response_json FROM partner_sync_requests WHERE request_id = ?", [requestId]);
  if (!rows[0]) return null;
  const r = rows[0].response_json;
  return typeof r === "string" ? JSON.parse(r) : r;
}
async function recordRequest(partnerId, requestId, endpoint, response) {
  await pool.execute(
    "INSERT IGNORE INTO partner_sync_requests (request_id, partner_id, endpoint, response_json) VALUES (?,?,?,?)",
    [requestId, partnerId, endpoint, JSON.stringify(response)]);
}

// 容错 upsert：create 遇已存在当更新、update 遇缺失当创建（底层同一逻辑）
async function upsertProduct(partner, item) {
  const ext = item && item.external_id;
  if (!ext || typeof ext !== "string") return { external_id: ext || null, ok: false, error: "external_id required" };
  if (!langMapHasValue(item.title)) return { external_id: ext, ok: false, error: "title required (lang map)" };
  const listing = item.status === "inactive" ? "inactive" : "active";
  const payload = JSON.stringify(item);
  const [exist] = await pool.execute(
    "SELECT id FROM partner_sync_products WHERE partner_id = ? AND external_id = ?", [partner.id, ext]);
  if (exist[0]) {
    await pool.execute(
      "UPDATE partner_sync_products SET payload_json=?, listing_status=?, is_deleted=0, review_status=IF(review_status='rejected','pending',review_status), synced_at=NOW() WHERE id=?",
      [payload, listing, exist[0].id]);
    return { external_id: ext, ok: true, action: "updated", review_status: "pending" };
  }
  await pool.execute(
    "INSERT INTO partner_sync_products (partner_id, external_id, payload_json, listing_status, review_status) VALUES (?,?,?,?, 'pending')",
    [partner.id, ext, payload, listing]);
  return { external_id: ext, ok: true, action: "created", review_status: "pending" };
}

async function handleProducts(req, res) {
  try {
    const { version, request_id, items } = req.body || {};
    if (!version || !request_id) return res.status(400).json({ error: "version and request_id required" });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items required" });
    if (items.length > MAX_ITEMS) return res.status(400).json({ error: `max ${MAX_ITEMS} items per request` });
    const cached = await cachedResponse(request_id);
    if (cached) return res.json(cached);
    const results = [];
    for (const item of items) results.push(await upsertProduct(req.partner, item));
    const response = { results };
    await recordRequest(req.partner.id, request_id, "products", response);
    res.json(response);
  } catch (e) {
    console.error("[partner-sync] products error", e);
    res.status(500).json({ error: "internal error" });
  }
}

async function handleCompany(req, res) {
  try {
    const { version, request_id, company } = req.body || {};
    if (!version || !request_id) return res.status(400).json({ error: "version and request_id required" });
    if (!company || !langMapHasValue(company.company_name))
      return res.status(400).json({ error: "company.company_name required (lang map)" });
    const cached = await cachedResponse(request_id);
    if (cached) return res.json(cached);
    const payload = JSON.stringify(company);
    const [exist] = await pool.execute(
      "SELECT id FROM partner_sync_companies WHERE partner_id = ?", [req.partner.id]);
    let action;
    if (exist[0]) {
      await pool.execute(
        "UPDATE partner_sync_companies SET payload_json=?, review_status=IF(review_status='rejected','pending',review_status), synced_at=NOW() WHERE id=?",
        [payload, exist[0].id]);
      action = "updated";
    } else {
      await pool.execute(
        "INSERT INTO partner_sync_companies (partner_id, payload_json, review_status) VALUES (?,?, 'pending')",
        [req.partner.id, payload]);
      action = "created";
    }
    const response = { ok: true, action, review_status: "pending" };
    await recordRequest(req.partner.id, request_id, "company", response);
    res.json(response);
  } catch (e) {
    console.error("[partner-sync] company error", e);
    res.status(500).json({ error: "internal error" });
  }
}

async function handleReconcile(req, res) {
  try {
    const { version, request_id, external_ids } = req.body || {};
    if (!version || !request_id) return res.status(400).json({ error: "version and request_id required" });
    if (!Array.isArray(external_ids)) return res.status(400).json({ error: "external_ids array required" });
    const cached = await cachedResponse(request_id);
    if (cached) return res.json(cached);
    let r;
    if (external_ids.length === 0) {
      [r] = await pool.execute(
        "UPDATE partner_sync_products SET is_deleted=1 WHERE partner_id=? AND is_deleted=0", [req.partner.id]);
    } else {
      const ph = external_ids.map(() => "?").join(",");
      [r] = await pool.execute(
        `UPDATE partner_sync_products SET is_deleted=1 WHERE partner_id=? AND is_deleted=0 AND external_id NOT IN (${ph})`,
        [req.partner.id, ...external_ids]);
    }
    const response = { ok: true, marked_deleted: r.affectedRows };
    await recordRequest(req.partner.id, request_id, "reconcile", response);
    res.json(response);
  } catch (e) {
    console.error("[partner-sync] reconcile error", e);
    res.status(500).json({ error: "internal error" });
  }
}

async function handleStatus(req, res) {
  try {
    const ext = req.query.external_id;
    if (!ext) return res.status(400).json({ error: "external_id required" });
    const [rows] = await pool.execute(
      "SELECT external_id, review_status, listing_status, is_deleted, mapped_product_id FROM partner_sync_products WHERE partner_id=? AND external_id=?",
      [req.partner.id, ext]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: "not found" });
    res.json({
      external_id: row.external_id,
      review_status: row.review_status,
      listing_status: row.listing_status,
      visible: row.review_status === "approved" && row.listing_status === "active" && !row.is_deleted && !!row.mapped_product_id,
    });
  } catch (e) {
    console.error("[partner-sync] status error", e);
    res.status(500).json({ error: "internal error" });
  }
}

module.exports = { authenticate, handleProducts, handleCompany, handleReconcile, handleStatus };
```

- [ ] **Step 2: 写路由**

`server/dist/routes/partnerSync.js`：
```js
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const c = require("../controllers/partnerSyncController");
const router = (0, express_1.Router)();
router.use(c.authenticate);
router.post("/products/create", c.handleProducts);
router.post("/products/update", c.handleProducts);
router.post("/company", c.handleCompany);
router.post("/products/reconcile", c.handleReconcile);
router.get("/products/status", c.handleStatus);
exports.default = router;
```

- [ ] **Step 3: 在 app.js 挂载**

`server/dist/app.js`：在其它 `require("./routes/...")` 附近加（紧跟 `integration_1` 那行）：
```js
const partnerSync_1 = __importDefault(require("./routes/partnerSync"));
```
在 `app.use('/api/integration', integration_1.default);` 之后加：
```js
app.use('/api/partner-sync', partnerSync_1.default);
```

- [ ] **Step 4: 重启后端，确认无崩溃**

Run:
```bash
lsof -i :3002 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null; sleep 1
PORT=3002 DEV_SKIP_EMAIL=true node /Users/kp/Code/tarmeer-4.0-local/server/dist/app.js > /tmp/tarmeer-api-3002.log 2>&1 &
sleep 2
curl -s --noproxy '*' -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3002/api/partner-sync/products/create
```
Expected: `401`（无凭证被拒），且 `/tmp/tarmeer-api-3002.log` 无启动错误。

- [ ] **Step 5: Commit**
```bash
cd /Users/kp/Code/tarmeer-4.0-local
git add server/dist/controllers/partnerSyncController.js server/dist/routes/partnerSync.js server/dist/app.js
git commit -m "feat(partner-sync): 控制器+路由+挂载（create/update/company/reconcile/status）"
```

---

### Task 4: 验收 harness（8 用例）

**Files:**
- Create: `scripts/harness/partner-sync-walkthrough.mjs`

- [ ] **Step 1: 写 harness（先建测试 partner，跑用例，最后清理）**

`scripts/harness/partner-sync-walkthrough.mjs`：
```js
#!/usr/bin/env node
/**
 * partner-sync-walkthrough.mjs — 合作方同步入库层验收
 * 用法: node scripts/harness/partner-sync-walkthrough.mjs
 * 前提: 本地后端 localhost:3002 已启动；本地 MySQL tarmeer 库；已建 partner_* 表。
 */
import { execSync } from "child_process";
import crypto from "crypto";

const API = "http://localhost:3002/api/partner-sync";
const KEY = "harness-partner-key";
const SECRET = "harness-secret-123";
const TS = Date.now();

let pass = 0, fail = 0;
const ok = (l) => { console.log(`  \x1b[32m✓\x1b[0m ${l}`); pass++; };
const ng = (l, d) => { console.log(`  \x1b[31m✗\x1b[0m ${l}${d ? " — " + d : ""}`); fail++; };
const sql = (q) => execSync(`mysql -u root -proot123 tarmeer -N -e ${JSON.stringify(q)} 2>/dev/null`, { encoding: "utf8" }).trim();

// 准备：建测试 partner（先清残留）
sql("DELETE FROM partner_accounts WHERE partner_key='" + KEY + "'");
sql(`INSERT INTO partner_accounts (partner_key, secret, countries_json, default_lang) VALUES ('${KEY}','${SECRET}','[\\"ae\\",\\"vn\\"]','en')`);
const PARTNER_ID = sql("SELECT id FROM partner_accounts WHERE partner_key='" + KEY + "'");
const cleanup = () => {
  sql(`DELETE FROM partner_sync_products WHERE partner_id=${PARTNER_ID}`);
  sql(`DELETE FROM partner_sync_companies WHERE partner_id=${PARTNER_ID}`);
  sql(`DELETE FROM partner_sync_requests WHERE partner_id=${PARTNER_ID}`);
  sql(`DELETE FROM partner_accounts WHERE id=${PARTNER_ID}`);
};

async function call(method, path, bodyObj, { badSig = false } = {}) {
  const raw = bodyObj ? JSON.stringify(bodyObj) : "";
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = badSig ? "deadbeef" : crypto.createHmac("sha256", SECRET).update(`${ts}\n${raw}`).digest("hex");
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-Partner-Key": KEY, "X-Timestamp": ts, "X-Signature": sig },
    body: bodyObj ? raw : undefined,
  });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}
const rid = (s) => `${MARK}-${s}`;
const MARK = `h${TS}`;
const prod = (ext, over = {}) => ({ external_id: ext, status: "active", title: { en: "Rope", vi: "Day" }, ...over });

try {
  console.log("合作方同步入库 walkthrough\n");

  // UC1 签名校验
  let r = await call("POST", "/products/create", { version: "1", request_id: rid("sig"), items: [prod(`${MARK}-p1`)] }, { badSig: true });
  r.status === 401 ? ok("UC1 错误签名 → 401") : ng("UC1 错误签名应 401", `got ${r.status}`);

  // UC2 创建幂等：同 external_id 推两次 → 一条，内容为最后一次
  await call("POST", "/products/create", { version: "1", request_id: rid("c1"), items: [prod(`${MARK}-p2`, { title: { en: "First" } })] });
  await call("POST", "/products/create", { version: "1", request_id: rid("c2"), items: [prod(`${MARK}-p2`, { title: { en: "Second" } })] });
  const cnt = sql(`SELECT COUNT(*) FROM partner_sync_products WHERE partner_id=${PARTNER_ID} AND external_id='${MARK}-p2'`);
  const title = sql(`SELECT JSON_EXTRACT(payload_json,'$.title.en') FROM partner_sync_products WHERE partner_id=${PARTNER_ID} AND external_id='${MARK}-p2'`);
  cnt === "1" && title.includes("Second") ? ok("UC2 同 external_id 幂等（一条，内容最新）") : ng("UC2 幂等失败", `cnt=${cnt} title=${title}`);

  // UC3 request_id 去重：同 request_id 重发 → 不重复处理
  const rd = rid("dedup");
  await call("POST", "/products/create", { version: "1", request_id: rd, items: [prod(`${MARK}-p3`, { title: { en: "v1" } })] });
  await call("POST", "/products/create", { version: "1", request_id: rd, items: [prod(`${MARK}-p3`, { title: { en: "v2-should-be-ignored" } })] });
  const t3 = sql(`SELECT JSON_EXTRACT(payload_json,'$.title.en') FROM partner_sync_products WHERE partner_id=${PARTNER_ID} AND external_id='${MARK}-p3'`);
  t3.includes("v1") ? ok("UC3 同 request_id 去重（第二次被忽略）") : ng("UC3 去重失败", `title=${t3}`);

  // UC4 容错拆分：create 遇已存在→updated；update 遇不存在→created
  let cr = await call("POST", "/products/create", { version: "1", request_id: rid("dup"), items: [prod(`${MARK}-p2`)] });
  let up = await call("POST", "/products/update", { version: "1", request_id: rid("new"), items: [prod(`${MARK}-p4new`)] });
  cr.body?.results?.[0]?.action === "updated" && up.body?.results?.[0]?.action === "created"
    ? ok("UC4 容错（create 遇存在=updated / update 遇缺失=created）")
    : ng("UC4 容错失败", JSON.stringify([cr.body?.results, up.body?.results]));

  // UC5 状态同步：下架 status=inactive → listing_status=inactive；再上架→active
  await call("POST", "/products/update", { version: "1", request_id: rid("off"), items: [prod(`${MARK}-p2`, { status: "inactive" })] });
  const ls1 = sql(`SELECT listing_status FROM partner_sync_products WHERE partner_id=${PARTNER_ID} AND external_id='${MARK}-p2'`);
  await call("POST", "/products/update", { version: "1", request_id: rid("on"), items: [prod(`${MARK}-p2`, { status: "active" })] });
  const ls2 = sql(`SELECT listing_status FROM partner_sync_products WHERE partner_id=${PARTNER_ID} AND external_id='${MARK}-p2'`);
  ls1 === "inactive" && ls2 === "active" ? ok("UC5 上下架状态同步") : ng("UC5 状态失败", `off=${ls1} on=${ls2}`);

  // UC6 部分失败：一条缺 title → 该条 ok:false，其余成功
  let pf = await call("POST", "/products/create", { version: "1", request_id: rid("pf"), items: [prod(`${MARK}-p5`), { external_id: `${MARK}-p6` }] });
  const rs = pf.body?.results || [];
  rs[0]?.ok === true && rs[1]?.ok === false ? ok("UC6 部分失败逐条返回，不整批回滚") : ng("UC6 部分失败处理错", JSON.stringify(rs));

  // UC7 多语言存储：{en,vi} 往返不丢
  await call("POST", "/products/create", { version: "1", request_id: rid("i18n"), items: [prod(`${MARK}-p7`, { title: { en: "Hello", vi: "Xin chao" } })] });
  const vi = sql(`SELECT JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.title.vi')) FROM partner_sync_products WHERE partner_id=${PARTNER_ID} AND external_id='${MARK}-p7'`);
  vi === "Xin chao" ? ok("UC7 多语言母本存储往返") : ng("UC7 多语言失败", `vi=${vi}`);

  // UC8 待审：新建商品 review_status=pending 且未发布（mapped_product_id 为空、不可见）
  let st = await call("GET", `/products/status?external_id=${MARK}-p7`, null);
  const rev = sql(`SELECT review_status FROM partner_sync_products WHERE partner_id=${PARTNER_ID} AND external_id='${MARK}-p7'`);
  rev === "pending" && st.body?.visible === false ? ok("UC8 新数据 pending 且未公开可见") : ng("UC8 待审失败", `rev=${rev} visible=${st.body?.visible}`);

  console.log(`\n${pass} passed, ${fail} failed`);
} finally {
  cleanup();
}
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: 重启后端后跑 harness**

Run:
```bash
lsof -i :3002 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null; sleep 1
PORT=3002 DEV_SKIP_EMAIL=true node /Users/kp/Code/tarmeer-4.0-local/server/dist/app.js > /tmp/tarmeer-api-3002.log 2>&1 &
sleep 2
node /Users/kp/Code/tarmeer-4.0-local/scripts/harness/partner-sync-walkthrough.mjs
```
Expected: `8 passed, 0 failed`，exit 0。任何一条 ✗ → 修控制器/SQL 后重跑。

- [ ] **Step 3: 跑 smoke-test 确保没破坏现有路由**

Run: `node /Users/kp/Code/tarmeer-4.0-local/scripts/harness/smoke-test.mjs`
Expected: 全绿（tsc 跳过——后端无 TS；路由 + 前端可达通过）。若 smoke-test 因无 TS 而对后端不适用，至少确认其 exit 0 或与改动前一致。

- [ ] **Step 4: Commit**
```bash
cd /Users/kp/Code/tarmeer-4.0-local
git add scripts/harness/partner-sync-walkthrough.mjs
git commit -m "test(partner-sync): 入库层 walkthrough 8 用例（签名/幂等/去重/容错/状态/部分失败/多语言/待审）"
```

---

## Self-Review（计划自检）

**Spec 覆盖：**
- §2 鉴权 HMAC → Task 2 + Task 3 authenticate ✓
- §3 凭证去重 request_id → Task 3 cachedResponse/recordRequest + UC3 ✓
- §5 暂存表（partner_accounts / sync_products / sync_companies / sync_requests）→ Task 1 ✓
- §6 create/update 容错 upsert、company、reconcile、status → Task 3 + UC4/UC6 ✓
- §6 状态字段上下架 → Task 3 listing_status + UC5 ✓
- 多语言母本存储 → Task 3 payload 原样存 + UC7 ✓
- 待审 pending 不可见 → Task 3 默认 pending + UC8 ✓
- **未覆盖（有意，归入 Plan 2/3）**：按 countries 扇出到现网展示表、图片多档缓存、admin 审核 UI。计划顶部「范围」已声明。

**占位符扫描：** 无 TBD/TODO；每个代码步骤含完整代码与可运行命令。

**类型/命名一致性：** `langMapHasValue`、`cachedResponse`、`recordRequest`、`upsertProduct` 在 Task 3 内定义并使用；harness 字段（`action`/`review_status`/`listing_status`/`visible`）与控制器响应一致；签名 `sign/verify` 命名在 Task 2 与 harness 一致。

**已知取舍：**
- `partner_accounts.secret` 存原文（HMAC 需重算）。后续可改为加密存储，不影响接口。
- smoke-test 含 `tsc` 步骤，本仓库后端无 TS 源；若该步报错属预期，以 `partner-sync-walkthrough.mjs` 全绿为本计划主验收。
