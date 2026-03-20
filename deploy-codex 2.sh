#!/bin/bash
# Tarmeer 网站部署脚本 - 给 CodeX 使用（支持密码认证）

set -e

echo "🚀 开始部署 Tarmeer 网站..."

# 服务器配置
SERVER_HOST="47.91.108.104"
SERVER_USER="root"
SERVER_PASS="g5jbk3xOcxy&VB{W"
DEPLOY_PATH="/tarmeer/tarmeer_web_portal"

# 1. 构建项目
echo "📦 步骤 1/4: 构建项目..."
npm run build

# 2. 清空服务器目录（使用 expect）
echo "🧹 步骤 2/4: 清空服务器目录..."
cat > /tmp/clean_server.exp << 'EXPECT'
#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@47.91.108.104
expect "password:"
send "g5jbk3xOcxy&VB{W\r"
expect "#"
send "rm -rf /tarmeer/tarmeer_web_portal/*\r"
expect "#"
send "exit\r"
expect eof
EXPECT
/usr/bin/expect /tmp/clean_server.exp

# 3. 上传文件（使用 expect）
echo "📤 步骤 3/4: 上传文件..."
cat > /tmp/upload_files.exp << 'EXPECT'
#!/usr/bin/expect -f
set timeout 120
spawn scp -r -o StrictHostKeyChecking=no ./dist root@47.91.108.104:/tarmeer/tarmeer_web_portal/
expect "password:"
send "g5jbk3xOcxy&VB{W\r"
expect eof
EXPECT
/usr/bin/expect /tmp/upload_files.exp

cat > /tmp/upload_images.exp << 'EXPECT'
#!/usr/bin/expect -f
set timeout 120
spawn scp -r -o StrictHostKeyChecking=no ./public/images root@47.91.108.104:/tarmeer/tarmeer_web_portal/
expect "password:"
send "g5jbk3xOcxy&VB{W\r"
expect eof
EXPECT
/usr/bin/expect /tmp/upload_images.exp 2>/dev/null || true

# 4. 整理文件和重载 Nginx
echo "🔄 步骤 4/4: 整理文件和重载 Nginx..."
cat > /tmp/finalize.exp << 'EXPECT'
#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@47.91.108.104
expect "password:"
send "g5jbk3xOcxy&VB{W\r"
expect "#"
send "cd /tarmeer/tarmeer_web_portal\r"
expect "#"
send "mv dist/* . 2>/dev/null; rm -rf dist images 2>/dev/null\r"
expect "#"
send "nginx -t\r"
expect "#"
send "systemctl reload nginx\r"
expect "#"
send "exit\r"
expect eof
EXPECT
/usr/bin/expect /tmp/finalize.exp

# 清理临时文件
rm -f /tmp/clean_server.exp /tmp/upload_files.exp /tmp/upload_images.exp /tmp/finalize.exp

echo "✅ 部署完成！"
echo "🌐 访问: https://www.tarmeer.com"
