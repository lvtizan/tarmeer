#!/bin/bash
# 阿里云 ECS 部署配置

SERVER_HOST="47.91.108.104"
SERVER_USER="root"
SERVER_PORT="22"
DEPLOY_PATH="/tarmeer/tarmeer_web_portal"
LOCAL_DIST="./dist"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  开始部署到阿里云 ECS${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "服务器: ${SERVER_HOST}"
echo "部署目录: ${DEPLOY_PATH}"
echo ""

# 1. 构建项目
echo -e "${YELLOW}步骤 1/4: 构建项目...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}构建失败！${NC}"
    exit 1
fi
echo -e "${GREEN}✓ 构建成功${NC}"
echo ""

# 2. 清空服务器目录并上传文件
echo -e "${YELLOW}步骤 2/4: 上传文件到服务器...${NC}"

# 创建临时 expect 脚本用于清空目录
cat > /tmp/clean_expect.tcl <<'EOF'
#!/usr/bin/expect -f
set timeout 30
set host [lindex $argv 0]
set user [lindex $argv 1]
set password [lindex $argv 2]
set deploy_path [lindex $argv 3]

spawn ssh -o StrictHostKeyChecking=no $user@$host
expect {
    "password:" {
        send "$password\r"
        expect "#"
        send "rm -rf $deploy_path/*\r"
        expect "#"
        send "mkdir -p $deploy_path\r"
        expect "#"
        send "exit\r"
    }
    "#" {
        send "rm -rf $deploy_path/*\r"
        expect "#"
        send "mkdir -p $deploy_path\r"
        expect "#"
        send "exit\r"
    }
}
expect eof
EOF

chmod +x /tmp/clean_expect.tcl
/usr/bin/expect /tmp/clean_expect.tcl "$SERVER_HOST" "$SERVER_USER" "g5jbk3xOcxy&VB{W" "$DEPLOY_PATH"

# 上传文件 - 使用 rsync 或 scp 递归上传
cat > /tmp/upload_expect.tcl <<'EOF'
#!/usr/bin/expect -f
set timeout 120
set host [lindex $argv 0]
set user [lindex $argv 1]
set password [lindex $argv 2]
set local_dist [lindex $argv 3]
set remote_path [lindex $argv 4]

spawn scp -r -o StrictHostKeyChecking=no $local_dist $user@$host:$remote_path/
expect {
    "password:" {
        send "$password\r"
        expect eof
    }
    eof
}
EOF

chmod +x /tmp/upload_expect.tcl
/usr/bin/expect /tmp/upload_expect.tcl "$SERVER_HOST" "$SERVER_USER" "g5jbk3xOcxy&VB{W" "$LOCAL_DIST" "$DEPLOY_PATH"

# 将 dist 目录下的内容移动到部署目录的根目录
cat > /tmp/move_files_expect.tcl <<'EOF'
#!/usr/bin/expect -f
set timeout 30
set host [lindex $argv 0]
set user [lindex $argv 1]
set password [lindex $argv 2]
set deploy_path [lindex $argv 3]

spawn ssh -o StrictHostKeyChecking=no $user@$host
expect {
    "password:" {
        send "$password\r"
        expect "#"
        send "mv $deploy_path/dist/* $deploy_path/\r"
        expect "#"
        send "rmdir $deploy_path/dist\r"
        expect "#"
        send "exit\r"
    }
    "#" {
        send "mv $deploy_path/dist/* $deploy_path/\r"
        expect "#"
        send "rmdir $deploy_path/dist\r"
        expect "#"
        send "exit\r"
    }
}
expect eof
EOF

chmod +x /tmp/move_files_expect.tcl
/usr/bin/expect /tmp/move_files_expect.tcl "$SERVER_HOST" "$SERVER_USER" "g5jbk3xOcxy&VB{W" "$DEPLOY_PATH"

echo -e "${GREEN}✓ 文件上传完成${NC}"
echo ""

# 3. 配置 Nginx
echo -e "${YELLOW}步骤 3/4: 配置 Nginx...${NC}"

cat > /tmp/nginx_config_expect.tcl <<'EOF'
#!/usr/bin/expect -f
set timeout 30
set host [lindex $argv 0]
set user [lindex $argv 1]
set password [lindex $argv 2]
set deploy_path [lindex $argv 3]

spawn ssh -o StrictHostKeyChecking=no $user@$host
expect {
    "password:" {
        send "$password\r"
        expect "#"
        # 创建配置文件
        send "cat > /etc/nginx/conf.d/tarmeer.conf << 'NGINXCONF'\r"
        send "server {\r"
        send "    listen 80;\r"
        send "    server_name _;\r"
        send "    root $deploy_path;\r"
        send "    index index.html;\r"
        send "    location / {\r"
        send "        try_files \\\$uri \\\$uri/ /index.html;\r"
        send "    }\r"
        send "    gzip on;\r"
        send "    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;\r"
        send "}\r"
        send "NGINXCONF\r"
        expect "#"
        # 测试并重启 nginx
        send "nginx -t\r"
        expect "#"
        send "systemctl reload nginx\r"
        expect "#"
        send "exit\r"
    }
    "#" {
        send "cat > /etc/nginx/conf.d/tarmeer.conf << 'NGINXCONF'\r"
        send "server {\r"
        send "    listen 80;\r"
        send "    server_name _;\r"
        send "    root $deploy_path;\r"
        send "    index index.html;\r"
        send "    location / {\r"
        send "        try_files \\\$uri \\\$uri/ /index.html;\r"
        send "    }\r"
        send "    gzip on;\r"
        send "    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;\r"
        send "}\r"
        send "NGINXCONF\r"
        expect "#"
        send "nginx -t\r"
        expect "#"
        send "systemctl reload nginx\r"
        expect "#"
        send "exit\r"
    }
}
expect eof
EOF

chmod +x /tmp/nginx_config_expect.tcl
/usr/bin/expect /tmp/nginx_config_expect.tcl "$SERVER_HOST" "$SERVER_USER" "g5jbk3xOcxy&VB{W" "$DEPLOY_PATH"

echo -e "${GREEN}✓ Nginx 配置完成${NC}"
echo ""

# 4. 验证部署
echo -e "${YELLOW}步骤 4/4: 验证部署...${NC}"

cat > /tmp/verify_expect.tcl <<'EOF'
#!/usr/bin/expect -f
set timeout 30
set host [lindex $argv 0]
set user [lindex $argv 1]
set password [lindex $argv 2]
set deploy_path [lindex $argv 3]

spawn ssh -o StrictHostKeyChecking=no $user@$host
expect {
    "password:" {
        send "$password\r"
        expect "#"
        send "ls -la $deploy_path/\r"
        expect "#"
        send "curl -s -o /dev/null -w '%{http_code}' http://localhost/\r"
        expect "#"
        send "exit\r"
    }
    "#" {
        send "ls -la $deploy_path/\r"
        expect "#"
        send "curl -s -o /dev/null -w '%{http_code}' http://localhost/\r"
        expect "#"
        send "exit\r"
    }
}
expect eof
EOF

chmod +x /tmp/verify_expect.tcl
/usr/bin/expect /tmp/verify_expect.tcl "$SERVER_HOST" "$SERVER_USER" "g5jbk3xOcxy&VB{W" "$DEPLOY_PATH"

# 清理临时文件
rm -f /tmp/clean_expect.tcl /tmp/upload_expect.tcl /tmp/move_files_expect.tcl /tmp/nginx_config_expect.tcl /tmp/verify_expect.tcl

echo -e "${GREEN}✓ 验证完成${NC}"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "访问地址: http://47.91.108.104"
echo ""
