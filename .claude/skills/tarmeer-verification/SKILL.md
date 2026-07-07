---
name: tarmeer-verification
description: Tarmeer 验收标准——"完成"的唯一定义。适用于：任何代码改动写完之后、准备向用户报告"做完了"之前、部署之前。本仓库无 CI，harness 全绿是唯一的质量闸门。报告必须附测试结果（如 14/14 PASS）。
---

# 验收标准（全绿才算完成）

## 何时不用本技能

- 还没开始写代码 → `tarmeer-change-control`
- 纯文档/纯咨询类任务 → 不需要跑 harness，但事实性内容仍需核对
- 自检失败要排因 → `tarmeer-debugging`

## 铁律

**写完代码 → 为本次改动建/补用例 → 自测全绿 → 才能告知用户"完成"。报告必须附测试结果。任何一项失败 / 任何新行为没有用例 = 不能声称"完成"。**

## 三轮代码审查（强制门禁，用例全绿之后追加）

**用例全绿 ≠ 代码质量过关**（2026-07-07 教训：tsc/build 全绿的 GEO 改动仍埋了串域/注入/垃圾 URL 4 个缺陷）。凡改产品源码（`src/`、`server/`）或要交付/上线的代码，声称"完成"前必须过三轮代码审查——每轮用独立子代理（`superpowers:code-reviewer` 或 `/code-review`）审本次 diff，发现→修→复审到该轮清白再进下一轮：

1. **规格+安全对抗**：做没做对 spec + 国家隔离泄漏 / `dangerouslySetInnerHTML` 注入(用户自填文本必转义 `<`) / 拼 URL 垃圾(电话号·相对路径直接拼协议) / null·边界 / 软 404
2. **复审+质量**：复核第1轮修复无回归 + 命名/DRY/复用既有 helper/死代码/魔法值
3. **整体+遗漏**：集成一致(同一实体 `@id` 统一) + 真实渲染/构建 + before/after 成立 + "哪个改动没被验证"

报告必须附三轮结论。三轮未过 = 不能声称"完成"、不能部署。详见 AGENTS.md 第六步之二。

## 按改动类型必跑项（可叠加）

| 改动类型 | 必跑 |
|---------|------|
| 任何代码改动 | `node scripts/harness/smoke-test.mjs`（tsc --noEmit + 后端路由存在性(期望401非404/500) + 方法支持） |
| 国家相关 / 用户侧写入口 / admin 过滤 | `node scripts/harness/country-walkthrough.mjs`（UC1–UC23 国家归属用例，以脚本实际输出为准；docs/testing/country-bucketing.md 只列到 UC12，是旧文档） |
| 外勤/问卷功能 | 附件上传→`field-attachments-test.mjs`；问卷编辑→`field-edit-test.mjs`；其余问卷逻辑→`field-other-test.mjs`；拿不准就全跑 |
| 空间类型筛选 | `scripts/harness/space-type-test.mjs` |
| App 认证相关 | `scripts/harness/app-auth.mjs` |
| 新功能 / 新行为 | **必须追加用例**（walkthrough 加 UC、smoke-test 加路由、或新建 harness 脚本），不允许只靠手测 |
| 要部署的前端改动 | 本地 `node_modules/.bin/next build` 验证 exit=0 |

## 环境前提与已知陷阱

- harness 依赖本地后端 3002 + 本地 MySQL `tarmeer` 库（`server/.env` DB_HOST=localhost）+ 前端 5180。
- **walkthrough 含注册接口，同一后端进程连跑两次会被限流 429** → 重跑前先重启本地后端。
- **本地跑过 `next build` 会覆盖 `.next`** → 跑完必须重启 5180 dev server，否则 dev 环境行为异常。
- 用例自检 = 模拟真实用户路径（写入 → 按预期视图查询断言），**不是 curl 一下 200 就完事**。

## 补充验证手段

- 集成测试：`node tests/company-lead-submit.mjs`、`node tests/feature-verify.mjs`（MySQL 直连断言）
- 全站体检：`node health-check-v2.mjs`（读 `site-checklist.json` 40+ 项：页面 200 / API 数据完整性 / 权限 401 / pm2 在线）
- UI 改动：受影响的**每个**页面人工过一遍（组件是共享的，别只看当前页）

## 报告格式

向用户报告完成时附上：跑了哪些脚本、各自 N/N PASS（脚本末尾的汇总行）、新增了哪些用例（编号 + 一句场景描述）。示例："smoke-test 22/22 PASS；country-walkthrough 23/23 PASS；新增 UC24：VN 新城市白名单校验。"

## 姊妹文档

全绿之后 → `tarmeer-deploy-frontend` / `tarmeer-deploy-backend`；失败排查 → `tarmeer-debugging`。
