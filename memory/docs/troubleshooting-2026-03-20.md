# Tarmeer 线上故障排查记录 — 2026-03-20

## 故障一：所有认证接口返回 401 "Invalid authentication token"

### 现象
- 登录成功后，所有需要认证的接口（GET `/api/projects/my`、PUT `/api/designers/7`）均返回 401
- 前端表现为：头像无法保存、作品集无法上传、个人资料页报错
- 错误信息极具误导性，让人以为是 JWT token 本身有问题

### 排查过程（走的弯路）
1. **怀疑 JWT_SECRET 不一致** — 逐一比对了 PM2 env、.env 文件、ecosystem.config.js、config 模块，全部一致 ❌ 不是原因
2. **怀疑 token 过期或格式错误** — 在服务器上直接 `jwt.sign` + `jwt.verify` 测试，完全正常 ❌ 不是原因
3. **怀疑 nginx 配置问题** — 检查了代理和 header 转发，均正常 ❌ 不是原因
4. **给 auth.js 加 debug 日志** — 终于发现真正的报错：`Unknown column 'deleted_at' in 'field list'`

### 根本原因
`server/src/middleware/auth.ts` 中的 SQL 查询引用了 `deleted_at` 字段：
```sql
SELECT id, email, deleted_at FROM designers WHERE id = ?
```
但生产数据库的 `designers` 表中 **没有这个字段**。MySQL 报错被 `catch` 块捕获后，统一返回了 `"Invalid authentication token."` 这个误导性错误。

### 解决方案
给生产数据库补上缺失的字段：
```sql
ALTER TABLE designers ADD COLUMN deleted_at DATETIME DEFAULT NULL;
```
在服务器上用项目自带的数据库连接执行（无需手动输密码）：
```bash
cd /tarmeer/tarmeer_api && node -e "require('./dist/config/database').default.execute(\"ALTER TABLE designers ADD COLUMN deleted_at DATETIME DEFAULT NULL\").then(()=>{console.log('OK');process.exit()}).catch(e=>{console.log(e.message);process.exit(1)})"
```

### 教训
- **catch 块不要吞掉错误信息**：auth middleware 的 catch 把数据库错误包装成了"token 无效"，导致排查方向完全偏离
- **数据库迁移要同步**：代码引用了 `deleted_at` 字段，但没有对应的数据库迁移脚本，部署时漏掉了建表/加字段操作
- **优先加 debug 日志**：遇到 401 排查时，应第一时间在 auth middleware 加详细日志，而不是反复猜测外部因素

---

## 故障二：Profile 保存报错 "Unknown column 'deleted_at' in 'where clause'"

### 现象
- auth 修复后登录正常，但点 Save Changes 保存个人资料时报错
- 错误信息：`Failed to save profile: Unknown column 'deleted_at' in 'where clause'`

### 根本原因
不止 auth middleware，`designerController.ts`、`projectController.ts`、`authController.ts` 等多个文件都引用了 `deleted_at` 字段。这是同一个根因——数据库缺少该字段。

### 解决方案
同故障一，给数据库加上 `deleted_at` 字段后，所有相关查询恢复正常。

### 教训
- **全局搜索受影响范围**：修一个文件前，先 `grep -rn "deleted_at"` 看看有多少地方引用，评估影响面
- **优先修数据库而非改代码**：当大量代码都依赖某个字段时，加字段比逐个改代码更合理

---

## 故障三：错误提示为中文，但网站面向中东用户

### 现象
- 头像上传失败时显示中文错误提示（如"上传失败"、"文件过大"）
- 网站是面向阿联酋/中东市场的，用户看不懂中文

### 修改范围
1. **前端 `DesignerProfileEditPage.tsx`**：所有 `setError()` 的中文提示改为英文
2. **后端 `designerController.ts`**：错误响应改为英文，并透传具体原因（如文件过大、数据库错误等）

### 教训
- **项目初始就统一语言**：面向海外市场的项目，所有用户可见文案从一开始就用英文
- **错误提示要具体**：不要只说"Failed to update"，要告诉用户具体是什么问题（文件太大？网络错误？权限不足？）

---

## 故障四：VM 环境限制导致无法直接操作

### 现象
- VM 无法 SSH 到服务器（网络沙箱）
- VM 无法 `npm install`（npm 被 403 禁止）
- VM 的 `node_modules` 是 Mac 平台的，Linux VM 缺少 `@rollup/rollup-linux-x64-gnu`
- `.git/index.lock` 文件无法删除（权限不足）

### 解决方案
- 前端构建和部署：由用户在本地终端执行
- 服务器操作：由用户在阿里云 ECS 终端执行
- 数据库操作：利用项目自带的 `mysql2` 模块 + 项目配置文件，通过 `node -e` 在服务器上执行
- git 操作：申请文件删除权限后解决 index.lock 问题

### 教训
- **了解环境限制**：提前确认 VM 能做什么不能做什么，避免反复尝试失败
- **善用项目依赖**：装不了新包时，看看项目 `node_modules` 里已有什么可以用的

---

## 通用开发规范建议

1. **数据库迁移必须版本化**：每次加字段、改表结构，都写 migration 文件，部署时统一执行
2. **catch 块必须记录原始错误**：`console.error('context:', error)` 是最低要求，绝不能静默吞掉
3. **错误响应要区分类型**：不要所有错误都返回同一个 message，至少区分 token 错误、数据库错误、业务错误
4. **部署脚本要包含后端**：目前 `deploy.config.sh` 只部署前端，后端需手动编译上传，容易遗漏
5. **测试环境要有与生产一致的数据库**：本地开发库和线上库的表结构要保持同步
