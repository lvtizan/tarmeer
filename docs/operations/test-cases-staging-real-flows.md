# Staging Real Flow Test Cases

## Scope

This checklist is for `staging.tarmeer.com` when the team needs to test real business flows before promoting changes to `www.tarmeer.com`.

Target flows:

- Email registration
- Google OAuth login
- Account creation
- Designer profile completion
- Portfolio upload
- Public visibility after upload

---

## Preconditions

- `staging.tarmeer.com` is deployed and reachable
- Staging uses the intended API environment for this round of testing
- Google OAuth has registered:
  - `https://staging.tarmeer.com`
- If Google callback is handled server-side, the matching callback URI is also registered
- A test image set is prepared locally for upload verification

---

## TC-01: Email Registration on Staging

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 打开 `https://staging.tarmeer.com/auth` | Auth 页面正常加载 |
| 2 | 使用全新邮箱注册 | 成功创建账号 |
| 3 | 完成邮箱验证 | 验证成功 |
| 4 | 登录后进入 dashboard | 正常进入用户/设计师后台 |

**验证点**:
- [ ] staging 可真实注册
- [ ] 邮箱验证链路可用
- [ ] 新账号 session 正常

---

## TC-02: Google OAuth Login on Staging

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 打开 `/auth` | Google 按钮可见 |
| 2 | 点击 `Continue with Google` | 成功跳转 Google |
| 3 | 选择未注册 Google 账号 | 创建新账号 |
| 4 | 选择已注册 Google 账号 | 登录已有账号 |

**验证点**:
- [ ] 无 `401 invalid_client`
- [ ] 无 `no registered origin`
- [ ] 首次/再次登录都正常

---

## TC-03: Designer Profile Completion

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 进入 `/designer/profile` | 页面正常 |
| 2 | 上传头像 | 头像预览正常 |
| 3 | 填写个人资料 | 文本输入正常 |
| 4 | 保存 | 成功提示出现 |
| 5 | 刷新 | 数据仍然存在 |

**验证点**:
- [ ] 头像持久化
- [ ] 文本资料持久化
- [ ] 无 403 / 数据截断错误

---

## TC-04: Portfolio Upload

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 进入 `/designer/upload` | 上传页正常 |
| 2 | 填写标题、描述、风格、地点、面积、年份 | 表单正常 |
| 3 | 上传真实图片 | 预览正常 |
| 4 | 设为 cover | cover 状态更新 |
| 5 | 发布作品 | 发布成功 |

**验证点**:
- [ ] 图片可上传
- [ ] 发布可成功
- [ ] 无重复图/超限异常

---

## TC-05: Post-Upload Visibility

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 进入 `My Projects` | 可见新项目 |
| 2 | 打开项目详情 | 内容、图片、封面正确 |
| 3 | 如项目应公开，访问公开页 | 可见新项目 |

**验证点**:
- [ ] 设计师端可见
- [ ] 公开端可见性符合预期

---

## Recommended Test Accounts

- 1 个全新邮箱账号
- 1 个已存在邮箱账号
- 1 个未注册 Google 账号
- 1 个已注册 Google 账号

---

## Release Gate

Only promote staging changes to production when:

- [ ] TC-01 ~ TC-05 全部通过
- [ ] 关键视觉页面无明显回归
- [ ] 固定业务配置通过 [`docs/operations/test-cases-site-config.md`](/Users/kp/Code/tarmeer-4.0-local/docs/operations/test-cases-site-config.md)
