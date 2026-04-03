# Local Real Flow Test Cases

## Scope

这份清单用于本地先把真实业务链路跑顺，再上 `staging.tarmeer.com` 做联调。

当前优先覆盖：

- 邮箱注册
- 邮箱登录
- 账号升级后的作品集上传
- Google 登录前置检查

---

## Preconditions

### Local services

- 前端运行在 `http://127.0.0.1:5173`
- 后端 API 已启动，并且 `/api/auth/login`、`/api/projects` 可用
- 本地 MySQL 可连接，测试库为 `tarmeer`

推荐启动方式：

```bash
npm run dev
npm run backend:up
```

### Google OAuth

本地无法先“猜”Google OAuth 是否可用，必须在 Google Cloud Console 明确配置当前 origin。

最少包含：

- `http://127.0.0.1:5173`
- `http://localhost:5173`

如果后端使用服务端回调，也要同步配置 callback URI。

---

## Automated Smoke

自动化最小集：

- `tests/local-real-auth-portfolio.smoke.spec.ts`

覆盖内容：

- 两步式邮箱注册 UI 冒烟
- 真实邮箱登录
- 进入 `/dashboard/upload`
- 上传真实图片
- 保存草稿
- 跳转保持在 `/dashboard/upload/:id`
- 在 `/dashboard/projects` 看见新草稿

运行命令：

```bash
npx playwright test tests/local-real-auth-portfolio.smoke.spec.ts
```

---

## TC-LOCAL-01: Email Registration

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 打开 `/auth` | Auth 页面正常加载 |
| 2 | 输入全新邮箱 | 右侧出现 `New account` |
| 3 | 点击 `Continue with email` | 进入密码步骤 |
| 4 | 输入密码并点击 `Continue` | 显示 `Check Your Email` |

验证点：

- [ ] 当前两步式 Auth UI 可正常判断新邮箱
- [ ] 注册成功后显示邮箱验证提示

---

## TC-LOCAL-02: Existing Designer Login

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 打开 `/auth` | 页面正常加载 |
| 2 | 输入已存在邮箱 | 右侧出现 `Existing` |
| 3 | 输入密码并继续 | 跳转到 `/dashboard` |

验证点：

- [ ] 旧账号不会被误判为注册
- [ ] 登录后 token 可用于后续上传接口

---

## TC-LOCAL-03: Portfolio Draft Upload

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 打开 `/dashboard/upload` | 上传页正常加载 |
| 2 | 填写标题、描述、风格、城市、面积 | 表单可用 |
| 3 | 上传本地真实图片 | 生成图片卡片预览 |
| 4 | 点击 `Save Draft` | 保存成功 |
| 5 | 检查当前地址 | 保持在 `/dashboard/upload/:id` |
| 6 | 打开 `/dashboard/projects` | 能看见新草稿 |

验证点：

- [ ] 至少 1 张图片才能保存
- [ ] 草稿保存后使用 dashboard 路由，不回退到旧的 `/designer/*`
- [ ] 草稿能在 My Projects 中看见

---

## TC-LOCAL-04: Google Login Readiness

这个场景建议先做手工检查，不建议在本地 Playwright 里强行自动化真实 Google 账号登录。

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 打开 `/auth` | `Continue with Google` 按钮可见 |
| 2 | 点击按钮 | 能跳转到后端 `/api/auth/google` |
| 3 | 若 origin/callback 已配置 | Google 授权页可正常拉起 |

验证点：

- [ ] 无 `invalid_client`
- [ ] 无 `origin_mismatch`
- [ ] 本地 origin 与 callback 均已配置

---

## Notes

- 当前本地自动化优先覆盖“可稳定复现”的真实链路。
- Google 登录、邮箱验证邮件点击、管理员审核通过等外部依赖流程，建议保留为手工回归项，再在 staging 补全端到端验证。
