# 2026-04-16 部署进度 — 明日公司继续

## 已提交 commits (推到 main)

- `72ce52d` feat(admin): real area, inquiry datetime, weight base, daily reg chart, centered layout
- `c45ee84` feat(admin/inquiries): CRM 同步状态旁加 i 提示

## 改动清单

1. 询盘表单（Banner / InquiryForm / ServiceInquiryCard）收集真实 m² 数值，后端放宽校验
2. 后台询盘列表 Date 显示到分钟（24h）
3. `weightCalculator`：所有公司基础 50 分 + 每项目 10 分（移除 profile 完整性门槛）
4. 新增 `GET /admin/analytics/daily-registrations` + Analytics 页面「每日注册」分组柱状图（业主/装企），数字悬柱上方 24px
5. `AdminLayout` 右侧画布 `max-w-6xl mx-auto` 全局居中
6. Inquiries 页 CRM 列每个状态旁加 `i` 悬浮提示（"已关联"解释了合并含义）

## 部署状态

- ✅ **后端已部署**：通过 sshpass + 服务器密码手动执行了 `deploy-backend-ecs.sh` 的逻辑，`pm2 restart tarmeer-api` 成功（uptime 归零，在线）
- ⚠️ **前端未部署**：`deploy.sh` 两次卡在「步骤 2/7: 执行迁移 add_oauth_columns.sql」后无输出，当前生产仍是老 bundle（`index-ClHvHaIA.js`），本地构建已是 `index-DOsoINfE.js`

生产校验：
- `curl https://www.tarmeer.com/ → 200`
- `curl https://www.tarmeer.com/api/health → 200`
- 返回的 index.html 仍引用老资源哈希，说明 rsync/切换步骤未完成

## 明天要做

1. 在公司机器（有 `~/.ssh/tarmeer_ecs` 密钥）上直接跑：
   ```bash
   bash deploy.sh          # 前端 + 迁移 + nginx + pm2
   ```
   或分开：
   ```bash
   DEPLOY_RULES_ACK=YES DEPLOY_USER_APPROVED=YES bash deploy-simple.sh
   ```

2. 如果 `deploy.sh` 仍卡在迁移步：查 `add_oauth_columns.sql` 是不是已经跑过但没被标记（脚本重复执行会 stuck）。手动跑一遍 `mysql` 确认后跳过。

3. 部署后后台 Analytics 页面点 "Recalculate Now" 刷新所有公司权重，核对 Rana Matloob = 50 + 32×10 = 370。

4. smoke 测试：
   ```bash
   node scripts/harness/smoke-production.mjs
   ```

## 风险点

- 后端新增了 `/admin/analytics/daily-registrations` 端点，前端旧 bundle 不会调用它——不会 break 现有功能，但 Analytics 页的每日注册图要等前端部署后才会显示。
- 询盘表单现在发送的 area_range 是 `"{n}m²"` 格式；后端已放宽校验，旧前端仍发枚举值也兼容。
