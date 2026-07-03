---
name: tarmeer-dynamic-data
description: Tarmeer 动态数据禁硬编码——后台可配置的数据（问卷 schema、分类、枚举、城市白名单）前端必须动态获取或保持双端同步。适用于：新增/修改任何下拉选项、分类、问卷字段、枚举值；症状触发：询盘/表单提交 400（城市白名单不同步）、后台加了新分类前台不显示、问卷字段填了却看不见。
---

# 动态数据禁硬编码

## 何时不用本技能

- 真正的编译期常量（品牌色、布局尺寸、路由路径）→ 硬编码没问题，见 `tarmeer-ui-conventions`
- schema 数据显示异常排查 → `tarmeer-debugging`

## 为什么这是铁律

硬编码后台可配数据会导致**静默数据丢失**：DB 加了字段/分类，前端硬编码列表没更新 → 新数据不显示、用户填的内容"消失"、且没有任何报错。这是本仓库反复发生的痛点。

## 第一等级：绝对禁止硬编码（有 API 就必须用）

**问卷 schema**：section 标题、field key、label、options **一律禁止**硬编码在任何前端文件（问卷页、admin 访谈详情页、任何地方）。唯一权威：DB 表 `survey_schema`，接口 `GET /api/field/survey-schema`。所有渲染问卷数据的组件必须从该接口取，仅当 API 返回 null 才允许最小 fallback——"最小"= 空态/骨架屏级别，**禁止 fallback 里塞一份硬编码的 schema 副本**（那等于把禁令原样违反了一遍）。

**后台枚举**：admin 有 `enums` 管理页（`src/app/admin/enums/page.tsx`）。凡后台能配置的枚举，前端从接口取，不抄一份死列表。

## 第二等级：暂时硬编码，但改动必须双端同步（已知债务）

以下数据当前是前端硬编码，**每次改动必须检查所有同步点**；有机会时应推动改为 API 化：

| 数据 | 前端位置 | 必须同步的后端/其他位置 |
|------|---------|----------------------|
| 服务分类 `SERVICE_CATEGORIES` / `SPACE_TYPES` | `src/lib/serviceCategories.ts` | admin 建立的分类名是权威（历史上有 revert ed0b91356 就因前端擅改分类名）；后端过滤逻辑 |
| 询盘城市白名单 | 前端城市下拉 | `server/dist/controllers/inquiryController.js` 的 `VALID_CITIES`——**前端加城市后端没加 = 用户提交直接 400**（VN 城市踩过） |
| 供应商常量 | `src/lib/supplierConstants.ts` | 对应后端校验 |
| 标签体系 | `src/lib/tagTaxonomy.ts` | 后端 tagEngine（`server/dist/services/tagEngine/`） |

## 操作规程

新增/修改一个"选项类"数据时：

1. 先问：这个数据后台能配吗？有接口吗？→ 有就走接口，删掉硬编码。
2. 没接口：Grep 该数据在 `src/` 和 `server/dist/` 的**全部**出现点（前端下拉、前端校验、后端白名单、后端过滤、admin 显示），列清单逐一改。
3. 改完跑 `tarmeer-verification` 相关 harness；涉及国家的选项（如 VN 城市）跑 country-walkthrough。
4. 提交时所有同步点进**同一个 commit**（`tarmeer-change-control`）。

## 姊妹文档

问卷字段丢失排查 → `tarmeer-debugging`；硬编码 schema 的历史事故 → `tarmeer-failure-archaeology` FA-11。
