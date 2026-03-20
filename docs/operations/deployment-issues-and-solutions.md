# 部署问题与解决方案

本文档记录实际部署过程中遇到的问题、根本原因和解决方案，用于避免重复犯错。

**最后更新：** 2026-03-20

---

## 问题1：数据库Schema不匹配导致头像上传失败

### 问题描述
用户在前端上传头像后，后端API返回错误：
```
ER_DATA_TOO_LONG: Data too long for column 'avatar_url' at row 1
```

### 根本原因
- **本地代码**：`designers` 表的 `avatar_url` 字段已改为 `MEDIUMTEXT` 类型
- **线上数据库**：字段仍然是 `varchar(512)`，无法存储长URL或base64编码的图片数据
- **Schema变更未同步**：修改了本地schema文件，但没有执行线上数据库迁移

### 影响范围
- 设计师无法上传头像
- 已有长URL的头像可能被截断

### 解决方案
#### 临时修复（紧急）
```bash
# 直接修改线上数据库字段类型
mysql -h <RDS_HOST> -u <USER> -p<PASSWORD> <DATABASE> -e \
  "ALTER TABLE designers MODIFY COLUMN avatar_url MEDIUMTEXT DEFAULT NULL;"
```

#### 正确流程（推荐）
1. **创建迁移脚本**：`server/schema/avatar-url-migration.sql`
   ```sql
   -- 修改avatar_url字段类型以支持长URL/base64
   ALTER TABLE designers MODIFY COLUMN avatar_url MEDIUMTEXT DEFAULT NULL;
   ```

2. **部署前检查清单**：
   ```bash
   # 对比本地和线上schema
   diff database/schema.sql <(mysql -h $RDS_HOST -u $USER -p$PASS $DB -e "SHOW CREATE TABLE designers")
   ```

3. **部署流程**：
   - 先部署后端代码
   - 再执行数据库迁移
   - 最后重启API服务

### 预防措施
- [ ] **部署前schema对比**：每次修改schema后，必须检查线上数据库是否需要迁移
- [ ] **版本控制迁移脚本**：所有schema变更必须创建对应的迁移SQL文件
- [ ] **自动化检查**：在CI/CD中添加schema一致性检查
- [ ] **文档更新**：修改schema时同步更新 `database/schema.sql`

### 相关文件
- `database/schema.sql`
- `server/schema/avatar-url-migration.sql`
- `server/schema/designers.sql`

---

## 问题2：部署脚本Bash转义语法错误

### 问题描述
执行 `deploy-simple.sh` 时，在权限设置步骤失败：
```bash
bash: -c:行0: 未预期的符号 `&&' 附近有语法错误
bash: -c:行0: `find /tarmeer/tarmeer_web_portal -type d -exec chmod 755 {} \\; && find /tarmeer/tarmeer_web_portal -type f -exec chmod 644 {} \\; && nginx -t && systemctl reload nginx'
```

### 根本原因
在通过SSH执行远程命令时，多层嵌套的转义字符处理不当：
- 本地bash需要转义 `\\;`
- 通过SSH传递到远程shell时再次转义
- 最终导致语法错误

### 影响范围
- 部署脚本无法完整执行
- 需要手动完成权限设置和Nginx重载

### 解决方案
#### 修复前（错误）
```bash
run_ssh "find ${DEPLOY_PATH} -type d -exec chmod 755 {} \\; && find ${DEPLOY_PATH} -type f -exec chmod 644 {} \\\; && nginx -t && systemctl reload nginx"
```

#### 修复后（正确）
```bash
# 方案1：拆分成独立命令（推荐）
run_ssh "find ${DEPLOY_PATH} -type d -exec chmod 755 {} +"
run_ssh "find ${DEPLOY_PATH} -type f -exec chmod 644 {} +"
run_ssh "nginx -t && systemctl reload nginx"

# 方案2：使用单引号避免转义
run_ssh 'find /tarmeer/tarmeer_web_portal -type d -exec chmod 755 {} + && \
         find /tarmeer/tarmeer_web_portal -type f -exec chmod 644 {} + && \
         nginx -t && systemctl reload nginx'
```

### 技术说明
- `find -exec ... {} +` 比 `{} \;` 更高效，且不需要转义分号
- 拆分成独立步骤提高可读性和可维护性
- 某步失败时更容易定位问题

### 预防措施
- [ ] **代码审查**：涉及多层转义的命令需要特别仔细检查
- [ ] **测试部署脚本**：在非生产环境测试脚本的所有步骤
- [ ] **使用函数封装**：复杂的SSH操作封装成可测试的函数
- [ ] **文档化转义规则**：在注释中说明特殊字符的转义方法

### 相关文件
- `deploy-simple.sh` (line 111)

---

## 问题3：后端代码版本过旧

### 问题描述
数据库schema已更新，但API服务仍报错：
```
ER_DATA_TOO_LONG: Data too long for column 'avatar_url' at row 1
```

### 根本原因
- 前端代码已更新并部署
- 数据库schema已手动修改
- **但后端API代码没有同步部署**
- 线上运行的仍是旧版本代码，可能包含已知的bug或缺少必要的日志

