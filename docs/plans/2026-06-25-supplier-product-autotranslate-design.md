# 供应商产品内容自动翻译（免费、无 token）— 设计文档

> 日期：2026-06-25 ｜ 状态：已确认，待实现 ｜ 承接 [[2026-06-24-supplier-product-price-design]]

## 需求
供应商上传产品时填的**名称/描述**（多为中文）需在官网以站点语言展示。用**免费翻译端点**（无 LLM token）写入时翻译，供应商可在表单审核/修改译文后提交。

## 决策（用户确认）
| 决策点 | 结论 |
|--------|------|
| 翻译服务 | Google 免费端点 `translate.googleapis.com/translate_a/single?client=gtx`（无 key、免费，生产服务器已实测可达，zh→en/vi/ar 质量够用） |
| 目标语言 | 只翻**站点语言**：供应商 country=ae→`en`，vn→`vi`（按 `supplier_profiles.country`） |
| 触发 | 供应商在表单填完名称/描述**失焦自动翻译**填入译文框（空时自动填）+「重新翻译」按钮；**译文框可编辑** |
| 字段 | 产品**名称 + 描述**（品类是枚举、已本地化，不翻） |
| 存储 | 原文存 `title`/`description`（不变），译文存新列 `title_translated`/`description_translated` |
| 容错 | 翻译失败返回原文、绝不阻断保存 |
| 展示 | 公开详情页显示 `译文 || 原文`；供应商自己后台卡片显示原文 |

## 数据库
`supplier_products` 加（autoMigrate 幂等）：
- `title_translated VARCHAR(255) NULL`
- `description_translated TEXT NULL`

## 后端
1. **翻译工具** `translateText(text, target)`（controller 内或 lib）：node 全局 `fetch` 调 Google 端点，`AbortController` 设 8s 超时；解析 `data[0]` 各段 `seg[0]` 拼接；任何异常 → 返回原 text（容错）。
2. **端点** `POST /suppliers/me/translate`（鉴权）：body `{ text }` → 查供应商 country → 目标 lang(ae→en/vn→vi) → translate → `{ translated }`。空 text 直接回空。
3. `addProduct`/`updateProduct`：接收并存 `title_translated`/`description_translated`（`SELECT *` 回读已含）。

## 前端（供应商表单 `products/page.tsx`）
- state：`newTitleEn`、`newDescEn`。
- 名称框下加可编辑「译文」框；描述框下同。
- 名称/描述失焦 → 若译文框为空，调 `/suppliers/me/translate` 自动填；「重新翻译」按钮强制重译。翻译中显示 loading 态。
- 提交 body 加 `title_translated: newTitleEn`、`description_translated: newDescEn`。
- 重置/取消时一并清空。

## 公开展示（`SupplierDetailClient.tsx`）
- `interface Product` 加 `title_translated`、`description_translated`。
- 卡片：`{p.title_translated || p.title}`、`{p.description_translated || p.description}`。

## 测试
- 端到端：`POST /me/translate`(中文,ae供应商) → 200 且 `translated` 非空；addProduct 带译文 → 落库 `title_translated`。
- 单测：翻译响应解析函数（给定 Google 返回结构 → 拼出译文；异常 → 原文）。
- smoke + webpack build；部署后无头浏览器实测。

## 风险
- Google 免费端点非官方，可能限流/偶发失败 → 已容错（回原文）。按产品逐条调用、量小，限流概率低。
- 机翻质量：靠"供应商可改"兜底。
