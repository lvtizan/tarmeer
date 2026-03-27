# Deployment Troubleshooting

常见部署问题与快速解决方案。

## 文件权限问题 (403 Forbidden)

### 症状
- 首页正常，但图片/头像返回 403
- 浏览器开发者工具显示静态资源加载失败

### 原因
- 文件权限为 `600`（仅所有者可读）
- nginx 运行用户无法读取

### 解决方案
```bash
ssh root@47.91.108.104
find /tarmeer/tarmeer_web_portal -type d -exec chmod 755 {} +
find /tarmeer/tarmeer_web_portal -type f -exec chmod 644 {} +
```

### 预防
- `deploy-simple.sh` 已自动包含权限修复
- 本地构建前确保 `public/` 目录权限正确

## Schema 验证失败

### 症状
- 部署脚本报错 "Schema验证失败"
- 提示找不到 `verify-schema.sh`

### 原因
- 远程服务器结构与脚本预期不一致
- 脚本路径已过时

### 解决方案
- 跳过 schema 验证，直接部署前端
- 或手动同步后端 schema 文件

## 资源 404

### 症状
- 页面加载但 JS/CSS 返回 404
- `index.html` 引用的文件不存在

### 原因
- 只上传了 `index.html`，未上传新的 `/assets/*` 文件
- 增量部署不完整

### 解决方案
```bash
# 必须同步整个 dist/ 目录
rsync -az --delete dist/ root@47.91.108.104:/tarmeer/tarmeer_web_portal/
```

## TypeScript 编译错误

### 常见错误
- `TS6133`: 变量声明但未使用
- `TS2347`: 无类型函数调用
- `TS2451`: 重复声明

### 快速修复
```bash
# 使用 _ 前缀标记未使用变量
const _unused = value;

# 导入 React hooks 代替 React.xxx
import { useState, useCallback } from 'react';
```

## 快速诊断命令

```bash
# 检查远程文件权限
ssh root@47.91.108.104 "ls -la /tarmeer/tarmeer_web_portal/images/designers/avatars/ | head -3"

# 检查 nginx 配置
ssh root@47.91.108.104 "nginx -t"

# 检查 HTTP 状态码
curl -sS -o /dev/null -w "%{http_code}" https://www.tarmeer.com/images/designers/avatars/omar-farouk.jpg

# 检查远程目录结构
ssh root@47.91.108.104 "ls -la /tarmeer/tarmeer_web_portal/"
```