### 影响范围
- 代码不一致导致难以调试
- 已修复的bug在线上仍然存在
- 缺少必要的调试信息

### 解决方案
#### 完整部署流程
```bash
# 1. 构建后端代码
cd server && npm run build

# 2. 上传到服务器
scp -i ~/.ssh/tarmeer_ecs -r dist/* root@47.91.108.104:/tarmeer/tarmeer_api/dist/

# 3. 重启API服务
ssh root@47.91.108.104 "cd /tarmeer/tarmeer_api && pm2 restart tarmeer-api"

# 4. 验证服务状态
ssh root@47.91.108.104 "pm2 logs tarmeer-api --lines 10 --nostream"
```

### 预防措施
- [ ] **原子性部署**：前端、后端、数据库应作为一个整体部署
- [ ] **版本标记**：在代码中添加版本号或commit hash，便于确认线上版本
- [ ] **部署前检查**：确认所有组件都已更新
- [ ] **健康检查**：部署后验证所有服务的版本和状态

### 版本验证方法
```bash
# 检查代码版本
ssh root@47.91.108.104 "grep -c 'UPDATE DESIGNER' /tarmeer/tarmeer_api/dist/controllers/designerController.js"

# 检查服务日志
pm2 logs tarmeer-api --lines 20

# 检查数据库schema
mysql -h $RDS_HOST -u $USER -p$PASS $DB -e "DESCRIBE designers avatar_url;"
```

### 相关文件
- `server/` 目录
- `/tarmeer/tarmeer_api/dist/` (服务器)

---

## 通用部署最佳实践

### 部署前检查清单
- [ ] 阅读并确认 `docs/operations/deploy-safety-workflow.md`
- [ ] 本地QA测试通过：`npm run qa:smoke`
- [ ] 本地构建成功：`npm run build`
- [ ] 对比schema变更，准备迁移脚本
- [ ] 确认要部署的commit hash
- [ ] 检查是否有未提交的更改

### 部署流程
```bash
# 1. 前端部署
DEPLOY_RULES_ACK=YES DEPLOY_SSH_KEY=~/.ssh/tarmeer_ecs bash deploy-simple.sh

# 2. 后端部署（如有更新）
cd server && npm run build
scp -i ~/.ssh/tarmeer_ecs -r dist/* root@47.91.108.104:/tarmeer/tarmeer_api/dist/
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 "cd /tarmeer/tarmeer_api && pm2 restart tarmeer-api"

# 3. 数据库迁移（如有schema变更）
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 "mysql -h $RDS_HOST ... < migration.sql"

# 4. 健康检查
curl -sS -I https://www.tarmeer.com | head -n 1
curl -sS -I https://www.tarmeer.com/api/health | head -n 1
```

### 部署后验证
- [ ] 首页返回200
- [ ] 关键页面返回200
- [ ] 图片资源返回200
- [ ] API健康检查通过
- [ ] 检查服务日志无ERROR
- [ ] 手动测试关键功能

### 回滚计划
如果部署出现问题：
```bash
# 1. 前端回滚
git revert <commit-hash>
DEPLOY_RULES_ACK=YES bash deploy-simple.sh

# 2. 后端回滚
ssh root@47.91.108.104 "cd /tarmeer/tarmeer_api && git checkout <commit-hash> && npm run build && pm2 restart tarmeer-api"

# 3. 数据库回滚（如需要）
mysql -h $RDS_HOST ... < rollback-migration.sql
```

---

## 快速参考

### 常用命令
```bash
# 检查线上数据库schema
mysql -h rm-eb3t6y5093m91i2wzqo.mysql.dubai.rds.aliyuncs.com \
  -u tarmeerCRM -p'Tarmeer2026@' tarmeer \
  -e "DESCRIBE designers;"

# 查看API服务状态
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 "pm2 status"

# 查看API日志
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 "pm2 logs tarmeer-api --lines 50"

# 重启API服务
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 "pm2 restart tarmeer-api"

# 检查Nginx配置
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 "nginx -t"

# 重载Nginx
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 "systemctl reload nginx"
```

### 配置文件位置
- 官网Nginx配置：`/etc/nginx/conf.d/tarmeer.conf`
- 后台Nginx配置：`/etc/nginx/conf.d/admin.tarmeer.conf`
- API服务目录：`/tarmeer/tarmeer_api`
- Web前端目录：`/tarmeer/tarmeer_web_portal`

### 服务器信息
- 主机：47.91.108.104
- SSH密钥：~/.ssh/tarmeer_ecs
- 数据库：RDS MySQL (rm-eb3t6y5093m91i2wzqo.mysql.dubai.rds.aliyuncs.com)

---

## 变更历史

| 日期 | 问题 | 解决方案 | 影响版本 |
|------|------|----------|----------|
| 2026-03-20 | 数据库schema不匹配 | 创建迁移脚本，更新字段类型 | v4.0.0 |
| 2026-03-20 | 部署脚本bash转义错误 | 拆分命令，使用 `{} +` | deploy-simple.sh |
| 2026-03-20 | 后端代码版本过旧 | 完整部署流程，版本验证 | server/ |

---

**维护说明：**
每次遇到新的部署问题时，请更新本文档，确保团队共享经验教训。
