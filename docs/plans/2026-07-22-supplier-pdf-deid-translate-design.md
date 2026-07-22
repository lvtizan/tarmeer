# 供应商画册 PDF 上传自动去标识 + 翻译 — 设计文档

- 日期：2026-07-22
- 状态：设计已与用户对齐（"尽你可能"），待写实施计划
- 关联：FA-14（公开供应商去标识：漏抹身份字段 = P0 泄露）、tarmeer-strategy-pivot（设计师主导+中国建材）、变现管控 FA-15 后新增的"权限门禁一致性/前端禁吞错"不直接相关

## 1. 问题

供应商（partner）在后台上传中文产品画册 PDF → 存到 `public/uploads/suppliers/catalogs/` → 在**公开供应商详情页**按 slug 展示给 AE 客户。两个问题：

1. **看不懂**：AE 站是英文/阿语受众，画册是中文。
2. **泄露真身**：画册里印着真实中文厂名/电话/微信/二维码，绕过 FA-14 的去标识策略直接泄露。而且 `uploadCatalogFile` **把原始文件直接写进 public URL**——中文原件本身就对外裸奔。

现状：`supplier_catalogs` 已有 **68 行**，表结构仅 `id, supplier_profile_id, title, file_url, file_size, created_at`（无审核/去标识状态字段）。这 68 份是存量泄露，需 backfill。

## 2. 目标 / 非目标

**目标**
- 供应商上传后，后台**自动**产出一份「去标识 + 英文」的画册版本，经**人工待审**后才公开。
- 原始中文件**永不公开**（改存私有目录）。
- 抹掉：本供应商已知中文厂名（`name_zh` 等）、电话、微信、邮箱、网址、二维码；通用兜底覆盖未登记的联系方式。
- 存量 68 份纳入同一流程（先下线公开→处理→待审→重新公开）。

**非目标（YAGNI / 现实边界）**
- ❌ 不把英文"印回"产品图（图片型画册重排英文会糊、错位，效果差）。产出形态是**去标识后的画册图 + 每页英文文本**（旁置，可搜索、利于 AI 收录）。
- ❌ 不追求 100% 自动抹干净——OCR 会漏艺术字/低清/被图案遮挡的字，画册还可能有未登记的分公司名/业务员电话。**人工待审是设计的一部分，不是可选项**（FA-14 教训）。
- ❌ 不做实时同步处理（CPU 密集，会卡上传/抢网页算力）。

## 3. 架构

异步后台队列，仿现有 `server/dist/lib/variantWorker.js`（图片变体 worker）模式。

```
供应商上传 PDF
  │
  ▼ ① 存原始文件到「私有」目录 (server 本地，非 public/uploads) —— 不再公开
  ▼ ② supplier_catalogs 记 status='processing'，立即返回（不阻塞上传）
  ▼ ③ 后台 worker 排队（一次一个，低优先级，不与网页抢 CPU）：
       ├─ 逐页渲图         pdftoppm (poppler) → PNG，限 DPI/页数上限
       ├─ 本地 OCR         tesseract chi_sim+eng → 每词文字 + 像素坐标框 (TSV)
       ├─ 抹名（核心可靠性点）：
       │    · 精确匹配【本供应商已知身份串】：name_zh / company_name / 联系字段（DB 已存）
       │    · 通用兜底：电话正则(1[3-9]\d{9}/+86/座机)、邮箱、URL、微信号(微信/wx/WeChat)、二维码(zxing/jsQR)
       │    · 命中的坐标框 → sharp 涂黑矩形
       ├─ 翻译            页面图 → Gemini vision（gemini-image skill）→ 每页英文文本
       └─ 产出：去标识版画册图（合并回 PDF 或多图）+ translated_text(JSON/每页)
  ▼ ④ status='pending_review' → admin 在供应商后台目视核查抹干净没
  ▼ ⑤ 通过 → status='approved' 公开；只暴露去标识版，原始件永不公开
```

