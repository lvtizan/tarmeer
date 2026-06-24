# 合作方数据同步接口 — 设计 Spec

- 日期：2026-06-24
- 状态：设计已确认，待写实现计划
- 作者：小明 + Claude

## 1. 目标与验收标准

### 做什么
给第三方合作网站一套**通用、稳定**的接口，让他们自动把"指定商品目录 + 企业信息"同步到 Tarmeer。
- 企业信息：一个合作方对应一条企业记录，对方供应商修改后可重复同步。
- 商品信息：会高频同步，支持新增/更新/下架。

### 验收标准（可检验）
1. 同一商品用相同 `external_id` 推送两次，库里只有一条记录、内容为最后一次（幂等）。
2. 对账接口收到全量 `external_id` 清单后，不在清单里的商品被标记下架，不误删人工录入的商品。
3. 凭证 `countries=["ae","vn"]` 的合作方推送，扇出后 AE 视图只见英文、VN 视图只见越南语，**绝不串语言**（某语言缺失回退 `default_lang`，不回退到另一国语言）。
4. 合作方推送的数据默认进 `pending` 待审池，未审核通过前站上不可见。
5. 签名校验失败返回 401；批量请求部分失败时逐条返回结果，不整批回滚。
6. `partner-sync-walkthrough.mjs` 全绿。

### 约束
- 国家隔离铁律：跨表引用成对存 `(ref_id, ref_source)`，国家由凭证决定，不由请求体决定。
- 图片必须走现有多档缓存管线（`gen-image-variants` + rsync 到 portal 目录），禁止热链对方 URL。
- 鉴权复用现有 CRM 集成的 HMAC 模式（`crmIntegrationService.verifyCrmRequest` 同款）。
- 不硬编码 schema，标准字段集中定义一处。

## 2. 核心设计原则（参照支付宝/Stripe 开放平台）

1. **平台定 schema，合作方做映射**：我们公布固定标准字段，对方负责把自己的数据翻译成我们的格式。我们永远只认自己的 schema，不消费对方内部结构。
2. **按 `external_id` 幂等 upsert**：对方自己的稳定商品 ID 作为匹配键（同支付宝 `out_trade_no`）。我们只要求该 ID 在某合作方范围内唯一 + 稳定。
   - 对方商品是 **SPU + SKU 两层**结构。**我们同步到 SPU 层**：`external_id = SPU id`，一个 SPU = 我们的一个商品。SKU 列表塞进 `attributes.skus[]` 原样存，当前目录展示不结构化（将来要展示规格/报价再扩，见 §11）。
3. **状态同步优先于存在性对账**（对方 2026-06-24 提出，已采纳）：商品"下架"时 id 依然存在，只是状态变了。因此每个商品带 `status` 字段（`active`=上架 / `inactive`=下架），下架走正常推送通道推一条 `status=inactive`，我们**实时**隐藏上线商品但保留记录与映射。这取代了"靠每日全量 ID 清单判断下架"的笨办法（下架商品的 id 仍在清单里，对账判断不出）。全量对账（§6）降级为**可选**，仅兜底"硬删除（id 彻底消失）"，对方能做则做。
4. **未知字段进 JSON 口袋**：标准字段覆盖不到的，对方塞进 `attributes{}`，我们原样存 JSON 列。
5. **签名 + 版本 + request_id**：HMAC 签名；`version` 保证加字段不破坏老对接方；`request_id` 网络重试去重。

## 3. 数据流

```
合作网站                          Tarmeer
  │ 商品/企业变更
  │ ──X-Partner-Key + HMAC POST──▶  /api/partner-sync/*
  │                                   │ 写入 ingestion 暂存表(status=pending)
  │                                   │ 图片异步下载 → 多档缓存 → rsync portal
  │                                   ▼
  │                              admin 后台审核
  │                                   │ approved
  │                                   ▼
  │                        映射进 supplier_profiles / supplier_products(上线可见)
```

