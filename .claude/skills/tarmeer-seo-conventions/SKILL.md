---
name: tarmeer-seo-conventions
description: Tarmeer SEO 约束——软 404、重定向、slug 体系。适用于：新增/修改公开页面（companies/experts/materials/services/guide）、处理详情页数据缺失分支、调整 URL 结构。
---

# SEO 约束

## 何时不用本技能

- admin/portal 等登录后页面 → 无 SEO 要求
- 页面收录异常排查 → 先 `tarmeer-debugging` 分诊

## 软 404 铁律

动态详情页（`/companies/[slug]`、`/experts/[slug]` 等）fetch 失败/数据不存在的分支**必须调用 `notFound()`**，禁止渲染 fallback UI。HTTP 200 的"软 404"不被 Google 收录，且污染索引。这是写进 AGENTS.md 的铁律。

## URL 与重定向体系（next.config.ts 维护）

已有 301 规则：`/@:slug` → `/companies/:slug`；`/designers/*` → `/companies/*`；`/showrooms` → `/materials`；`/home` → `/`；`/login` → `/auth` 等。

- **删除/改名公开页面时必须补 301**，不能让旧 URL 变 404
- slug 约定：VN 公司 slug 带 `vn-` 前缀（这同时是国家归属判定依据之一，见 `tarmeer-country-isolation`——改 slug 规则会连带影响数据归桶，慎动）

## 公开路由格局

`/companies`、`/experts`（含 `[slug]/[projectSlug]` 两级）、`/materials/suppliers/[slug]`、`/services/[service]/[city]`、`/guide/[slug]`、`/blog`、营销页（for-companies / for-suppliers / for-homeowners）。新增公开页面参考 `docs/plans/2026-05-28-seo-geo-phase1-*.md` 的地理聚类设计。

## 动态路由 params 命名

params 键名必须与目录名 `[xxx]` 完全一致，不得在 interface 里另起名字（build 期报错，见 `tarmeer-change-control`）。

## 注意

`seo-portfolio` 分支（SEO slug + company URLs）2026-04 起停摆未合并。其中的想法未必作废，但**不要直接 cherry-pick**——先与用户确认当初停摆原因。

## 姊妹文档

页面图片性能（LCP/CLS）→ `tarmeer-image-pipeline`；上线验证 → `tarmeer-verification`。