**为什么抹名可行**：不是"猜哪些字是名字"，而是"找这几个**已知**字符串"——供应商注册时就填了真实中文名和联系方式（FA-14 已存 `name_zh` 等）。已知串匹配 + 通用模式兜底，比泛 PII 检测可靠得多。残余风险（未登记的名/OCR 漏字）由待审兜底。

## 4. 数据模型改动

`supplier_catalogs` 增列（迁移脚本，需同步生产）：
- `status` ENUM('processing','pending_review','approved','failed') DEFAULT 'processing'
- `original_file_url` VARCHAR —— 私有原始件路径（不经 public）
- `redacted_file_url` VARCHAR NULL —— 去标识版（对外只给这个）
- `translated_text` JSON NULL —— 每页英文文本
- `processed_at` DATETIME NULL / `process_error` TEXT NULL
- `redaction_meta` JSON NULL —— 命中了哪些敏感串/框（供审核页高亮、可复核）

公开接口 `listCatalogs`：`WHERE status='approved'`，只返回 `redacted_file_url` + `translated_text`，**绝不返回 original**。

## 5. 依赖 & 部署

- 服务器安装：`poppler-utils`（pdftoppm）、`tesseract`+`tesseract-langpack-chi_sim`（Alibaba Cloud Linux 3，yum）。
- Node 侧：复用应用内 `sharp`；QR 用 `jsqr`/`zxing`；Gemini 走已接入的免费档。
- 私有目录：`/tarmeer/tarmeer_api/private/catalogs/`（不在 nginx `/uploads/` alias 下）。
- 后端 `server/dist/` 改动 → rsync + `pm2 restart tarmeer-api`（AGENTS.md 规则）。

## 6. 边界与风险（必须交底）

| 风险 | 缓解 |
|------|------|
| OCR 漏字 → 名字没抹干净（P0 泄露） | **人工待审强制闸**；审核页高亮已抹区，人工补抹；未过审绝不公开 |
| 原始中文件仍公开 | 上传即改存私有目录；存量 68 份先批量下线再处理 |
| CPU 抢占网页算力 | 单并发队列、限页数/DPI、可 nice 降优先级；大文件降级为"仅待审人工处理" |
| Gemini 免费额度/速率限制 | 队列限速、失败重试、翻译失败不阻塞去标识（去标识是 P0，翻译可后补） |
| 建材术语翻译不准 | 待审时人工可改英文文本 |
| 国家隔离 | 供应商去标识已按国家（FA-14）；catalog 归属随 supplier_profile.country |

## 7. 分期

- **Phase 0 · Spike（先验可行性，1 份真实画册）**：取生产 68 份里的 1 份图片型画册 → 手跑 pdftoppm+tesseract → 验证"能否在 OCR 结果里定位到该供应商的已知中文厂名坐标"。**验不过 = 整个自动抹名前提不成立**，则退化为"仅渲图+人工框选抹名"。先做这个再决定后续。
- **Phase 1 · 去标识 + 待审闸**（P0 安全）：私有存储 + status 流转 + worker 渲图/OCR/已知串抹名 + 供应商后台审核页 + 公开接口只给 approved。存量 68 份下线并跑一遍。
- **Phase 2 · 翻译**：Gemini 每页英文文本，旁置展示；待审可改。
- **Phase 3（可选）**：通用兜底增强（二维码/未登记名的启发式）、批量重处理工具。

## 8. 测试

- Spike 产出：真实画册的 before/after 截图（名字是否被定位/涂黑）。
- 单元：已知串匹配→坐标→涂黑矩形正确；公开接口不返回 original / 非 approved 不出现。
- 回归 harness：`listCatalogs` 只返回 approved 且无 `original_file_url` 泄露；接入 smoke-test。
- 人工：真机上传一份中文画册走完 上传→处理→待审→核查→公开，curl 公开页 grep 真实厂名/电话应 0 命中（FA-14 式验证：查页面源码 + /api JSON 原始值）。
- 三轮代码审查（AGENTS.md 第六步之二）。

## 9. 待办（进入实施计划前）

1. 写实施计划（writing-plans）。
2. Phase 0 spike 先行，结果回报用户再决定 Phase 1 细节。