- 数据流方向：**Push**（合作方主动推），不做 Pull。
- 商品粒度：**增量 upsert + 状态字段同步**（平时只推变化商品；上架/下架走商品 `status` 字段实时同步；硬删除靠可选的全量对账兜底）。
- 上线方式：**先进待审池**（首次同步需审核，后续可配置自动过/再审，详见 §7）。

## 4. 鉴权

- `partner_accounts` 表：`id, partner_key, secret_hash, company_profile_id, country, status, created_at`。
- 请求头：
  - `X-Partner-Key`：公开标识。
  - `X-Timestamp`：Unix 秒，服务端校验 ±5 分钟防重放。
  - `X-Signature`：`HMAC-SHA256(secret, timestamp + rawBody)`，复用 `crmIntegrationService` 同款校验逻辑。
- **展示国家由 `partner_accounts.countries[]` 决定**（一个合作方可发布到多个国家站，如 `["ae","vn"]`）。请求体即使带 country/国家也忽略，一律用凭证绑定的国家列表。
- `partner_accounts.default_lang`：兜底语言（如 `en`）。某国语言译文缺失时回退到它，**绝不回退到另一个国家的语言**（国家隔离 P0 防线）。

## 5. 数据模型

### 凭证表

**`partner_accounts`**
```
id, partner_key, secret_hash, company_profile_id,
countries_json (JSON, 如 ["ae","vn"]),   ← 发布到哪些国家站
default_lang (兜底语言, 如 'en'),
auto_approve_updates (bool),
status, created_at
```

### 新增暂存表（存多语言"母本"，country-agnostic；保留原始推送，支持审核与回溯）

**`partner_sync_companies`**
```
id, partner_id, payload_json (多语言母本),
status (pending|approved|rejected),
synced_at, reviewed_at, reviewer_id
```

**`partner_sync_products`**
```
id, partner_id, external_id, payload_json (多语言母本),
review_status (pending|approved|rejected),   ← 我方审核态
listing_status (active|inactive),            ← 对方上架/下架态(来自推送 status 字段)
is_deleted (硬删除对账标记),
synced_at, reviewed_at
UNIQUE KEY (partner_id, external_id)   ← 幂等 upsert 锚点

注意：母本不带 country，审核通过上线时按 partner.countries[] 扇出（见下）。
```

### 上线时按国家"扇出"（兼容现有 per-country 单语言架构 + 隔离铁律）

审核通过后，对 `partner.countries[]` 里**每个国家**各落一行 `supplier_products`：
- 该行 `country` = 目标国家，文本取该国语言（AE 行存 `en`、VN 行存 `vi`）；缺该语言则回退 `default_lang`。
- `source='partner'`、`partner_external_id=external_id`、`partner_country='<该国>'`。
- 展示层不变：AE 视图查 AE 行（永远英文）、VN 视图查 VN 行（永远越南语），**不串语言**。
- 更新/上下架/删除传播到该商品的**所有国家副本**。

可见 = `review_status=approved AND listing_status=active AND is_deleted=0`。两个 status 维度正交（我方信任态 vs 对方上下架态）。

### 复用上线表（加来源标记，隔离人工数据）

- `supplier_profiles` / `supplier_products` 各加：
  - `source` ENUM('manual','partner') DEFAULT 'manual'
  - `partner_external_id` VARCHAR NULL（仅 partner 来源填）
- upsert/对账/扇出只作用于 `source='partner'` 的行，**绝不触碰人工录入的数据**。

### 幂等去重表

**`partner_sync_requests`**：`request_id (PK), partner_id, received_at` —— 网络重试时同 `request_id` 直接返回上次结果，不重复入库。

> 为什么暂存表与上线表分开：① 审核需要 pending 态；② 原始 JSON 留底（含 schema 未覆盖字段），将来回溯/重新映射不丢数据；③ 不污染人工维护的数据。

## 6. 接口契约

所有请求体含公共字段：`version`（如 `"1"`）、`request_id`（UUID，对方生成）。

