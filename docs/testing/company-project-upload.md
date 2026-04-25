# 装企项目上传 — 测试用例

## 背景

`ProjectUploader` 组件（`src/components/ProjectUploader.tsx`）用于装企从 `/company/upload` 上传项目。

## 已知 Bug（待修复）

### Bug 1：Quick Publish 返回 "Not found"（主要报错）
- 触发：上传 1 张图片 + 不填 description/projectName → 点 "Quick Publish"
- 后端路由 `/api/projects/quick-upload` 不存在 → 404 → "Not found"

### Bug 2：所有路径图片都丢失
- `api.post(endpoint, formData)` 内部执行 `JSON.stringify(formData)` = `'{}'`
- 后端收到空 body，没有 images → 400 "At least one project image is required."

---

## 测试用例

### TC-01：Quick Publish 触发 404（复现已知 Bug）
**前提**：已登录装企账号，进入 `/company/upload`

**步骤**：
1. 上传 1 张图片
2. 不填 Description、Project Name
3. 点击 "Quick Publish"

**预期（修复前）**：显示红色 "Not found" 错误框
**预期（修复后）**：项目提交成功，跳转回上一页

---

### TC-02：多图 + 填写全部字段后提交
**前提**：已登录装企账号，进入 `/company/upload`

**步骤**：
1. 上传 3 张图片
2. 填写 Description："We do renovation work"
3. 填写 Project Name："Villa Dubai Hills"
4. 选择 Style："Modern"
5. 填写 Location："Dubai"
6. 填写 Area："150"
7. 点击 "Publish Project"

**预期（修复前）**：返回 400 "At least one project image is required."（FormData 被 JSON.stringify 成 `{}`）
**预期（修复后）**：项目创建成功，DB 中 `projects` 表有新行，`images` 字段有图片 URL

---

### TC-03：单图 + 填写字段后提交
**前提**：已登录装企账号，进入 `/company/upload`

**步骤**：
1. 上传 1 张图片
2. 填写 Description 和 Project Name
3. 点击 "Publish Project"（此时 isQuickMode = false，因为 description 有值）

**预期（修复前）**：返回 400（图片丢失）
**预期（修复后）**：项目创建成功

---

### TC-04：未登录状态提交
**前提**：清除 localStorage token，进入 `/company/upload`

**步骤**：
1. 上传图片，填写字段，点击提交

**预期**：返回 401 "Authentication token is required."，界面显示对应错误

---

### TC-05：项目保存到正确的 company_profile_id
**前提**：已登录装企账号（该账号在 `company_profiles` 有记录）

**步骤**：
1. 成功提交项目

**预期**：`projects` 表中新行的 `company_profile_id` = 该装企的 profile id，`designer_id = NULL`

---

## 修复验证

修复完成后用 node 脚本跑 TC-01 ~ TC-05，确认全部 PASS 后再部署。

修复涉及文件：
- `src/components/ProjectUploader.tsx`：删 isQuickMode，改用 base64 转换 + JSON 发送，字段名 `project_name` → `title`
