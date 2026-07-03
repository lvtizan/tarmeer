---
name: tarmeer-change-control
description: Tarmeer 变更管控——写任何代码之前和提交之前的强制流程。适用于：新增/修改任何 src/ 或 server/dist/ 代码、准备 git commit、新建分支。本仓库无 CI，历史上多次"把做好的功能改坏"，本文档是第一道防线。
---

# 变更管控

## 何时不用本技能

- 只读代码、回答问题、不产生改动 → 不需要
- 改动已完成、要验收 → `tarmeer-verification`
- 要部署 → `tarmeer-deploy-frontend` / `tarmeer-deploy-backend`
- 想知道哪些功能是"锁定不许动"的 → `tarmeer-protected-features`（动手前必看）

## 动手前三查

1. **查锁定清单**：`tarmeer-protected-features` 里的功能（VN Footer 联系块、专家联系表单、问卷 schema 等）有逐条铁律，改之前逐条核对。
2. **查历史**：`git log --oneline -10 -- <目标文件>`。如果该文件近期被反复修改或 revert 过（如 PortfolioClient 的 filter bar、SupplierDetailPage），说明有你不知道的隐性约束——先读 `tarmeer-failure-archaeology` 里的对应案例，再决定方案。
3. **查国家维度**：改动涉及任何列表/查询/写入？→ 先过 `tarmeer-country-isolation`。

## 修改逻辑 = 全量搜索后统一修正（铁律）

凡是修改某个逻辑（字段同步、格式化、校验、状态变更），必须先 Grep 整个 `server/dist/` 和 `src/` 找出所有涉及该逻辑的位置，逐一判断、统一修正，**不得只改一处**。
反面教材：修 partnerSync 缺 phone，只改了一处 `UPDATE company_profiles`，其余调用点仍旧缺字段。

## 提交纪律

| 规则 | 原因（真实踩坑） |
|------|----------------|
| 引用了新类型/新字段的文件，**类型文件必须同一个 commit 提交** | 否则本地绿、生产 build 失败（本地有未提交的 types.ts） |
| 动态路由页面 params 键名必须与目录名 `[xxx]` 完全一致 | interface 里另起名字 = build 期类型错误 |
| 新建 pre-commit hook / harness 脚本前，确认 hook 引用的脚本存在 | hook 引用不存在的脚本 = 所有 commit 被阻断 |
| 一个 commit 只做一件事，禁止把无关改动打包 | 历史上大 revert（supplier 详情页整页回滚 5f26227d6）都因混合改动而代价放大 |
| commit message 格式 `type(scope): 描述`，与现有 1700+ commit 保持一致 | git 考古依赖这个格式 |

## 分支纪律

- 当前主线：`main`；工作分支示例：`app-prep`。新功能开新分支，**合并回 main 前必须跑完 `tarmeer-verification` 全绿**。
- 已死分支（`seo-portfolio`、`weight-system`、`harness-engineering`，2026-04 起无活动）**不要基于它们开新分支**，也不要恢复其中代码而不了解当初为何停摆——先问用户。
- 分支名用英文 kebab-case（历史上有中文分支名，可读但工具链不友好，不再新增）。

## 防"改好的功能被改坏"（回归守则）

1. 改一个共享组件（`src/components/ui/`、`src/components/shared/`）前，先 Grep 所有引用点，列出受影响页面。
2. 涉及 UI 的改动，改完在受影响的**每个**页面自查，不只看当前开发的那个页面。
3. 大改现有页面 = 高危。历史上 for-companies 重设计、supplier 详情页重构都被整页 revert。优先增量小改；确需重构，先向用户确认再动。
4. 修完 bug 必须归档到 `tarmeer-failure-archaeology`（现象/根因/修复/预防规则），不归档 = 没修完。

## 姊妹文档

改完代码 → `tarmeer-verification`（自检全绿才能说"完成"）→ 对应 deploy 技能。