| Endpoint | 方法 | 用途 | 幂等键 |
|---|---|---|---|
| `/api/partner-sync/company` | POST | 同步企业信息 | partner 凭证（一对一） |
| `/api/partner-sync/products/create` | POST | 创建商品（对方"商品创建"事件调用） | `external_id` |
| `/api/partner-sync/products/update` | POST | 更新商品 + 状态同步（对方"编辑/上架/下架"事件调用，含 `status`） | `external_id` |
| `/api/partner-sync/products/reconcile` | POST | **（可选）** 硬删除对账（全量 ID 清单，对方能做才用） | 全量 ID 列表 |
| `/api/partner-sync/status` | GET | 查同步/审核状态 | — |

### 创建 vs 更新接口（对方要求拆开，底层都是容错 upsert）
对方系统里"商品创建"和"编辑/上下架"是不同事件，故接口形式拆成 `create` / `update` 两个，请求体 schema 完全相同。**两个接口底层走同一套按 `external_id` 的 upsert 逻辑，容错兜底**（对方 2026-06-24 要求拆开 + 容错策略已确认）：
- `create` 遇到 `external_id` 已存在 → 当更新处理，响应 `{ "action": "updated" }`。
- `update` 遇到 `external_id` 不存在 → 当创建处理，响应 `{ "action": "created" }`。
- 正常情况响应 `{ "action": "created" }` / `{ "action": "updated" }` 如实告知实际动作。
- 好处：重试、事件漏发、乱序到达都不丢数据、不报硬错，结果幂等一致。

### 商品标准 schema（对方映射目标，create/update 共用）
**多语言约定**：文本字段用「语言码→文本」对象。需提供凭证 `countries[]` 对应语言（AE→`en`、VN→`vi`、SA→`ar`）。某字段缺某语言 → 回退 `default_lang`。语言中立字段（phone/website/whatsapp/image URL）保持普通字符串。

```jsonc
{
  "version": "1",
  "request_id": "uuid",
  "default_lang": "en",                       // 本批兜底语言
  "items": [
    {
      "external_id": "对方 SPU id(必填,稳定唯一)",
      "status": "active",                       // active=上架 / inactive=下架,下架推此值即实时隐藏
      "title":       { "en": "...", "vi": "..." },
      "description": { "en": "...", "vi": "..." },
      "category_id": "对方叶子分类稳定ID(可选,防改名)",
      "category_path": {                        // 3 级分类全路径,按语言分组
        "en": ["Consumer Electronics", "Computers & Office", "Projectors"],
        "vi": ["Điện tử tiêu dùng", "Máy tính & Văn phòng", "Máy chiếu"]
      },
      "images": ["https://对方域名/a.jpg"],   // URL 数组,我方异步下载落地(对方加我方域名白名单)
      "sort_order": 0,
      "attributes": {
        "skus": [ { "sku_id": "...", "spec": "红色/10米" } ],  // SKU 列表原样存,当前不结构化
        "任意对方私有字段": "原样存 JSON"
      }
    }
  ]
}
```
响应：逐条结果，部分失败不整批回滚。
```jsonc
{ "results": [ { "external_id": "...", "ok": true, "action": "created", "review_status": "pending" },
               { "external_id": "...", "ok": true, "action": "updated", "review_status": "pending" },
               { "external_id": "...", "ok": false, "error": "title required" } ] }
```

### 上架/下架（走正常 products 接口，不需独立端点）
对方下架某商品时，在常规 `POST /products` 推送里带 `status: "inactive"`，我们实时把上线商品隐藏（`listing_status=inactive`），保留记录与映射；重新上架推 `status: "active"` 即恢复。这是处理"下架"的**主路径**。

### 对账 schema（可选，仅兜底硬删除）
```jsonc
{ "version": "1", "request_id": "uuid", "external_ids": ["id1","id2", "..."] }
```
处理：把该 partner 下 `source='partner'` 且不在 `external_ids` 里的商品标记 `is_deleted=1`（连带下线对应上线行）。
仅用于对方系统里**彻底删除**（id 消失）的商品；日常上下架不依赖此接口。对方若评估后做不了全量清单，可不实现，硬删除商品将保持最后已知状态。

