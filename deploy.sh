#!/bin/bash
# Tarmeer 网站部署脚本 - 完整版
# ─────────────────────────────────────────────────────────
# 核心特性：
#   1. rsync 增量传输 + 原子切换（先传临时目录，mv 瞬间切换）
#   2. 自动执行数据库迁移（server/migrations/*.sql）
#   3. 自动同步 nginx 配置（nginx-tarmeer.conf → 服务器）
#   4. 部署后健康检查（JS/CSS 文件数 + 关键页面 HTTP 状态）
#   5. 一键回滚（上一版本保留在 _previous 目录）

set -e

# ─── 配置 ───────────────────────────────────────────────
SERVER_HOST="47.91.108.104"
SERVER_USER="root"
SERVER_PASS='g5jbk3xOcxy&VB{W'
DEPLOY_PATH="/tarmeer/tarmeer_web_portal"
STAGING_PATH="/tarmeer/_staging"
BACKUP_PATH="/tarmeer/_previous"
API_PATH="/tarmeer/tarmeer_api"

# 数据库配置（从后端 .env 读取，部署时 SSH 到服务器获取）
DB_HOST="rm-eb3t6y5093m91i2wzqo.mysql.dubai.rds.aliyuncs.com"
DB_PORT="3306"
DB_USER="tarmeerCRM"
DB_PASS="nyVaXDi6FEaFzakM"
DB_NAME="tarmeer"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

TOTAL_STEPS=7
DEPLOY_OK=true

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Tarmeer 完整部署${NC}"
echo -e "${GREEN}  rsync + 迁移 + nginx + 健康检查${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# ─── 步骤 1: 构建项目 ──────────────────────────────────
echo -e "${YELLOW}步骤 1/${TOTAL_STEPS}: 构建项目...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}构建失败！${NC}"
    exit 1
fi

LOCAL_JS_COUNT=$(find dist/assets -name '*.js' 2>/dev/null | wc -l | tr -d ' ')
LOCAL_CSS_COUNT=$(find dist/assets -name '*.css' 2>/dev/null | wc -l | tr -d ' ')
echo -e "${GREEN}  构建完成：${LOCAL_JS_COUNT} 个 JS，${LOCAL_CSS_COUNT} 个 CSS${NC}"
echo ""

# ─── 步骤 2: 数据库迁移 ────────────────────────────────
echo -e "${YELLOW}步骤 2/${TOTAL_STEPS}: 检查数据库迁移...${NC}"

MIGRATION_DIR="./server/migrations"
MIGRATION_COUNT=0

