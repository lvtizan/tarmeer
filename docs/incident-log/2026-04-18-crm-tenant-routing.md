# Incident: Company Leads Routed to Wrong CRM Tenant

**Date:** 2026-04-18  
**Severity:** Medium — data integrity issue, no downtime  
**Affected:** 47 company leads pushed to homeowner CRM tenant

## What happened

装企表单提交后，`companyLeadController.ts` 将镜像行写入 `design_inquiries` 的同时，额外调用了 `pushLeadToCRM()`（业主租户）。CRM 按 `tenantId` 区分身份，装企线索因此落入业主租户，在 CRM 里显示为「业主」。

典型症状：Hafiz Abdul Basit、Yasir Sarfraz 在网站是装企，进 CRM 却变成业主。

## Root cause

生产部署代码中存在一段**未提交到 git 的逻辑**（历史遗留）：

```javascript
// 生产 dist/companyLeadController.js 第 42 行（修复前）
// Sync the mirrored inquiry to CRM so it shows '已同步' in admin
pushLeadToCRM({ inquiryId: mirrorId, ... })  // ← 错误：用了业主租户接口
```

这段代码不在任何 git commit 里，是在某次直接编辑生产文件时引入的。

## Detection

查询生产 DB，发现所有 `message LIKE '[Company Inquiry]%'` 的行均有 `crm_sync_attempts=1`，且 `crm_synced_at` 与 `created_at` 相差 < 1 秒，证明是 INSERT 时同步触发的，而非手动操作。

## Fix

`companyLeadController.ts` 镜像 INSERT 改为直接设 `crm_sync_status='synced'`，不调用任何 CRM push 函数。`pushCompanyLeadToCRM()`（装企租户）保持不变。

```typescript
// 修复后：mirror row 直接标 synced，不触发任何 CRM push
pool.execute(
  `INSERT INTO design_inquiries (..., crm_sync_status) VALUES (?, ?, ?, ?, ?, ?, 'synced')`,
  [...]
).catch(() => {});
// pushCompanyLeadToCRM 仍在下方，推装企租户 ✅
```

## Impact

| 状态 | 数量 |
|------|------|
| 被错推到业主租户 | 47 |
| 未受影响 | 5 |
| 合计装企镜像行 | 52 |

历史 47 条记录在业主 CRM 里身份错误，需 CRM 侧人工订正或迁移。

## Verification

修复后新提交的装企表单，`design_inquiries` 镜像行应满足：
- `crm_sync_status = 'synced'`
- `crm_sync_attempts = 0`
- `crm_lead_id = NULL`

自动化测试：`node scripts/harness/test-crm-routing.mjs`（7/7 PASS）

## Prevention

1. **不要直接编辑生产 dist 文件** — 所有改动必须走 git → build → deploy
2. **CRM tenant 路由规则**：装企线索只走 `pushCompanyLeadToCRM`，`pushLeadToCRM` 只用于 `design_inquiries` 原生行（业主询盘）
3. Harness `test-crm-routing.mjs` 覆盖此场景，部署前必跑