### 企业 standard schema
```jsonc
{
  "version": "1", "request_id": "uuid",
  "default_lang": "en",
  "company": {
    "company_name": { "en": "...", "vi": "..." },
    "description":   { "en": "...", "vi": "..." },
    "store_address": { "en": "...", "vi": "..." },
    "categories":    { "en": ["..."], "vi": ["..."] },
    "contact_phone": "string",      // 语言中立,普通字符串
    "website": "string",
    "whatsapp": "string",
    "logo_url": "https://...",
    "cover_image_url": "https://...",
    "attributes": { "...": "..." }
  }
}
```

## 7. 审核流

- 首次同步（`mapped_*_id IS NULL`）：进 `pending`，admin 后台审核通过后映射上线。
- 后续更新：可配置（`partner_accounts.auto_approve_updates` 布尔）——
  - 默认 false：每次更新重新进 pending（最严，MVP 采用）。
  - true：已上线过的对象，更新直接同步到上线表。
- admin 后台需新增"合作方同步审核"列表页（复用现有 supplier admin 模式），从 `useAdminCountry()` 取 country 过滤。

## 8. 图片处理

- 对方只发 URL，并把我方服务器域名加入其图片防盗链白名单（对方 2026-06-24 确认可做）。落库时先存原始 URL 于 `payload_json`。
- **审核通过上线时**触发：异步下载 → `scripts/gen-image-variants.mjs` 生成 4 档 WebP → `fs.chmod(0o644)` → rsync 到 portal 同名目录。
- 数据库只存最终路径（如 `/images/partner/<partner>/<external_id>/cover.webp`），**不存二进制 BLOB**。
- 下载失败该图跳过并记日志，不阻断其余字段上线。

## 9. 幂等 / 错误 / 限流

| 情况 | 行为 |
|---|---|
| 同 `request_id` 重发 | 命中 `partner_sync_requests`，返回上次结果，不重复入库 |
| 同 `external_id` 重发 | upsert，结果一致 |
| 签名失败 | 401 |
| 缺必填字段 | 该条 400（批量则该条 ok:false），其余正常 |
| 高频重推 | 429 限流（每 partner 维度） |
| 批量部分失败 | 逐条返回 `{external_id, ok, error}`，不整批回滚 |

## 10. 测试（AGENTS.md 第六步铁律）

新建 `scripts/harness/partner-sync-walkthrough.mjs`，用例：
1. 签名校验：错误签名 → 401。
2. 商品 upsert 幂等：同 `external_id` 推两次 → 库里一条、内容为最后一次。
2b. 容错拆分：`create` 遇已存在 id → action=updated 不报错；`update` 遇不存在 id → action=created 不报错、不丢数据。
3. `request_id` 去重：同 request_id 重发 → 不重复入库。
4. 状态同步（下架）：推 `status=inactive` → 上线商品隐藏、记录保留；再推 `status=active` → 恢复可见。
4b. 对账硬删除（可选）：发不含某 ID 的清单 → 该商品 `is_deleted=1`，人工录入商品不受影响。
5. 多国扇出 + 不串语言：凭证 countries=["ae","vn"] 推一条多语言商品 → 生成 AE(en) 和 VN(vi) 两行；AE 视图取英文、VN 视图取越南语；缺某语言回退 default_lang 而非另一国语言。
6. 待审池：pending 数据公开接口查不到。
7. 部分失败：一条缺 title → 该条 ok:false，其余成功。

并复用 `country-walkthrough.mjs` 验证不串桶。

## 11. 不做（YAGNI）
- 不做 Pull（对方暴露 feed 我方轮询）。
- 不做实时 WebSocket / 长连接。
- 不做对方侧 SDK（只给 HTTP 契约 + 签名示例文档）。
- 不做商品 SKU/库存/价格（当前站点是目录展示，无电商交易；将来需要再扩 `attributes` 或加版本）。

## 12. 交付物
1. 后端：`partnerSyncController.ts` + 路由 `partnerSync.ts`，挂 `/api/partner-sync`。
2. 迁移：3 张新表 + 2 张表加列。
3. admin：合作方同步审核页。
4. harness：`partner-sync-walkthrough.mjs`。
5. 对接文档：给合作方的字段映射说明 + HMAC 签名示例（Node/PHP/Python）。
