# Tarmeer 头像和后台问题修复 - 部署指南

## ✅ 已完成的修复

### 问题1: 头像和作品图像显示失败
**根本原因**: 数据库字段 `avatar_url` 类型为 `varchar(512)`，无法存储base64图像数据

**修复内容**:
1. ✅ 创建迁移脚本将 `avatar_url` 升级为 `MEDIUMTEXT`
2. ✅ 创建迁移脚本确保 `images` 字段为 `JSON` 类型
3. ✅ 添加自动化schema验证到部署流程

### 问题2: Admin后台看不到待审核设计师
**根本原因**: 注册时未明确设置 `status` 字段

**修复内容**:
1. ✅ 修改 `authController.ts` 注册逻辑，明确设置 `status='pending'`
2. ✅ 创建迁移脚本确保 `status` 字段默认值为 `pending`
3. ✅ 修复现有的 `status` 和 `is_approved` 字段不一致问题

### 新增功能
1. ✅ 自动化数据库迁移脚本 (`apply-migration.sh`)
2. ✅ Schema验证脚本 (`verify-schema.sh`)
3. ✅ 注册诊断脚本 (`check-registrations.sh`)
4. ✅ 修复验证脚本 (`validate-fixes.sh`)
5. ✅ 完整的测试计划文档 (`tests/manual/test-fixes.md`)

---

## 📋 验证结果

```
✅ 所有检查通过！可以继续部署测试
成功: 14 项
失败: 0 项
```

**检查项包括**:
- ✅ 6个必要文件已创建
- ✅ 4个代码变更已验证
- ✅ 4个脚本权限正确

---

## 🚀 下一步：部署到生产环境

### 方式A: 自动化部署（推荐）

```bash
# 1. 上传所有文件到服务器
scp server/schema/migration-*.sql root@47.91.108.104:/tarmeer/tarmeer_api/server/schema/
scp server/scripts/*.sh root@47.91.108.104:/tarmeer/tarmeer_api/server/scripts/
scp server/src/controllers/authController.ts root@47.91.108.104:/tarmeer/tarmeer_api/server/src/controllers/
scp deploy-simple.sh root@47.91.108.104:/tarmeer/

# 2. SSH到服务器执行迁移
ssh root@47.91.108.104

# 3. 在服务器上执行
cd /tarmeer/tarmeer_api

# 检查当前状态
bash server/scripts/check-registrations.sh

# 执行迁移（会自动备份）
bash server/scripts/apply-migration.sh

# 验证迁移结果
bash server/scripts/verify-schema.sh

# 重新编译后端
npm run build

# 重启API服务
pm2 restart tarmeer-api
# 或: systemctl restart tarmeer-api

# 4. 退出SSH，部署前端
exit

# 5. 在本地执行前端部署
DEPLOY_RULES_ACK=YES bash deploy-simple.sh
```

### 方式B: 手动执行（用于调试）

```bash
# 1. 登录服务器
ssh root@47.91.108.104

# 2. 手动执行SQL迁移
cd /tarmeer/tarmeer_api
mysql -u root -p tarmeer < server/schema/migration-2026-03-23-fix-image-fields.sql
mysql -u root -p tarmeer < server/schema/migration-2026-03-23-fix-designer-status.sql

# 3. 验证变更
mysql -u root -p tarmeer -e "
SELECT
    TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'tarmeer'
  AND TABLE_NAME IN ('designers', 'projects')
  AND COLUMN_NAME IN ('avatar_url', 'images', 'status');
"

# 4. 更新代码并重启
# ... (同方式A)
```

---

## 🧪 部署后测试清单

### 基础功能测试
- [ ] 访问 https://www.tarmeer.com/auth 注册新账号
- [ ] 验证邮箱并登录
- [ ] 上传头像（使用小图片 < 100KB）
- [ ] 创建作品并上传图片
- [ ] 保存成功，无错误提示

### Admin后台测试
- [ ] 访问 https://www.tarmeer.com/admin
- [ ] 登录admin账号
- [ ] 查看设计师列表，确认新注册的设计师显示为 "pending"
- [ ] 查看设计师头像是否正常显示
- [ ] 查看作品图片是否正常显示
- [ ] 测试 approve/reject 功能

### 数据库验证
```bash
# SSH到服务器执行
ssh root@47.91.108.104 "cd /tarmeer/tarmeer_api && bash server/scripts/check-registrations.sh"
```

---

## 🔄 回滚计划

如果出现问题需要回滚：

```bash
# 1. 恢复数据库（使用迁移时自动创建的备份）
ssh root@47.91.108.104
cd /tarmeer/tarmeer_api
ls -lh /tarmeer/backups/  # 找到最新的备份文件
mysql -u root -p tarmeer < /tarmeer/backups/[最新备份文件].sql

# 2. 恢复代码
git log --oneline -5  # 找到修复前的commit
git revert [修复commit的hash]
DEPLOY_RULES_ACK=YES bash deploy-simple.sh

# 3. 重启服务
pm2 restart tarmeer-api
```

---

## 📊 预期结果

修复完成后，应该看到：

### 数据库层面
```sql
-- designers表
avatar_url: mediumtext (可存储16MB数据)
status: enum('pending','approved','rejected') DEFAULT 'pending'
is_approved: tinyint(1) DEFAULT 0

-- projects表
images: json (可存储大型JSON数组)
```

### 应用层面
1. **新注册设计师**: 自动设置 `status='pending'`
2. **头像上传**: 无 "Data too long" 错误
3. **作品图片**: 正常保存和显示
4. **Admin后台**: 可以看到 pending 状态的设计师

---

## 📞 问题排查

### 如果头像还是不能显示

1. **检查数据库字段类型**:
```bash
mysql -u root -p tarmeer -e "SHOW CREATE TABLE designers\G"
```

2. **检查现有数据**:
```bash
mysql -u root -p tarmeer -e "
SELECT id, full_name, LENGTH(avatar_url) as url_length, LEFT(avatar_url, 50) as preview
FROM designers
WHERE avatar_url IS NOT NULL
LIMIT 5;
"
```

3. **检查应用日志**:
```bash
ssh root@47.91.108.104 "tail -100 /tarmeer/tarmeer_api/logs/*.log | grep -i 'avatar\|error'"
```

### 如果Admin后台还是看不到设计师

1. **检查注册是否成功**:
```bash
bash server/scripts/check-registrations.sh
```

2. **检查查询逻辑**:
```bash
# 直接查询数据库
mysql -u root -p tarmeer -e "
SELECT id, email, full_name, status, is_approved, created_at
FROM designers
WHERE status = 'pending' AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 10;
"
```

---

## 📁 相关文件

### 迁移脚本
- `server/schema/migration-2026-03-23-fix-image-fields.sql` - 图像字段修复
- `server/schema/migration-2026-03-23-fix-designer-status.sql` - 状态字段修复

### 工具脚本
- `server/scripts/apply-migration.sh` - 执行迁移
- `server/scripts/verify-schema.sh` - 验证schema
- `server/scripts/check-registrations.sh` - 检查注册状态
- `server/scripts/validate-fixes.sh` - 验证修复

### 代码修改
- `server/src/controllers/authController.ts` - 注册逻辑修复
- `deploy-simple.sh` - 部署脚本增强

### 文档
- `tests/manual/test-fixes.md` - 完整测试计划
- `DEPLOYMENT-GUIDE.md` - 本文档

---

**最后更新**: 2026-03-23
**验证状态**: ✅ 所有检查通过
**准备状态**: 🚀 可以部署到生产环境
