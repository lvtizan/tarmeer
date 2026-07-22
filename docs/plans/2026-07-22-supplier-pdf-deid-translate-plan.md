# 供应商画册 PDF 自动去标识 + 翻译 — 实施计划

> **For Claude:** REQUIRED SUB-SKILL: 用 superpowers:executing-plans 逐任务实施。
> 设计文档：`docs/plans/2026-07-22-supplier-pdf-deid-translate-design.md`（先读）。

**Goal:** 供应商上传中文画册 PDF 后，后台异步产出「去标识（抹厂名/联系方式）+ 英文文本」版本，经人工待审后才公开；原始中文件永不公开。

**Architecture:** 上传即存私有目录 + 记 `status=processing` 立即返回 → 后台单并发 worker（仿 `variantWorker`）渲图/OCR/已知串抹名/Gemini 翻译 → `pending_review` → 供应商后台人工核查 → `approved` 才公开。

**Tech Stack:** poppler(pdftoppm) 渲图、tesseract(chi_sim) OCR 拿坐标、sharp 涂黑、jsqr/zxing 二维码、Gemini vision 翻译、MySQL、Express。

---

## ⚠️ 铁律（贯穿全程）
- **FA-14**：漏抹一个中文名/电话 = P0 泄露。人工待审闸不可省；公开接口只返回 approved 的 `redacted_file_url`，**绝不返回 original**。
- **AGENTS.md**：改 `server/dist/` → rsync + `pm2 restart tarmeer-api`；改产品源码走三轮审查 + smoke-test；新行为必加用例。
- **不乐观假设外部契约**：Phase 0 spike 未过，不进 Phase 1。

---

## Milestone 0 · 可行性 Spike（先做，非破坏性，本地跑）

**目的**：用 1 份真实图片型画册，验证"本地 OCR 能否定位到该供应商的已知中文厂名坐标"。验不过 → 自动抹名前提不成立，退化为"渲图 + 人工框选抹名"，需回报用户改方案。

**不碰生产**：只从生产**下载** 1 份 catalog 文件到本地 `/tmp`，本地跑 poppler+tesseract。

### Task 0.1：本地装工具 + 取样本
**Step 1** 本地装依赖（mac）：`brew install poppler tesseract tesseract-lang`（含 chi_sim）。验证 `pdftoppm -v`、`tesseract --list-langs | grep chi_sim`。
**Step 2** 从生产库挑 1 份图片型画册的 `file_url` + 对应 supplier 的 `name_zh`：
```
ssh ... "cd /tarmeer/tarmeer_api && node -e '<查 supplier_catalogs join supplier_profiles 取 1 条 file_url,name_zh,company_name>'"
```
**Step 3** `scp` 该 PDF 到本地 `/tmp/spike/`。

### Task 0.2：渲图 + OCR + 定位已知名
**Step 1** `pdftoppm -png -r 150 /tmp/spike/x.pdf /tmp/spike/page` → 逐页 PNG。
**Step 2** 对每页 `tesseract page-N.png out -l chi_sim+eng tsv` → 拿 word+bbox 的 TSV。
**Step 3** 写一次性脚本 `scripts/spike/locate-name.mjs`：读 TSV，在识别文本里查 `name_zh`/`company_name`/电话正则，命中则输出页码+坐标框；用 sharp 在该页画红框输出 `page-N-marked.png` 供目视。
**Step 4** 人看 `-marked.png`：厂名/电话是否被框中？记录命中率。

### Task 0.3：回报用户 + 决策门
- 命中可靠（能框住名字）→ 进 Milestone 1。
- 命中差（艺术字/低清漏识）→ 回报用户，方案退化为"渲图去标识版 + 待审页人工框选涂抹"，Gemini 仍可翻译。**等用户拍板再继续。**

> Spike 产出（before/after 标注图 + 命中率）附在回报里。**Milestone 1 之后的详细 bite-sized 任务待 spike 结果确定后再展开**（避免在未验证假设上写死步骤）。

---

## Milestone 1 · 去标识 + 待审闸（P0 安全）— 骨架（spike 过后细化）

1. **DB 迁移**：`supplier_catalogs` 加 `status / original_file_url / redacted_file_url / translated_text / processed_at / process_error / redaction_meta`。迁移脚本本地+生产各跑一次（`tarmeer-database-ops`：先确认 DB_HOST）。
2. **服务器装依赖**：`yum install poppler-utils tesseract tesseract-langpack-chi_sim`（需用户批准在生产装包）。
3. **上传改私有**：`uploadCatalogFile`/`uploadCatalogChunk` 改存 `/tarmeer/tarmeer_api/private/catalogs/`（非 public），记 `original_file_url`；`uploadCatalog` 建行 `status=processing` 并入队。
4. **worker**：新增 `lib/catalogWorker.js`（仿 `variantWorker`，单并发队列）：渲图→OCR→已知串+通用兜底抹名(sharp 涂黑)→合回 PDF→写 `redacted_file_url`/`redaction_meta`→`status=pending_review`；失败写 `process_error`/`status=failed`。
5. **审核页**：供应商后台（或 admin）catalog 列表显示 status；待审项展示去标识版 + `redaction_meta` 高亮，人工可补抹/通过/打回。
6. **公开接口收口**：`listCatalogs` → `WHERE status='approved'`，只返回 `redacted_file_url`(+ 后续 translated_text)，**永不返回 original**。
7. **存量 68 份**：先批量 `status` 置非 approved（下线公开）→ 逐份跑 worker → 人工过审。
8. **回归**：harness 断言公开 catalog 不含 original / 非 approved 不出现；接入 smoke-test。FA-14 式验证：curl 公开页 grep 真实厂名/电话 = 0。

## Milestone 2 · 翻译（Gemini）
- worker 增翻译步：页面图 → Gemini vision → 每页英文 → `translated_text`。失败不阻塞去标识（P0 优先）。审核页可改译文。公开页旁置展示英文。

## Milestone 3（可选）
- 通用兜底增强（二维码 zxing、未登记名启发式）、批量重处理工具。

---

## 测试与门禁
- 每 Milestone：smoke-test 全绿 + 新行为加用例 + 三轮代码审查（第六步之二）。
- 部署：后端 rsync+`pm2 restart tarmeer-api`；前端 `next build` 验 BUILD_ID。
- 完事归档 FA + 更新 `tarmeer-image-pipeline`/`domain-specifics` 技能。
