#!/bin/bash
# Tarmeer 网站快速部署脚本
# 给 CodeX 使用

set -e

echo "🚀 开始部署 Tarmeer 网站..."

# 服务器配置
SERVER_HOST="47.91.108.104"
SERVER_USER="root"
DEPLOY_PATH="/tarmeer/tarmeer_web_portal"

# 1. 构建项目
echo "📦 步骤 1/3: 构建项目..."
npm run build

# 2. 清空服务器目录
echo "🧹 步骤 2/3: 清空服务器目录..."
ssh ${SERVER_USER}@${SERVER_HOST} "rm -rf ${DEPLOY_PATH}/*"

# 3. 上传文件
echo "📤 步骤 3/3: 上传文件..."
scp -r dist/* ${SERVER_USER}@${SERVER_HOST}:${DEPLOY_PATH}/
scp -r public/images/* ${SERVER_USER}@${SERVER_HOST}:${DEPLOY_PATH}/ 2>/dev/null || true

# 4. 重载 Nginx
echo "🔄 重载 Nginx..."
ssh ${SERVER_USER}@${SERVER_HOST} "nginx -t && systemctl reload nginx"

echo "✅ 部署完成！"
echo "🌐 访问: https://www.tarmeer.com"
