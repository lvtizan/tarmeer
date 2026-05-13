# CRM × Mall 集成测试用例

## 功能范围

装企 CRM 开通与 SSO 登录集成：
- Admin 开通 CRM（provision）
- 装企侧边栏 Open CRM 入口（SSO）
- CRM→Mall 反向 SSO（`/api/integration/crm/sso/issue`）
- CRM 激活回调（`/api/integration/crm/partner/activated`）
- SSO token 消费页（`/sso/consume`）
- 改密同步（`passwordSync`）
- 档案更新同步（`partnerSync`）

## 自动化覆盖

运行：`node scripts/harness/test-crm-integration.mjs`

| TC | 路由 | 验证点 |
|----|------|--------|
| TC1 | POST /api/auth/company/crm-sso | 无 token → 401 |
| TC2 | POST /api/auth/company/crm-sso | 无效 JWT → 401/404 |
| TC3 | POST /api/admin/profile-companies/:id/crm-provision | 无 token → 401/403 |
| TC4 | POST /api/admin/profile-companies/:id/crm-provision | 非 admin JWT → 401/403 |
| TC5 | POST /api/integration/crm/sso/issue | 无 HMAC 头 → 401 |
| TC6 | POST /api/integration/crm/sso/issue | 错误签名 → 401 |
| TC7 | POST /api/integration/crm/partner/activated | 无 HMAC 头 → 401 |
| TC8 | POST /api/integration/crm/partner/activated | 错误签名 → 401 |
| TC9 | GET /api/sso/consume | 无 token 参数 → 400 |
| TC10 | GET /api/sso/consume | 无效 token → 400 |

## 手动测试用例

### M1：Admin 开通 CRM（审批后）

**前置条件：** 装企状态为 approved，crm_tenant_id 为空

**步骤：**
1. 进入 `/admin/profile-companies/:id`
2. 右侧侧边栏（桌面端）或卡片区（移动端）找到 CRM 卡片
3. 点击「开通 CRM」按钮

**期望：**
- 按钮显示「开通中…」（loading 态）
- 成功后 Toast 显示「CRM 已开通」
- CRM 卡片变为绿色「已开通」+「未激活」
- DB：`company_profiles.crm_tenant_id` 有值

### M2：Admin 开通 CRM（未审批时禁用）

**前置条件：** 装企状态为 pending

**步骤：** 查看 CRM 卡片

**期望：**
- 「开通 CRM」按钮为 disabled 状态（opacity-50）
- 卡片底部显示「审批通过后可开通」

### M3：装企侧边栏 Open CRM 入口（已开通）

**前置条件：** 装企 crm_tenant_id 有值，用公司账号登录

**步骤：**
1. 进入 `/company/dashboard`
2. 侧边栏（桌面）或底部导航（移动）查找 Open CRM 入口

**期望：**
- 侧边栏出现「Open CRM」按钮（ExternalLink 图标）
- 移动端底部导航出现「CRM」按钮
- 点击后在新标签页打开 CRM consumeUrl

### M4：装企侧边栏 Open CRM 入口（未开通）

**前置条件：** 装企 crm_tenant_id 为空

**步骤：** 进入 `/company/dashboard` 查看侧边栏

**期望：**
- 侧边栏和移动端导航均不显示 CRM 入口

### M5：SSO consume 页正常流程

**前置条件：** 有效的 SSO token（从 `/api/sso/consume` 生成）

**步骤：**
1. 访问 `/sso/consume?token=<valid_token>`

**期望：**
- 页面显示 PageSpinner（加载中）
- 自动跳转到 `/company/dashboard`（或 token 中的 redirectUrl）
- localStorage 中 `active_role` 设为 `company`

### M6：SSO consume 页 token 失效

**步骤：** 访问 `/sso/consume?token=invalid123`

**期望：**
- 页面显示错误信息「Invalid token」（或「SSO login failed.」）

### M7：SSO consume 页无 token 参数

**步骤：** 访问 `/sso/consume`（不带 token 参数）

**期望：**
- 页面显示「Invalid SSO link — missing token.」

### M8：Admin 角色列表 CRM 列

**步骤：** 进入 `/admin/roles`，切换到 Companies tab

**期望（桌面端）：**
- 表格有 CRM 列
- 未开通显示灰色「未开通」
- 已开通未激活显示绿色「已开通」+ 黄色「未激活」
- 已开通已激活显示绿色「已开通」+ 灰色「已激活」

**期望（移动端）：**
- 状态徽章下方显示「CRM 已激活」或「CRM 未激活」（仅已开通时显示）

### M9：改密同步（passwordSync）

**前置条件：** 装企已开通 CRM（crm_tenant_id 有值），配置有效 MALL_INTEGRATION_SECRET 和 CRM_BASE_URL

**步骤：** 装企用户在 `/company/settings` 修改密码

**期望：**
- 密码修改成功
- 后端 fire-and-forget 调用 CRM 密码同步接口（不影响前端响应速度）
- 日志中可见 `[CRM] passwordSync` 相关输出

### M10：档案更新同步（partnerSync）

**前置条件：** 装企已开通 CRM（crm_tenant_id 有值）

**步骤：** 装企用户在 `/company/profile` 更新公司资料并保存

**期望：**
- 资料保存成功
- 后端 fire-and-forget 调用 CRM 档案同步接口
- 未开通 CRM 的装企不触发同步

## 权限矩阵

| 操作 | 普通用户 | 装企用户 | Admin | SuperAdmin |
|------|---------|---------|-------|-----------|
| 开通 CRM（provision） | 403 | 403 | 200 | 200 |
| 获取 SSO token（crm-sso） | 401 | 200（已开通）/ 400（未开通） | 401 | 401 |
| CRM→Mall SSO issue（HMAC） | 401 | 401 | 401 | 401（需 HMAC） |
| CRM partner activated（HMAC） | 401 | 401 | 401 | 401（需 HMAC） |
| SSO consume | 400（无效）| 200（有效 token） | - | - |

## 边界情况

- token 已使用（consumed_at 有值）→ 400「Token already used」
- token 超过 5 分钟 → 400「Token expired」
- HMAC timestamp 偏差 > 300s → 401
- mallPartnerId 不存在 → 404
- crm_first_login_at 幂等写入：已有值时不覆盖
