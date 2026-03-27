# 🚀 Tarmeer 4.0 快速启动指南

## 前置要求

- Node.js 18+
- MySQL 8.0+
- npm 或 yarn

## 快速开始

### 1. 安装依赖

```bash
# 前端
npm install

# 后端
cd server
npm install
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp server/.env.example server/.env

# 编辑 .env 文件，设置必要的配置
nano server/.env
```

### 3. 生成安全的JWT密钥

```bash
cd server
npm run generate-jwt
```

将生成的密钥复制到`.env`文件中的`JWT_SECRET`。

### 4. 启动数据库

确保MySQL服务正在运行，然后创建数据库：

```sql
CREATE DATABASE tarmeer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 5. 启动开发服务器

```bash
# 终端1: 启动后端
cd server
npm run dev

# 终端2: 启动前端
npm run dev
```

### 6. 访问应用

- 前端: http://localhost:5173
- 后端API: http://localhost:3002/api
- API文档: http://localhost:3002 (根路径)

## 开发工具

### 运行测试

```bash
# 前端测试
npm run test

# 后端测试
cd server
npm test

# 冒烟测试
npm run qa:smoke
```

### 数据库操作

```bash
# 检查后端健康状态
npm run backend:health

# 启动后端
npm run backend:up
```

### 部署

```bash
# 构建生产版本
npm run build

# 部署
npm run deploy
```

## 常见问题

### JWT密钥错误

如果看到`JWT secret validation failed`错误：

1. 运行`npm run generate-jwt`生成新密钥
2. 更新`.env`文件中的`JWT_SECRET`
3. 重启服务器

### 数据库连接失败

1. 检查MySQL服务是否运行
2. 验证`.env`中的数据库配置
3. 确保数据库已创建

### CORS错误

1. 检查`.env`中的`FRONTEND_URL`配置
2. 确保前端URL在CORS允许列表中
3. 检查网络请求的Origin头

## 生产环境部署

### 安全检查清单

- [ ] 生成强JWT密钥
- [ ] 设置`NODE_ENV=production`
- [ ] 配置HTTPS
- [ ] 设置强数据库密码
- [ ] 配置防火墙
- [ ] 启用速率限制
- [ ] 配置监控日志

### 性能优化

- [ ] 启用生产模式构建
- [ ] 配置CDN
- [ ] 启用Gzip压缩
- [ ] 优化数据库查询
- [ ] 实施缓存策略

## 监控和维护

### 日志位置

- 后端日志: `server/logs/`
- 前端错误: 浏览器控制台

### 健康检查

```bash
# 检查后端健康状态
curl http://localhost:3002/api/health
```

### 数据库备份

```bash
# 备份数据库
mysqldump -u root -p tarmeer > backup.sql

# 恢复数据库
mysql -u root -p tarmeer < backup.sql
```

## 开发规范

### Git提交规范

```bash
# 功能开发
git commit -m "feat: add user authentication"

# 问题修复
git commit -m "fix: resolve CORS configuration issue"

# 文档更新
git commit -m "docs: update deployment guide"
```

### 代码审查

所有代码变更应经过：
1. 自我审查
2. 自动化测试
3. 人工审查
4. 安全检查

## 获取帮助

- 📖 项目文档: `/README.md`
- 🔧 代码审查报告: `/CODE-REVIEW-REPORT.md`
- 🚀 部署指南: `/DEPLOYMENT-GUIDE.md`
- 🧪 测试状态: `/TEST-STATUS.md`

## 版本信息

- **当前版本**: 4.0.0
- **最后更新**: 2026-03-26
- **Node.js要求**: >=18.0.0
- **TypeScript版本**: ~5.7.2
