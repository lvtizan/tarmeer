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
3. AE 凭证推送的数据只落 AE 桶，绝不出现在 VN/SA 视图（国家隔离铁律）。
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
3. **未知字段进 JSON 口袋**：标准字段覆盖不到的，对方塞进 `attributes{}`，我们原样存 JSON 列。
4. **签名 + 版本 + request_id**：HMAC 签名；`version` 保证加字段不破坏老对接方；`request_id` 网络重试去重。

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
- 商品粒度：**增量 upsert + 独立对账接口**（平时只推变化商品；下架走每日全量 ID 对账）。
- 上线方式：**先进待审池**（首次同步需审核，后续可配置自动过/再审，详见 §7）。

## 4. 鉴权

- `partner_accounts` 表：`id, partner_key, secret_hash, company_profile_id, country, status, created_at`。
- 请求头：
  - `X-Partner-Key`：公开标识。
  - `X-Timestamp`：Unix 秒，服务端校验 ±5 分钟防重放。
  - `X-Signature`：`HMAC-SHA256(secret, timestamp + rawBody)`，复用 `crmIntegrationService` 同款校验逻辑。
- **国家桶由 `partner_accounts.country` 决定**。请求体即使带 country 也忽略，一律用凭证绑定的国家。

## 5. 数据模型

### 新增暂存表（保留原始推送，支持审核与回溯）

**`partner_sync_companies`**
```
id, partner_id, country, payload_json,
mapped_company_id (NULL=未上线),
status (pending|approved|rejected),
synced_at, reviewed_at, reviewer_id
```

**`partner_sync_products`**
```
id, partner_id, country, external_id, payload_json,
mapped_product_id (NULL=未上线),
status (pending|approved|rejected),
is_deleted (对账下架标记),
synced_at, reviewed_at
UNIQUE KEY (partner_id, external_id)   ← 幂等 upsert 锚点
```

### 复用上线表（加来源标记，隔离人工数据）

- `supplier_profiles` / `supplier_products` 各加：
  - `source` ENUM('manual','partner') DEFAULT 'manual'
  - `partner_external_id` VARCHAR NULL（仅 partner 来源填）
- upsert/对账只作用于 `source='partner'` 的行，**绝不触碰人工录入的数据**。

### 幂等去重表

**`partner_sync_requests`**：`request_id (PK), partner_id, received_at` —— 网络重试时同 `request_id` 直接返回上次结果，不重复入库。

> 为什么暂存表与上线表分开：① 审核需要 pending 态；② 原始 JSON 留底（含 schema 未覆盖字段），将来回溯/重新映射不丢数据；③ 不污染人工维护的数据。

## 6. 接口契约

所有请求体含公共字段：`version`（如 `"1"`）、`request_id`（UUID，对方生成）。

| Endpoint | 方法 | 用途 | 幂等键 |
|---|---|---|---|
| `/api/partner-sync/company` | POST | 同步企业信息 | partner 凭证（一对一） |
| `/api/partner-sync/products` | POST | 批量 upsert 商品（≤100/批） | `external_id` |
| `/api/partner-sync/products/reconcile` | POST | 对账下架（每日全量 ID 清单） | 全量 ID 列表 |
| `/api/partner-sync/status` | GET | 查同步/审核状态 | — |

### 商品标准 schema（对方映射目标）
```jsonc
{
  "version": "1",
  "request_id": "uuid",
  "items": [
    {
      "external_id": "对方商品ID(必填,稳定唯一)",
      "title": "string",
      "description": "string",
      "category": "string",
      "images": ["https://对方域名/a.jpg"],   // URL 数组,我方异步下载落地
      "sort_order": 0,
      "attributes": { "任意对方私有字段": "原样存 JSON" }
    }
  ]
}
```
响应：逐条结果，部分失败不整批回滚。
```jsonc
{ "results": [ { "external_id": "...", "ok": true, "status": "pending" },
               { "external_id": "...", "ok": false, "error": "title required" } ] }
```

### 对账 schema
```jsonc
{ "version": "1", "request_id": "uuid", "external_ids": ["id1","id2", "..."] }
```
处理：把该 partner 下 `source='partner'` 且不在 `external_ids` 里的商品标记 `is_deleted=1`（连带下线对应上线行）。

### 企业 standard schema
```jsonc
{
  "version": "1", "request_id": "uuid",
  "company": {
    "company_name": "string",
    "description": "string",
    "contact_phone": "string",
    "website": "string",
    "whatsapp": "string",
    "store_address": "string",
    "logo_url": "https://...",
    "cover_image_url": "https://...",
    "categories": ["..."],
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

- 对方只发 URL。落库时先存原始 URL 于 `payload_json`。
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
3. `request_id` 去重：同 request_id 重发 → 不重复入库。
4. 对账下架：发不含某 ID 的清单 → 该商品 `is_deleted=1`，人工录入商品不受影响。
5. 国家桶绑定：AE 凭证推送 → 数据 country=ae，不进 VN 视图。
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