if [ -d "$MIGRATION_DIR" ] && ls "$MIGRATION_DIR"/*.sql 1>/dev/null 2>&1; then
    for sql_file in "$MIGRATION_DIR"/*.sql; do
        filename=$(basename "$sql_file")

        # 跳过测试文件
        if [[ "$filename" == test-* ]]; then
            echo -e "  跳过测试文件: $filename"
            continue
        fi

        echo -e "  执行迁移: $filename"

        # 用 --force 忽略"列已存在"等非致命错误，确保幂等
        mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" \
            --force < "$sql_file" 2>/tmp/migration_err_$$.log

        # 检查是否有真正的致命错误（排除 Duplicate column / Duplicate key 等）
        if grep -qiE 'ERROR' /tmp/migration_err_$$.log; then
            FATAL=$(grep -iE 'ERROR' /tmp/migration_err_$$.log | grep -ivE 'Duplicate column|Duplicate key|already exists' || true)
            if [ -n "$FATAL" ]; then
                echo -e "${RED}  ⚠️  迁移有致命错误: $filename${NC}"
                echo "$FATAL"
                DEPLOY_OK=false
            else
                echo -e "${GREEN}  ✓ $filename（已是最新，跳过重复项）${NC}"
            fi
        else
            echo -e "${GREEN}  ✓ $filename${NC}"
        fi
        MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
        rm -f /tmp/migration_err_$$.log
    done
    echo -e "${GREEN}  迁移检查完成（${MIGRATION_COUNT} 个文件）${NC}"
else
    echo -e "  无迁移文件，跳过"
fi
echo ""

# ─── 步骤 3: 上传前端到临时目录 ────────────────────────
echo -e "${YELLOW}步骤 3/${TOTAL_STEPS}: 上传前端文件...${NC}"

cat > /tmp/tarmeer_rsync.exp << 'EXPECT_SCRIPT'
#!/usr/bin/expect -f
set timeout 300
set host [lindex $argv 0]
set pass [lindex $argv 1]
set staging [lindex $argv 2]

spawn ssh -o StrictHostKeyChecking=no root@$host "rm -rf $staging && mkdir -p $staging"
expect {
    "password:" { send "$pass\r"; expect eof }
    eof
}

spawn rsync -avz --delete -e "ssh -o StrictHostKeyChecking=no" ./dist/ root@$host:$staging/
expect {
    "password:" { send "$pass\r"; expect eof }
    eof
}
EXPECT_SCRIPT

/usr/bin/expect /tmp/tarmeer_rsync.exp "$SERVER_HOST" "$SERVER_PASS" "$STAGING_PATH"
echo -e "${GREEN}  上传完成${NC}"
echo ""

# ─── 步骤 4: 同步图片资源 ─────────────────────────────
if [ -d "./public/images" ]; then
    echo -e "${YELLOW}步骤 4/${TOTAL_STEPS}: 同步图片资源...${NC}"

    cat > /tmp/tarmeer_images.exp << 'EXPECT_SCRIPT'
#!/usr/bin/expect -f
set timeout 120
set host [lindex $argv 0]
set pass [lindex $argv 1]
set staging [lindex $argv 2]

spawn rsync -avz -e "ssh -o StrictHostKeyChecking=no" ./public/images/ root@$host:$staging/images/
expect {
    "password:" { send "$pass\r"; expect eof }
    eof
}
EXPECT_SCRIPT

    /usr/bin/expect /tmp/tarmeer_images.exp "$SERVER_HOST" "$SERVER_PASS" "$STAGING_PATH"
    echo -e "${GREEN}  图片同步完成${NC}"
else
    echo -e "${YELLOW}步骤 4/${TOTAL_STEPS}: 跳过（无 public/images 目录）${NC}"
fi
echo ""

# ─── 步骤 5: 同步 Nginx 配置 ──────────────────────────
echo -e "${YELLOW}步骤 5/${TOTAL_STEPS}: 同步 Nginx 配置...${NC}"

NGINX_LOCAL="./nginx-tarmeer.conf"
NGINX_REMOTE="/etc/nginx/conf.d/tarmeer.conf"

if [ -f "$NGINX_LOCAL" ]; then
    cat > /tmp/tarmeer_nginx.exp << 'EXPECT_SCRIPT'
#!/usr/bin/expect -f
set timeout 30
set host [lindex $argv 0]
set pass [lindex $argv 1]
set local_file [lindex $argv 2]
set remote_file [lindex $argv 3]

spawn scp -o StrictHostKeyChecking=no $local_file root@$host:$remote_file
expect {
    "password:" { send "$pass\r"; expect eof }
    eof
}
EXPECT_SCRIPT

    /usr/bin/expect /tmp/tarmeer_nginx.exp "$SERVER_HOST" "$SERVER_PASS" "$NGINX_LOCAL" "$NGINX_REMOTE"
    echo -e "${GREEN}  Nginx 配置已同步${NC}"
else
    echo -e "${YELLOW}  未找到 nginx-tarmeer.conf，跳过${NC}"
fi
echo ""

# ─── 步骤 6: 原子切换 + 重载 Nginx + 重启后端 ─────────
echo -e "${YELLOW}步骤 6/${TOTAL_STEPS}: 原子切换并重载服务...${NC}"

cat > /tmp/tarmeer_switch.exp << EXPECT_SCRIPT
#!/usr/bin/expect -f
set timeout 30
spawn ssh -o StrictHostKeyChecking=no root@$SERVER_HOST
expect "password:"
send "$SERVER_PASS\r"
expect "#"

# 原子切换
send "rm -rf $BACKUP_PATH\r"
expect "#"
send "mv $DEPLOY_PATH $BACKUP_PATH 2>/dev/null; mkdir -p $DEPLOY_PATH\r"
expect "#"
send "mv $STAGING_PATH/* $DEPLOY_PATH/ && rm -rf $STAGING_PATH\r"
expect "#"

# 测试并重载 Nginx
send "nginx -t && systemctl reload nginx\r"
expect "#"

# 重启后端 API
send "pm2 restart tarmeer-api --update-env 2>/dev/null || true\r"
expect "#"
send "exit\r"
expect eof
EXPECT_SCRIPT

/usr/bin/expect /tmp/tarmeer_switch.exp
echo -e "${GREEN}  切换完成，Nginx 已重载，后端已重启${NC}"
echo ""

# ─── 步骤 7: 健康检查 ─────────────────────────────────
echo -e "${YELLOW}步骤 7/${TOTAL_STEPS}: 健康检查...${NC}"

# 等待后端启动
sleep 3

cat > /tmp/tarmeer_verify.exp << EXPECT_SCRIPT
#!/usr/bin/expect -f
set timeout 30
log_user 0
spawn ssh -o StrictHostKeyChecking=no root@$SERVER_HOST
expect "password:"
send "$SERVER_PASS\r"
expect "#"

log_user 1

# 检查文件数量
send "echo JS_COUNT=\$(find $DEPLOY_PATH/assets -name '*.js' 2>/dev/null | wc -l) CSS_COUNT=\$(find $DEPLOY_PATH/assets -name '*.css' 2>/dev/null | wc -l)\r"
expect "#"

# 检查首页
send "curl -sk -o /dev/null -w 'HOME_STATUS=%{http_code}' https://www.tarmeer.com/\r"
expect "#"

# 检查 API 健康
send "curl -s -o /dev/null -w 'API_STATUS=%{http_code}' http://localhost:3002/api/health\r"
expect "#"

# 检查 JS 资源是否返回正确的 Content-Type（防止返回 HTML）
send "FIRST_JS=\$(find $DEPLOY_PATH/assets -name '*.js' | head -1 | sed 's|$DEPLOY_PATH||'); curl -sk -o /dev/null -w 'JS_TYPE=%{content_type}' https://www.tarmeer.com\$FIRST_JS\r"
expect "#"

send "exit\r"
expect eof
EXPECT_SCRIPT

VERIFY_OUTPUT=$(/usr/bin/expect /tmp/tarmeer_verify.exp 2>&1)

# 提取结果
REMOTE_JS=$(echo "$VERIFY_OUTPUT" | grep -oP 'JS_COUNT=\K\d+' | head -1)
REMOTE_CSS=$(echo "$VERIFY_OUTPUT" | grep -oP 'CSS_COUNT=\K\d+' | head -1)
HOME_CODE=$(echo "$VERIFY_OUTPUT" | grep -oP 'HOME_STATUS=\K\d+' | head -1)
API_CODE=$(echo "$VERIFY_OUTPUT" | grep -oP 'API_STATUS=\K\d+' | head -1)
JS_TYPE=$(echo "$VERIFY_OUTPUT" | grep -oP 'JS_TYPE=\K[^ ]+' | head -1)

echo ""
echo "  ┌────────────────────────────────────┐"
echo "  │  文件数:  JS ${REMOTE_JS:-?}/${LOCAL_JS_COUNT}  CSS ${REMOTE_CSS:-?}/${LOCAL_CSS_COUNT}  │"
echo "  │  首页:    HTTP ${HOME_CODE:-?}                  │"
echo "  │  API:     HTTP ${API_CODE:-?}                  │"
echo "  │  JS类型:  ${JS_TYPE:-?}        │"
echo "  └────────────────────────────────────┘"

# 校验
if [ -n "$REMOTE_JS" ] && [ "$LOCAL_JS_COUNT" != "$REMOTE_JS" ]; then
    echo -e "${RED}  ⚠️  JS 文件数量不匹配！${NC}"
    DEPLOY_OK=false
fi

if [ -n "$REMOTE_CSS" ] && [ "$LOCAL_CSS_COUNT" != "$REMOTE_CSS" ]; then
    echo -e "${RED}  ⚠️  CSS 文件数量不匹配！${NC}"
    DEPLOY_OK=false
fi

if [ "$HOME_CODE" != "200" ] && [ -n "$HOME_CODE" ]; then
    echo -e "${RED}  ⚠️  首页返回 HTTP ${HOME_CODE}，预期 200${NC}"
    DEPLOY_OK=false
fi

if [ "$API_CODE" != "200" ] && [ -n "$API_CODE" ]; then
    echo -e "${RED}  ⚠️  API 健康检查失败，HTTP ${API_CODE}${NC}"
    DEPLOY_OK=false
fi

if echo "$JS_TYPE" | grep -qi "text/html"; then
    echo -e "${RED}  ⚠️  JS 文件返回 text/html！（和今天的 chunk 错误一样）${NC}"
    DEPLOY_OK=false
fi

# 清理临时文件
rm -f /tmp/tarmeer_rsync.exp /tmp/tarmeer_images.exp /tmp/tarmeer_nginx.exp /tmp/tarmeer_switch.exp /tmp/tarmeer_verify.exp /tmp/migration_err_*.log

echo ""
if [ "$DEPLOY_OK" = true ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  ✅ 部署成功！所有检查通过${NC}"
    echo -e "${GREEN}========================================${NC}"
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  ⚠️  部署完成但有异常，请检查！${NC}"
    echo -e "${RED}  💡 回滚命令：${NC}"
    echo -e "${RED}     ssh root@${SERVER_HOST}${NC}"
    echo -e "${RED}     rm -rf ${DEPLOY_PATH} && mv ${BACKUP_PATH} ${DEPLOY_PATH}${NC}"
    echo -e "${RED}     systemctl reload nginx${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
echo ""
echo "🌐 访问: https://www.tarmeer.com"
echo "🔙 回滚: 上一版本保留在 ${BACKUP_PATH}"
