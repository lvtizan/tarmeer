# Tarmeer 头像和后台问题修复 - 测试计划

## 修复内容概览

### 问题1: 头像和作品图像显示失败
**根本原因**: 数据库字段类型不匹配
- 本地代码: `avatar_url MEDIUMTEXT`, `images JSON`
- 线上数据库: `avatar_url varchar(512)`

**解决方案**:
1. 创建数据库迁移脚本升级字段类型
2. 修复注册逻辑，明确设置status字段
3. 添加schema验证到部署流程

### 问题2: Admin后台看不到待审核设计师
**根本原因**: 注册时未明确设置status字段

**解决方案**:
1. 修复注册控制器，明确设置status='pending'
2. 创建数据库迁移确保默认值正确
3. 添加诊断脚本检查注册状态

---

## 测试步骤

### 第一阶段: 本地测试 (开发环境)

#### 1. 代码变更验证
```bash
# 检查文件修改
git diff server/src/controllers/authController.ts
git diff deploy-simple.sh

# 验证新文件存在
ls -la server/schema/migration-2026-03-23-*.sql
ls -la server/scripts/*.sh
```

#### 2. 本地数据库测试
```bash
# 进入MySQL
mysql -u root -p tarmeer

# 检查当前schema
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'tarmeer'
  AND TABLE_NAME = 'designers'
  AND COLUMN_NAME IN ('status', 'is_approved', 'avatar_url');

# 测试迁移脚本
source server/schema/migration-2026-03-23-fix-image-fields.sql
source server/schema/migration-2026-03-23-fix-designer-status.sql

# 验证结果
SELECT status, is_approved, COUNT(*) FROM designers GROUP BY status, is_approved;
```

#### 3. 后端功能测试
```bash
# 启动后端服务
cd server && npm run dev

# 测试注册API
curl -X POST http://localhost:3002/api/auth/check-availability \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","phone":"+971501234567"}'

curl -X POST http://localhost:3002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"TestPassword123!",
    "fullName":"Test Designer",
    "phone":"+971501234567",
    "city":"Dubai"
  }'

# 检查数据库中的新记录
mysql -u root -p tarmeer -e "
SELECT id, email, full_name, status, is_approved, created_at
FROM designers
WHERE email = 'test@example.com'
ORDER BY id DESC LIMIT 1;
"
```

#### 4. 前端功能测试
```bash
# 启动前端服务
npm run dev

# 测试功能
1. 打开 http://localhost:5173/auth
2. 注册新设计师账号
3. 登录后上传头像 (使用小图片 < 100KB)
4. 检查头像是否正常显示
5. 提交测试作品
6. 登录admin后台查看新注册的设计师
```

---

### 第二阶段: 部署到生产环境

#### 准备工作
```bash
# 1. 备份生产数据库
ssh root@47.91.108.104 "mysqldump -u root -p tarmeer > /tarmeer/backups/pre-fix-backup_\$(date +%Y%m%d_%H%M%S).sql"

# 2. 上传迁移文件
scp server/schema/migration-2026-03-23-*.sql root@47.91.108.104:/tarmeer/tarmeer_api/server/schema/
scp server/scripts/*.sh root@47.91.108.104:/tarmeer/tarmeer_api/server/scripts/
scp server/src/controllers/authController.ts root@47.91.108.104:/tarmeer/tarmeer_api/server/src/controllers/

# 3. 上传前端修改
scp deploy-simple.sh root@47.91.108.104:/tarmeer/
```

#### 执行迁移
```bash
# SSH到服务器
ssh root@47.91.108.104

# 进入API目录
cd /tarmeer/tarmeer_api

# 1. 检查当前状态
bash server/scripts/check-registrations.sh

# 2. 执行迁移
bash server/scripts/apply-migration.sh

# 3. 验证迁移结果
bash server/scripts/verify-schema.sh

# 4. 重新编译后端
npm run build

# 5. 重启API服务 (PM2)
pm2 restart tarmeer-api
# 或 systemctl restart tarmeer-api
```

#### 部署前端
```bash
# 在本地机器执行
DEPLOY_RULES_ACK=YES bash deploy-simple.sh
```

---

### 第三阶段: 生产环境验证

#### 1. 注册流程测试
- [ ] 访问 https://www.tarmeer.com/auth
- [ ] 注册新设计师账号
- [ ] 验证邮箱
- [ ] 登录成功

#### 2. 头像上传测试
- [ ] 进入设计师个人资料页面
- [ ] 上传头像 (使用 < 100KB 的图片)
- [ ] 保存成功
- [ ] 头像在各个页面正常显示

#### 3. 作品提交测试
- [ ] 创建新作品
- [ ] 上传作品图片
- [ ] 提交审核
- [ ] 作品保存成功

#### 4. Admin后台测试
- [ ] 访问 https://www.tarmeer.com/admin
- [ ] 登录admin账号
- [ ] 查看设计师列表
- [ ] 确认新注册的设计师显示为"pending"状态
- [ ] 查看设计师头像是否正常显示
- [ ] 查看作品图片是否正常显示
- [ ] 测试approve/reject功能

---

## 回滚计划

如果出现问题，立即执行回滚：

```bash
# 1. 恢复数据库
ssh root@47.91.108.104 "mysql -u root -p tarmeer < /tarmeer/backups/pre-fix-backup_YYYYMMDD_HHMMSS.sql"

# 2. 恢复代码
git revert <commit-hash>
DEPLOY_RULES_ACK=YES bash deploy-simple.sh

# 3. 重启服务
ssh root@47.91.108.104 "pm2 restart tarmeer-api"
```

---

## 检查清单

### 代码变更
- [x] 创建迁移脚本 migration-2026-03-23-fix-image-fields.sql
- [x] 创建迁移脚本 migration-2026-03-23-fix-designer-status.sql
- [x] 修复 authController.ts 注册逻辑
- [x] 更新 deploy-simple.sh 添加schema验证
- [x] 创建诊断脚本 check-registrations.sh
- [x] 创建迁移脚本 apply-migration.sh
- [x] 创建验证脚本 verify-schema.sh

### 测试完成
- [ ] 本地代码编译无错误
- [ ] 本地数据库迁移成功
- [ ] 本地注册功能正常
- [ ] 本地头像上传正常
- [ ] 生产数据库迁移成功
- [ ] 生产注册功能正常
- [ ] 生产头像显示正常
- [ ] Admin后台显示pending设计师
- [ ] Admin后台头像显示正常
- [ ] Admin后台作品图片显示正常

---

## 预期结果

修复后应该看到：

1. **新注册设计师**: status='pending', is_approved=0
2. **头像上传**: 成功保存到数据库，无错误
3. **作品提交**: 图片正常保存，无截断
4. **Admin后台**:
   - 设计师列表显示新注册的pending设计师
   - 设计师头像正常显示
   - 作品图片正常显示
   - 可以正常approve/reject

---

## 注意事项

1. **数据库备份**: 执行迁移前务必备份
2. **权限确认**: 确保数据库用户有ALTER TABLE权限
3. **测试账号**: 使用测试账号验证，不要用真实数据
4. **逐步验证**: 每完成一步就验证，不要一次性做所有变更
5. **日志监控**: 执行后检查应用日志，确保没有错误

---

**最后更新**: 2026-03-23
**负责人**: Claude
**状态**: 待测试
