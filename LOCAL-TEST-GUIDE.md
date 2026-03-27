# 本地测试指南

## 🚀 当前运行状态

### ✅ 前端开发服务器
- **状态**: 运行中
- **地址**: http://localhost:5173/
- **网络地址**: http://192.168.225.187:5173/

### ⚠️ 后端API服务
- **状态**: 未启动
- **说明**: 前端界面可以浏览，但需要API的功能（注册、登录、上传）不可用

---

## 📋 测试清单

### 界面测试（无需API）
- [ ] 访问首页 http://localhost:5173/
- [ ] 查看设计师列表 http://localhost:5173/designers
- [ ] 浏览设计师详情页面
- [ ] 查看服务页面
- [ ] 测试响应式布局

### 功能测试（需要API）
- [ ] 注册新设计师账号
- [ ] 登录现有账号
- [ ] 上传头像
- [ ] 创建作品
- [ ] Admin后台查看设计师
- [ ] Admin审核功能

---

## 🔧 启动完整开发环境

如果需要测试完整功能，请启动后端API：

### 推荐（当前项目）
```bash
cd "/Users/kp/Code/tarmeer-4.0-local"
npm run backend:up
npm run backend:health
```

如果 `backend:health` 返回 `HTTP/1.1 200`，前端提交 `/admin/install` 才会成功连到后端。

### 方法1: 使用PM2（推荐）
```bash
# 1. 进入API目录（如果存在）
cd /path/to/tarmeer-api

# 2. 安装依赖（首次）
npm install

# 3. 编译TypeScript
npm run build

# 4. 启动服务
pm2 start dist/app.js --name tarmeer-api

# 5. 查看日志
pm2 logs tarmeer-api

# 6. 检查状态
pm2 status
```

### 方法2: 直接运行
```bash
# 1. 进入API目录
cd /path/to/tarmeer-api

# 2. 编译并运行
npm run build
node dist/app.js

# API将在 http://localhost:3002 运行
```

### 方法3: 开发模式（热重载）
```bash
# 1. 进入API目录
cd /path/to/tarmeer-api

# 2. 安装ts-node（首次）
npm install -g ts-node

# 3. 开发模式运行
ts-node src/index.ts

# 或者使用nodemon
npm install -g nodemon
nodemon --exec ts-node src/index.ts
```

---

## 🧪 快速功能测试

### 1. 测试头像上传（修复后）
1. 访问 http://localhost:5173/auth
2. 注册新账号（或登录现有账号）
3. 进入个人资料页面
4. 上传头像（使用小图片 < 100KB）
5. **预期**: 无 "Data too long" 错误，头像成功保存

### 2. 测试Admin后台（修复后）
1. 访问 http://localhost:5173/admin
2. 登录管理员账号
3. 查看设计师列表
4. **预期**: 可以看到新注册的设计师，状态为 "pending"
5. 查看设计师头像
6. **预期**: 头像正常显示（不再损坏）

### 3. 测试作品提交（修复后）
1. 登录设计师账号
2. 创建新作品
3. 上传作品图片
4. **预期**: 图片成功保存，无截断错误

---

## 🐛 常见问题

### Q: 前端显示 "Cannot connect to API"
A: 后端API服务未启动，按照上面的步骤启动API服务

### Q: 注册后看不到pending设计师
A: 需要运行数据库迁移脚本：
```bash
bash server/scripts/apply-migration.sh
```

### Q: 头像上传失败
A: 确认数据库字段已升级：
```sql
ALTER TABLE designers MODIFY COLUMN avatar_url MEDIUMTEXT DEFAULT NULL;
```

### Q: 端口冲突
A: 修改端口或停止占用进程：
```bash
# 查看占用
lsof -i :5173
lsof -i :3002

# 停止进程
pkill -f vite
pkill -f "node.*api"
```

---

## 📝 测试结果记录

### 数据库验证
```bash
# 检查字段类型
mysql -u root -p tarmeer -e "
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'tarmeer'
  AND TABLE_NAME = 'designers'
  AND COLUMN_NAME IN ('avatar_url', 'status', 'is_approved');
"
```

**预期结果**:
```
+--------------+-----------+--------------------------+
| COLUMN_NAME  | DATA_TYPE | COLUMN_TYPE              |
+--------------+-----------+--------------------------+
| avatar_url   | mediumtext| mediumtext               |
| is_approved  | tinyint   | tinyint(1)               |
| status       | enum      | enum('pending','approved...')|
+--------------+-----------+--------------------------+
```

### 功能测试结果
- [ ] 头像上传成功: ___________
- [ ] 作品图片正常: ___________
- [ ] Admin看到pending设计师: ___________
- [ ] Admin头像显示正常: ___________
- [ ] 作品图片显示正常: ___________

---

## 🛑 停止服务

```bash
# 停止前端
pkill -f vite

# 停止后端（如果使用PM2）
pm2 stop tarmeer-api

# 或直接停止node进程
pkill -f "node.*api"
```

---

**最后更新**: 2026-03-23
**服务器状态**: 前端运行中，后端待启动
**访问地址**: http://localhost:5173/
